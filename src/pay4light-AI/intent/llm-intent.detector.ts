import OpenAI from "openai";
import { AIIntent } from "./intent.types";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function detectIntentWithLLM(question: string): Promise<AIIntent> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `
You are an intent classifier.
Return ONLY one of these labels:
CHECK_BALANCE
FAILED_PURCHASE
RETRY_PURCHASE
FUND_WALLET
TOKEN_ISSUE
GENERAL_QUESTION
        `,
      },
      { role: "user", content: question },
    ],
  });

  const content = response.choices?.[0]?.message?.content;

if (!content) {
  throw new Error("AI returned empty response");
}

const label = content.trim();
  return AIIntent[label as keyof typeof AIIntent] || AIIntent.GENERAL_QUESTION;
}
