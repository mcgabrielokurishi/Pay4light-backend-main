import { AIIntent } from "./intent.types";
import { detectIntentRuleBased } from "./rule-intent.detector";
import { detectIntentWithLLM } from "./llm-intent.detector";

export async function detectIntent(question: string): Promise<AIIntent> {

  const ruleIntent = detectIntentRuleBased(question);

  if (ruleIntent) {
    return ruleIntent;
  }

  return await detectIntentWithLLM(question);
}
