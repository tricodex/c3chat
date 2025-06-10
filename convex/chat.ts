import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.CONVEX_OPENAI_BASE_URL,
  apiKey: process.env.CONVEX_OPENAI_API_KEY,
});

export const sendMessage = action({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    // Create user message
    const userMessageId = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "user",
      content: args.content,
    });

    // Create assistant message with cursor
    const assistantMessageId = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "assistant",
      content: "",
      isStreaming: true,
      cursor: true,
    });

    try {
      // Get conversation history
      const messages = await ctx.runQuery(api.messages.list, {
        threadId: args.threadId,
      });

      // Convert to OpenAI format (exclude the streaming message we just created)
      const conversationHistory = messages
        .filter((msg) => msg._id !== assistantMessageId)
        .map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));

      // Stream response from OpenAI
      const stream = await openai.chat.completions.create({
        model: "gpt-4.1-nano",
        messages: conversationHistory,
        stream: true,
      });

      let fullContent = "";

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || "";
        if (delta) {
          fullContent += delta;
          
          // Update message content in real-time
          await ctx.runMutation(internal.messages.updateContent, {
            messageId: assistantMessageId,
            content: fullContent,
            isStreaming: true,
            cursor: true,
          });
        }
      }

      // Remove cursor and streaming flag when complete
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: fullContent,
        isStreaming: false,
        cursor: false,
      });

      return { success: true };
    } catch (error) {
      // Handle error by updating the assistant message
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: "Sorry, I encountered an error processing your message. Please try again.",
        isStreaming: false,
        cursor: false,
      });

      throw error;
    }
  },
});
