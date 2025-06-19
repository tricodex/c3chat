import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenAI, Type } from "@google/genai";
import { api, internal } from "./_generated/api";

// Define the payment function declaration for Gemini
const sendUSDCPaymentFunctionDeclaration = {
  name: 'send_usdc_payment',
  description: 'Sends USDC payment to a specified recipient on Base Sepolia network.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      recipientAddress: {
        type: Type.STRING,
        description: 'Ethereum address of the recipient (0x...)',
      },
      amount: {
        type: Type.NUMBER,
        description: 'Amount of USDC to send (e.g., 1.56)',
      },
    },
    required: ['recipientAddress', 'amount'],
  },
};

export const processPaymentCommand = action({
  args: {
    threadId: v.id("threads"),
    userMessageId: v.id("messages"),
    provider: v.string(),
    model: v.string(),
    apiKey: v.optional(v.string()),
    paymentPrompt: v.string(),
  },
  handler: async (ctx, args) => {
    // Only allow Gemini models to process payment commands
    if (args.provider !== "google" || !args.model.includes("gemini")) {
      throw new Error("Payment commands are only available with Google Gemini models");
    }

    // Create assistant message for processing
    const assistantMessageId = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "assistant",
      content: "Processing payment request...",
      isStreaming: true,
      cursor: true,
    });

    try {
      // Initialize Gemini
      const apiKey = args.apiKey || process.env.CONVEX_GOOGLE_API_KEY;
      if (!apiKey) throw new Error("Google API key required");

      const genAI = new GoogleGenAI({ apiKey });

      // Create request with function declaration
      const config = {
        tools: [{
          functionDeclarations: [sendUSDCPaymentFunctionDeclaration]
        }],
      };

      // Parse the payment command more explicitly
      const paymentRegex = /(\d+(?:\.\d+)?)\s+(0x[a-fA-F0-9]{40})/;
      const match = args.paymentPrompt.match(paymentRegex);
      
      let promptText = args.paymentPrompt;
      if (match) {
        // Make the prompt more explicit for function calling
        promptText = `Send ${match[1]} USDC to address ${match[2]}`;
      }
      
      const contents = [{
        role: "user",
        parts: [{ text: promptText }]
      }];

      // Generate content with function calling
      const result = await genAI.models.generateContent({
        model: args.model,
        contents,
        config,
      });

      // Check if function call was made - updated for correct Google GenAI SDK structure
      const candidates = result.candidates;
      
      if (candidates && candidates[0]?.content?.parts) {
        const part = candidates[0].content.parts.find((p: any) => p.functionCall);
        
        if (part?.functionCall) {
          const functionCall = part.functionCall;
        
        if (functionCall.name === 'send_usdc_payment') {
          const args = functionCall.args as { recipientAddress: string; amount: number } | undefined;
          if (!args) {
            throw new Error("No payment arguments provided");
          }
          const { recipientAddress, amount } = args;
          
          // Validate address format
          if (!recipientAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
            throw new Error("Invalid Ethereum address format");
          }
          
          // Validate amount
          if (amount <= 0 || isNaN(amount)) {
            throw new Error("Invalid amount");
          }

          // Create a response with payment details
          const paymentResponse = `💸 **Payment Request Prepared**

**To:** ${recipientAddress}
**Amount:** ${amount} USDC
**Network:** Base Sepolia

✅ Payment details have been extracted and validated.
⚡ Please confirm the transaction in your wallet to complete the payment.

*Note: This is a test transaction on Base Sepolia testnet.*`;

          // Update message content with toolCalls
          await ctx.runMutation(internal.messages.updateContent, {
            messageId: assistantMessageId,
            content: paymentResponse,
            isStreaming: false,
            cursor: false,
            toolCalls: [{
              id: `payment_${Date.now()}`,
              type: 'function',
              function: {
                name: 'send_usdc_payment',
                arguments: JSON.stringify({ recipientAddress, amount }),
              },
            }],
          });

          return {
            success: true,
            paymentDetails: {
              recipientAddress,
              amount,
            },
          };
        }
        }
      }
      
      // No function call detected, respond with regular text
      const textContent = candidates?.[0]?.content?.parts?.[0]?.text || 
        "I couldn't parse the payment request. Please use the format: /pay [amount] [address]";
        
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: textContent,
        isStreaming: false,
        cursor: false,
      });

      return { success: true };
    } catch (error: any) {
      // Update message with error
      const errorMessage = `❌ Payment processing failed: ${error.message}`;
      
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: errorMessage,
        isStreaming: false,
        cursor: false,
      });

      throw error;
    }
  },
});