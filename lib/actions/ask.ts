"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { composeCopy, CLAUDE_MODEL } from "@/lib/anthropic";
import { toDecimal } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/lib/workspace";

const DAILY_CAP = 5; // Per user, resets at UTC midnight
const MAX_QUESTION = 500;

const AskInput = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Question is too short")
    .max(MAX_QUESTION, "Question is too long (max 500 characters)"),
});

const ASK_SYSTEM = `You are Vigilance — a calm, plain-English financial reflection companion.

VOICE
- Second person, present tense. Tight. Direct.
- No "you should" / "consider" / "may want to" hedging.
- No jargon. Translate technical terms (APR → "interest", liabilities → "debts").
- Max 4 short sentences unless the user explicitly asks for more detail.

STRICT SCOPE
- You may ONLY answer using the user's data shown in the CONTEXT below.
- If the question can't be answered from CONTEXT, say so plainly: "I can't answer that from what I can see in your accounts."
- NEVER recommend specific stocks, ETFs, crypto, securities, or tax positions.
- NEVER make up numbers. Quote figures only if they appear in CONTEXT.
- NO disclaimers ("not financial advice") — the app handles these globally.

OUTPUT
- The answer. Nothing else. No greeting, no labels.`;

interface AskContext {
  netWorth: number;
  homeCurrency: string;
  accounts: Array<{
    name: string;
    type: string;
    category: string;
    balance: number;
    currency: string;
    apr?: number | null;
    min_payment?: number | null;
    last_acknowledged_at?: string | null;
  }>;
  recentHints: Array<{ title: string; body: string; category: string }>;
  streakDays: number;
  ninetyDayNetWorthChange?: number;
}

function buildContextBlock(ctx: AskContext): string {
  const lines: string[] = [];
  lines.push(`Net worth: ${ctx.netWorth.toFixed(2)} ${ctx.homeCurrency}`);
  if (ctx.ninetyDayNetWorthChange !== undefined) {
    lines.push(`90-day change: ${ctx.ninetyDayNetWorthChange >= 0 ? "+" : ""}${ctx.ninetyDayNetWorthChange.toFixed(2)} ${ctx.homeCurrency}`);
  }
  lines.push(`Streak: ${ctx.streakDays} days`);
  lines.push("");
  lines.push("Accounts:");
  for (const a of ctx.accounts) {
    const sign = a.category === "debt" ? "-" : "+";
    const apr = a.apr != null ? ` (interest ${a.apr}%)` : "";
    const minPay =
      a.min_payment != null ? ` (min payment ${a.min_payment} ${a.currency})` : "";
    lines.push(
      `  - ${a.name} [${a.type}, ${a.category}]: ${sign}${Math.abs(a.balance).toFixed(2)} ${a.currency}${apr}${minPay}`
    );
  }
  if (ctx.recentHints.length > 0) {
    lines.push("");
    lines.push("Recent hints:");
    for (const h of ctx.recentHints) {
      lines.push(`  - [${h.category}] ${h.title}: ${h.body}`);
    }
  }
  return lines.join("\n");
}

export interface AskResult {
  ok: boolean;
  answer?: string;
  error?: string;
  remainingToday?: number;
}

