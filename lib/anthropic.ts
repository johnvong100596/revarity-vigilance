import Anthropic from "@anthropic-ai/sdk";

export const CLAUDE_MODEL = "claude-sonnet-4-6";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local (local) or Vercel project env (deployed)."
    );
  }
  client = new Anthropic({ apiKey });
  return client;
}

export async function composeCopy(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 400
): Promise<string> {
  const anthropic = getAnthropicClient();
  const response = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = response.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") {
    throw new Error("Claude returned no text content");
  }
  return block.text.trim();
}

export async function smokeTest(): Promise<string> {
  return composeCopy(
    "You are a financial CFO assistant for Vigilance. Reply in one terse sentence.",
    "Reply with exactly: smoke test ok.",
    20
  );
}

/**
 * Rewrites a templated hint body in a calmer, second-person voice. Used
 * by the hints engine to humanize the string-interpolated body before
 * insert. Returns null on any failure — caller falls back to templated
 * body so the system degrades gracefully when the API hiccups.
 *
 * Cost budget per call: ~400 output tokens × $15/MTok ≈ $0.006. Engine
 * caps to 3 LLM-composed hints per day per user to keep daily spend
 * predictable.
 */
const HINT_REWRITE_SYSTEM = `You rewrite financial hint copy for Vigilance — a daily check-in app for people who are NOT finance nerds.

VOICE
- Second-person, calm, plain English. Talk like a sharp friend, not a bank.
- Surface what you noticed — don't command. State the observation and the plain consequence; let the user draw the conclusion. Never alarming, never bossy.
- Max 2 sentences. Tight.
- Concrete: keep every dollar figure, %, date, and account name EXACT — don't round, don't paraphrase numbers.
- No jargon (no "APR", "utilization", "liabilities", "balance sheet") — translate to plain words a 70-year-old would get.

GOOD: "You've got $2,340 sitting in checking earning almost nothing. In a high-interest savings account that's about $230 a year."
BAD:  "High cash position detected. Consider reallocating to yield-bearing instruments."

SCOPE GUARDRAILS
- NO advice on specific trades, securities, or tax positions.
- NO disclaimers ("this is not financial advice", "consult a professional"). The app handles those globally.
- NO emojis, no exclamation marks.

OUTPUT
- The rewritten hint body. Nothing else. No labels, no preamble.`;

export async function composeHintBody(
  templatedBody: string,
  context: { severity: "pay_attention" | "opportunity" | "strategic" }
): Promise<string | null> {
  try {
    const composed = await composeCopy(
      HINT_REWRITE_SYSTEM,
      `Severity: ${context.severity}\n\nTemplated body:\n${templatedBody}`,
      300
    );
    return composed.trim();
  } catch (e) {
    console.error("[anthropic] composeHintBody failed", e);
    return null;
  }
}
