"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { Id } from "./_generated/dataModel";

// Provider clients initialization
const createOpenAIClient = (apiKey: string, baseURL?: string) => {
  return new OpenAI({
    apiKey,
    baseURL: baseURL || "https://api.openai.com/v1",
  });
};

const createGoogleClient = (apiKey: string) => {
  return new GoogleGenAI({ apiKey });
};

// For Anthropic, we'll use OpenAI SDK with a different base URL
const createAnthropicClient = (apiKey: string) => {
  // Using OpenAI SDK for Anthropic with baseURL hack
  return new OpenAI({
    apiKey,
    baseURL: "https://api.anthropic.com/v1",
    defaultHeaders: {
      "anthropic-version": "2023-06-01",
    },
  });
};

// Main action for sending messages with multi-model support
export const sendMessage: any = action({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
    provider: v.string(),
    model: v.string(),
    apiKey: v.optional(v.string()), // For BYOK
    attachmentIds: v.optional(v.array(v.id("attachments"))),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Create user message
    const userMessageId = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "user",
      content: args.content,
    });

    // Handle attachments if provided
    if (args.attachmentIds && args.attachmentIds.length > 0) {
      for (const attachmentId of args.attachmentIds) {
        await ctx.runMutation(internal.messages.linkAttachment, {
          messageId: userMessageId,
          attachmentId,
        });
      }
    }

    // Create assistant message with cursor
    const assistantMessageId: any = await ctx.runMutation(api.messages.create, {
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

      // Convert to provider format (exclude the streaming message we just created)
      const conversationHistory = messages
        .filter((msg: any) => msg._id !== assistantMessageId)
        .map((msg: any) => ({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
        }));

      // Add system prompt if provided
      if (args.systemPrompt) {
        conversationHistory.unshift({
          role: "system",
          content: args.systemPrompt,
        });
      }

      // Stream response based on provider
      let fullContent = "";
      let inputTokens = 0;
      let outputTokens = 0;

      switch (args.provider) {
        case "openai":
        case "openrouter": {
          const apiKey = args.apiKey || process.env.CONVEX_OPENAI_API_KEY;
          if (!apiKey) throw new Error("OpenAI API key required");

          const baseURL = args.provider === "openrouter" 
            ? "https://openrouter.ai/api/v1" 
            : process.env.CONVEX_OPENAI_BASE_URL;

          const client = createOpenAIClient(apiKey, baseURL);
          
          const stream = await client.chat.completions.create({
            model: args.model,
            messages: conversationHistory,
            stream: true,
            ...(args.provider === "openrouter" && {
              headers: {
                "HTTP-Referer": "https://c3chat.app",
                "X-Title": "C3Chat",
              },
            }),
          });

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

            // Extract usage if available
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || 0;
              outputTokens = chunk.usage.completion_tokens || 0;
            }
          }
          break;
        }

        case "google": {
          const apiKey = args.apiKey || process.env.CONVEX_GOOGLE_API_KEY;
          if (!apiKey) throw new Error("Google API key required");

          const genAI = createGoogleClient(apiKey);

          // Convert messages to Google format
          const googleHistory = conversationHistory.map((msg: any) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          }));

          const googleResponse = await genAI.models.generateContentStream({
            model: args.model,
            contents: googleHistory,
          });

          for await (const chunk of googleResponse) {
            const delta = chunk.text || "";
            if (delta) {
              fullContent += delta;
              
              await ctx.runMutation(internal.messages.updateContent, {
                messageId: assistantMessageId,
                content: fullContent,
                isStreaming: true,
                cursor: true,
              });
            }
          }

          // Note: We skip getting response metadata for Google as the API differs
          inputTokens = 0;
          outputTokens = 0;
          break;
        }

        case "anthropic": {
          const apiKey = args.apiKey || process.env.CONVEX_ANTHROPIC_API_KEY;
          if (!apiKey) throw new Error("Anthropic API key required");

          // Using OpenAI SDK format for Anthropic
          const client = createAnthropicClient(apiKey);
          
          const stream = await client.chat.completions.create({
            model: args.model,
            messages: conversationHistory,
            stream: true,
            max_tokens: 4096,
          });

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
              fullContent += delta;
              
              await ctx.runMutation(internal.messages.updateContent, {
                messageId: assistantMessageId,
                content: fullContent,
                isStreaming: true,
                cursor: true,
              });
            }

            // Extract usage if available
            if ((chunk as any).usage) {
              inputTokens = (chunk as any).usage.prompt_tokens || 0;
              outputTokens = (chunk as any).usage.completion_tokens || 0;
            }
          }
          break;
        }

        default:
          throw new Error(`Unsupported provider: ${args.provider}`);
      }

      // Remove cursor and streaming flag when complete
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: fullContent,
        isStreaming: false,
        cursor: false,
        inputTokens,
        outputTokens,
      });

      return { success: true, messageId: assistantMessageId };
    } catch (error) {
      // Handle error by updating the assistant message
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: `Sorry, I encountered an error: ${errorMessage}. Please check your API key and try again.`,
        isStreaming: false,
        cursor: false,
      });

      throw error;
    }
  },
});