export async function askVigilance(input: { question: string }): Promise<AskResult> {
  const parsed = AskInput.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in" };

  let workspaceId: string;
  try {
    workspaceId = await getActiveWorkspaceId(supabase, user.id);
  } catch {
    return { ok: false, error: "No active workspace" };
  }

  // Daily cap — UTC day window. Race-safe pattern: insert a placeholder
  // row FIRST, then re-count under that row. If the count exceeds the
  // cap, rollback by deleting the placeholder. This makes the cap
  // monotonic under concurrent requests at the cost of one extra round-
  // trip; we keep that cost since each ask already triggers a Claude call.
  const utcMidnight = new Date();
  utcMidnight.setUTCHours(0, 0, 0, 0);

  const { data: placeholder, error: placeholderErr } = await supabase
    .from("ask_history")
    .insert({
      user_id: user.id,
      workspace_id: workspaceId,
      question: parsed.data.question,
      answer: "", // filled on success; deleted on failure or over-cap
      model: CLAUDE_MODEL,
    })
    .select("id")
    .single();
  if (placeholderErr || !placeholder?.id) {
    return { ok: false, error: "Could not record question. Try again." };
  }

  const { count: usedToday } = await supabase
    .from("ask_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", utcMidnight.toISOString());

  if ((usedToday ?? 0) > DAILY_CAP) {
    // Over cap — roll back our placeholder and refuse
    await supabase.from("ask_history").delete().eq("id", placeholder.id);
    return {
      ok: false,
      error: `Daily limit reached (${DAILY_CAP} questions per day). Resets at midnight UTC.`,
      remainingToday: 0,
    };
  }

  // Pull context: profile, accounts, recent hints, snapshots
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const [profileRes, accountsRes, hintsRes, snapshotsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("home_currency, awareness_streak")
      .eq("id", user.id)
      .single(),
    supabase
      .from("accounts")
      .select(
        "name, type, category, balance, currency, apr, min_payment, last_acknowledged_at"
      )
      .eq("workspace_id", workspaceId)
      .eq("archived", false),
    supabase
      .from("hints")
      .select("title, body, composed_body, category")
      .eq("workspace_id", workspaceId)
      .eq("status", "active")
      .order("severity_score", { ascending: false })
      .limit(5),
    supabase
      .from("balance_snapshots")
      .select("balance, captured_at")
      .eq("workspace_id", workspaceId)
      .gte("captured_at", ninetyDaysAgo.toISOString())
      .order("captured_at", { ascending: true }),
  ]);

  const homeCurrency = (profileRes.data?.home_currency as string) ?? "USD";
  const accounts = accountsRes.data ?? [];
  const hints = hintsRes.data ?? [];
  const snapshots = snapshotsRes.data ?? [];

  if (accounts.length === 0) {
    return {
      ok: false,
      error: "Connect a bank or add an account first — there's nothing to reflect on yet.",
    };
  }

  const netWorth = accounts.reduce((sum, a) => {
    const signed = toDecimal(a.balance).times(a.category === "asset" ? 1 : -1);
    return sum.plus(signed);
  }, toDecimal(0));

  // 90d net worth delta — first vs latest snapshot total
  let ninetyDayChange: number | undefined;
  if (snapshots.length >= 2) {
    const first = Number(snapshots[0].balance);
    const last = Number(snapshots[snapshots.length - 1].balance);
    ninetyDayChange = last - first;
  }

  const context: AskContext = {
    netWorth: netWorth.toNumber(),
    homeCurrency,
    streakDays: (profileRes.data?.awareness_streak as number) ?? 0,
    ninetyDayNetWorthChange: ninetyDayChange,
    accounts: accounts.map((a) => ({
      name: a.name as string,
      type: a.type as string,
      category: a.category as string,
      balance: Number(a.balance),
      currency: a.currency as string,
      apr: a.apr != null ? Number(a.apr) : null,
      min_payment: a.min_payment != null ? Number(a.min_payment) : null,
      last_acknowledged_at: a.last_acknowledged_at as string | null,
    })),
    recentHints: hints.map((h) => ({
      title: h.title as string,
      body: ((h.composed_body as string | null) ?? h.body) as string,
      category: h.category as string,
    })),
  };

  const userPrompt = `CONTEXT:\n${buildContextBlock(context)}\n\nQUESTION:\n${parsed.data.question}`;

  let answer: string;
  try {
    answer = await composeCopy(ASK_SYSTEM, userPrompt, 600);
  } catch (e) {
    console.error("[askVigilance] LLM call failed", e);
    // Roll back the placeholder so the failed attempt doesn't eat a slot
    await supabase.from("ask_history").delete().eq("id", placeholder.id);
    return {
      ok: false,
      error: "Couldn't reach the model. Try again in a moment.",
    };
  }

  // Fill the placeholder we inserted up front
  const { error: updateErr } = await supabase
    .from("ask_history")
    .update({ answer })
    .eq("id", placeholder.id);
  if (updateErr) {
    console.error("[askVigilance] history update failed", updateErr);
    // Answer still returns to the user — history loss is annoying but not blocking
  }

  revalidatePath("/app/ask");

  // Re-count after the insert so the returned remaining is authoritative
  // even under concurrent requests (L3)
  const { count: usedAfter } = await supabase
    .from("ask_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", utcMidnight.toISOString());

  return {
    ok: true,
    answer,
    remainingToday: Math.max(0, DAILY_CAP - (usedAfter ?? usedToday ?? 0)),
  };
}
