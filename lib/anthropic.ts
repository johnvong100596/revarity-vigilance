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
