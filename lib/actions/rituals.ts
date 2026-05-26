"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const ISODate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const WeeklyReflectionInput = z.object({
  weekStarting: ISODate,
  reflectionText: z.string().max(2000),
  netWorthStart: z.number().nullable(),
  netWorthEnd: z.number().nullable(),
  biggestMovers: z.unknown(),
  paymentsSummary: z.unknown(),
});

export async function saveWeeklyReflection(input: {
  weekStarting: string;
  reflectionText: string;
  netWorthStart: number | null;
  netWorthEnd: number | null;
  biggestMovers: unknown;
  paymentsSummary: unknown;
}) {
  const data = WeeklyReflectionInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("weekly_reflections").upsert(
    {
      user_id: user.id,
      week_starting: data.weekStarting,
      reflection_text: data.reflectionText,
      net_worth_start: data.netWorthStart,
      net_worth_end: data.netWorthEnd,
      biggest_movers: data.biggestMovers,
      payments_summary: data.paymentsSummary,
    },
    { onConflict: "user_id,week_starting" }
  );
  if (error) throw new Error(`save reflection failed: ${error.message}`);

  revalidatePath("/app/reckoning");
  revalidatePath("/app");
}

const MonthlyCloseInput = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  netWorth: z.number().nullable(),
  monthlyChange: z.number().nullable(),
  waterfallBreakdown: z.unknown(),
  wins: z.array(z.string()).max(20),
  drags: z.array(z.string()).max(20),
  notes: z.string().max(2000),
});

export async function lockMonthlyClose(input: {
  month: string;
  netWorth: number | null;
  monthlyChange: number | null;
  waterfallBreakdown: unknown;
  wins: string[];
  drags: string[];
  notes: string;
}) {
  const data = MonthlyCloseInput.parse(input);
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Monthly closes are immutable once locked (no UPDATE policy on the
  // table). Treat re-submits as conflicts and surface them.
  const { error } = await supabase.from("monthly_closes").insert({
    user_id: user.id,
    month: data.month,
    net_worth: data.netWorth,
    monthly_change: data.monthlyChange,
    waterfall_breakdown: data.waterfallBreakdown,
    wins: data.wins,
    drags: data.drags,
    notes: data.notes,
  });
  if (error) {
    if (error.code === "23505") {
      throw new Error(`Month ${data.month} is already locked`);
    }
    throw new Error(`lock close failed: ${error.message}`);
  }

  revalidatePath("/app/close");
  revalidatePath("/app");
}
