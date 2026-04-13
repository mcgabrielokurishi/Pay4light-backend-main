import { ActionHandlers } from "./action.handlers";
import { AIIntent } from "../intent/intent.types";

export class ActionEngine {
  constructor(private handlers: ActionHandlers) {}

  async execute(intent: AIIntent, userId: string) {
    return this.handlers.handle(intent, userId);
  }
}
