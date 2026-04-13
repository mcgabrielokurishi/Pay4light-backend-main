import { AIIntent } from "../intent/intent.types";

export interface ActionResult {
  handled: boolean;
  response?: any;
}

export interface ActionContext {
  userId: string;
  question: string;
  intent: AIIntent;
}
