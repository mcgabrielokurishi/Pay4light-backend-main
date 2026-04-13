export interface AIRequest {
  userId: string;
  question: string;
}

export interface AIResponse {
  answer: string;
  suggestedActions?: string[];
}