// Resume an interrupted stream
export const resumeStream = action({
  args: {
    messageId: v.id("messages"),
    provider: v.string(),
    model: v.string(),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const message = await ctx.runQuery(internal.messages.getById, { 
      messageId: args.messageId 
    });
    
    if (!message || !message.isStreaming) {
      throw new Error("Message is not in streaming state");
    }

    // Get thread and history
    const thread = await ctx.runQuery(internal.threads.getById, {
      threadId: message.threadId,
    });
    
    const messages = await ctx.runQuery(api.messages.list, {
      threadId: message.threadId,
    });

    // Find messages up to the streaming one
    const messageIndex = messages.findIndex((m: any) => m._id === args.messageId);
    const historyMessages = messages.slice(0, messageIndex);

    // Continue streaming from where it left off
    // Implementation would be similar to sendMessage but continuing from current content
    // This is a placeholder for the resume logic
    
    return { resumed: true };
  },
});

// Generate image using DALL-E or other providers
export const generateImage = action({
  args: {
    threadId: v.id("threads"),
    prompt: v.string(),
    provider: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    size: v.optional(v.union(
      v.literal("256x256"),
      v.literal("512x512"), 
      v.literal("1024x1024"),
      v.literal("1024x1792"),
      v.literal("1792x1024")
    )),
  },
  handler: async (ctx, args) => {
    const provider = args.provider || "openai";
    const size = args.size || "1024x1024";
    
    // Create user message
    const userMessageId = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "user",
      content: `Generate image: ${args.prompt}`,
    });

    // Create assistant message
    const assistantMessageId = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "assistant",
      content: "Generating image...",
      isStreaming: true,
    });

    try {
      let imageUrl: string;

      switch (provider) {
        case "openai": {
          const apiKey = args.apiKey || process.env.CONVEX_OPENAI_API_KEY;
          if (!apiKey) throw new Error("OpenAI API key required");

          const client = createOpenAIClient(apiKey);
          const response = await client.images.generate({
            model: "dall-e-3",
            prompt: args.prompt,
            n: 1,
            size: size as any,
          });

          imageUrl = response.data?.[0]?.url || "";
          break;
        }
        
        // Add other image generation providers here
        
        default:
          throw new Error(`Unsupported image provider: ${provider}`);
      }

      // Update message with image
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: `Generated image for: "${args.prompt}"`,
        isStreaming: false,
        generatedImageUrl: imageUrl,
      });

      return { success: true, imageUrl };
    } catch (error) {
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: `Failed to generate image: ${error instanceof Error ? error.message : "Unknown error"}`,
        isStreaming: false,
      });
      
      throw error;
    }
  },
});

// Web search action
export const searchWeb = internalAction({
  args: {
    query: v.string(),
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.CONVEX_BRAVE_SEARCH_API_KEY;
    if (!apiKey) throw new Error("Brave Search API key not configured");

    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(args.query)}`,
      {
        headers: {
          "Accept": "application/json",
          "X-Subscription-Token": apiKey,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Search failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract and format results
    const results = data.web?.results?.slice(0, 5).map((result: any) => ({
      title: result.title,
      url: result.url,
      snippet: result.description,
      favicon: result.favicon,
    })) || [];

    // Store search results
    await ctx.runMutation(internal.messages.storeSearchResults, {
      messageId: args.messageId,
      query: args.query,
      results,
    });

    return results;
  },
});
