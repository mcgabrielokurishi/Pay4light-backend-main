import { AIIntent } from "./intent.types";

export function detectIntentRuleBased(question: string): AIIntent | null {
  const q = question.toLowerCase();

  if (q.includes("balance"))
    return AIIntent.CHECK_BALANCE;

  if (q.includes("failed") || q.includes("fail"))
    return AIIntent.FAILED_PURCHASE;

  if (q.includes("retry"))
    return AIIntent.RETRY_PURCHASE;

  if (q.includes("fund") || q.includes("top up"))
    return AIIntent.FUND_WALLET;

  if (q.includes("token not working"))
    return AIIntent.TOKEN_ISSUE;

  return null;
}
