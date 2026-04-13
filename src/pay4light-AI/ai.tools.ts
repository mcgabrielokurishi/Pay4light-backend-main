import { ChatCompletionTool } from 'openai/resources/chat/completions';

export const AI_TOOLS: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_wallet_balance",
      description: "Get the current wallet balance for the logged-in user",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_meters",
      description: "Get all meters registered to the logged-in user",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "buy_electricity",
      description:
        "Purchase electricity units for a meter. Always confirm amount and meter with user before calling this.",
      parameters: {
        type: "object",
        properties: {
          meterId: { type: "string" },
          amount: { type: "number" },
        },
        required: ["meterId", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_transaction_history",
      description:
        "Get the transaction history for the user, optionally filtered by meter",
      parameters: {
        type: "object",
        properties: {
          meterId: { type: "string" },
          limit: { type: "number" },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "forecast_token_expiry",
      description:
        "Forecast when the electricity token will run out based on usage history",
      parameters: {
        type: "object",
        properties: {
          meterId: { type: "string" },
        },
        required: ["meterId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_disco_info",
      description:
        "Get information about a DISCO — tariff, coverage, support contacts",
      parameters: {
        type: "object",
        properties: {
          discoCode: { type: "string" },
        },
        required: ["discoCode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_meter",
      description: "Add a new meter to the user account",
      parameters: {
        type: "object",
        properties: {
          meterNumber: { type: "string" },
          meterType: {
            type: "string",
            enum: ["PREPAID", "POSTPAID"],
          },
          discoCode: { type: "string" },
          address: { type: "string" },
        },
        required: ["meterNumber", "meterType", "discoCode"],
      },
    },
  },
];