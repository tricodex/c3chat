import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { StreamBuffer, sanitizeContent, retryWithBackoff } from "./aiUtils";

// Helper to create OpenAI-compatible client for OpenRouter
const createOpenAIClient = (apiKey: string, baseURL?: string) => {
  return new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: baseURL?.includes("openrouter") ? {
      "HTTP-Referer": "https://c3chat.app",
      "X-Title": "C3Chat",
    } : undefined,
  });
};

// Create OpenRouter client (OpenAI-compatible)
const createOpenRouterClient = (apiKey: string) => {
  return new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://c3chat.app",
      "X-Title": "C3Chat",
    },
  });
};

// Generate AI response without creating user message (for optimistic UI flow)
export const generateResponse = action({
  args: {
    threadId: v.id("threads"),
    userMessageId: v.id("messages"),
    provider: v.string(),
    model: v.string(),
    apiKey: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
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
          
          const streamBuffer = new StreamBuffer();
          
          const stream = await retryWithBackoff(async () => {
            return await client.chat.completions.create({
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
          });

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
              streamBuffer.add(delta);
              
              // Buffer updates for smoother UI
              if (streamBuffer.shouldFlush()) {
                const bufferedContent = streamBuffer.flush();
                fullContent += bufferedContent;
                
                // Update message content in real-time
                await ctx.runMutation(internal.messages.updateContent, {
                  messageId: assistantMessageId,
                  content: fullContent,
                  isStreaming: true,
                  cursor: true,
                });
              }
            }

            // Extract usage if available
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || 0;
              outputTokens = chunk.usage.completion_tokens || 0;
            }
          }

          // Flush any remaining content
          const remaining = streamBuffer.flush();
          if (remaining) {
            fullContent += remaining;
          }
          break;
        }

        case "google": {
          const apiKey = args.apiKey || process.env.CONVEX_GOOGLE_API_KEY;
          if (!apiKey) throw new Error("Google API key required");

          const genAI = new GoogleGenAI({ apiKey });

          // Convert conversation history to Google AI format
          const contents = conversationHistory
            .filter((msg: any) => msg.role !== "system") // Filter out system messages
            .map((msg: any) => ({
              role: msg.role === "assistant" ? "model" : "user",
              parts: [{ text: msg.content }],
            }));

          // Add system prompt as first user message if provided
          if (args.systemPrompt) {
            const systemMsg = conversationHistory.find((msg: any) => msg.role === "system");
            if (systemMsg || args.systemPrompt) {
              contents.unshift({
                role: "user",
                parts: [{ text: `System: ${systemMsg?.content || args.systemPrompt}\n\nUser: ${contents[0]?.parts[0]?.text || ''}` }],
              });
              if (contents.length > 1) {
                contents.splice(1, 1); // Remove the duplicate first user message
              }
            }
          }

          const streamBuffer = new StreamBuffer();
          
          const stream = await genAI.models.generateContentStream({
            model: args.model,
            contents,
            config: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192,
            },
          });

          // The result is an async generator, iterate over it directly
          for await (const chunk of stream) {
            // Access the text property directly
            const text = chunk.text;
            if (text) {
              streamBuffer.add(text);
              
              if (streamBuffer.shouldFlush()) {
                const bufferedContent = streamBuffer.flush();
                fullContent += bufferedContent;
                
                await ctx.runMutation(internal.messages.updateContent, {
                  messageId: assistantMessageId,
                  content: fullContent,
                  isStreaming: true,
                  cursor: true,
                });
              }
            }
          }

          // Flush remaining
          const remaining = streamBuffer.flush();
          if (remaining) {
            fullContent += remaining;
          }

          // Token counts are not available in streaming mode with @google/genai
          // Set defaults for now
          inputTokens = 0;
          outputTokens = 0;
          break;
        }

        default:
          throw new Error(`Unsupported provider: ${args.provider}`);
      }

      // Finalize the message
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: sanitizeContent(fullContent),
        isStreaming: false,
        cursor: false,
        inputTokens,
        outputTokens,
      });

      return { success: true, messageId: assistantMessageId };
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      
      // Update message with error
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: `I encountered an error while generating a response: ${error.message}. Please try again or check your API settings.`,
        isStreaming: false,
        cursor: false,
      });

      throw error;
    }
  },
});

// Main action for sending messages with multi-model support
export const sendMessage = action({
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
          
          const streamBuffer = new StreamBuffer();
          
          const stream = await retryWithBackoff(async () => {
            return await client.chat.completions.create({
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
          });

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
              streamBuffer.add(delta);
              
              // Buffer updates for smoother UI
              if (streamBuffer.shouldFlush()) {
                const bufferedContent = streamBuffer.flush();
                fullContent += bufferedContent;
                
                // Update message content in real-time
                await ctx.runMutation(internal.messages.updateContent, {
                  messageId: assistantMessageId,
                  content: fullContent,
                  isStreaming: true,
                  cursor: true,
                });
              }
            }

            // Extract usage if available
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || 0;
              outputTokens = chunk.usage.completion_tokens || 0;
            }
          }

          // Flush any remaining content
          const remaining = streamBuffer.flush();
          if (remaining) {
            fullContent += remaining;
          }
          break;
        }

        case "google": {
          const apiKey = args.apiKey || process.env.CONVEX_GOOGLE_API_KEY;
          if (!apiKey) throw new Error("Google API key required");

          const genAI = new GoogleGenAI({ apiKey });

          // Convert conversation history to Google AI format
          const contents = conversationHistory
            .filter((msg: any) => msg.role !== "system") // Filter out system messages
            .map((msg: any) => ({
              role: msg.role === "assistant" ? "model" : "user",
              parts: [{ text: msg.content }],
            }));

          // Add system prompt as first user message if provided
          if (args.systemPrompt) {
            const systemMsg = conversationHistory.find((msg: any) => msg.role === "system");
            if (systemMsg || args.systemPrompt) {
              contents.unshift({
                role: "user",
                parts: [{ text: `System: ${systemMsg?.content || args.systemPrompt}\n\nUser: ${contents[0]?.parts[0]?.text || ''}` }],
              });
              if (contents.length > 1) {
                contents.splice(1, 1); // Remove the duplicate first user message
              }
            }
          }

          const streamBuffer = new StreamBuffer();
          
          const stream = await genAI.models.generateContentStream({
            model: args.model,
            contents,
            config: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192,
            },
          });

          // The result is an async generator, iterate over it directly
          for await (const chunk of stream) {
            // Access the text property directly
            const text = chunk.text;
            if (text) {
              streamBuffer.add(text);
              
              if (streamBuffer.shouldFlush()) {
                const bufferedContent = streamBuffer.flush();
                fullContent += bufferedContent;
                
                await ctx.runMutation(internal.messages.updateContent, {
                  messageId: assistantMessageId,
                  content: fullContent,
                  isStreaming: true,
                  cursor: true,
                });
              }
            }
          }

          // Flush remaining
          const remaining = streamBuffer.flush();
          if (remaining) {
            fullContent += remaining;
          }

          // Token counts are not available in streaming mode with @google/genai
          // Set defaults for now
          inputTokens = 0;
          outputTokens = 0;
          break;
        }

        default:
          throw new Error(`Unsupported provider: ${args.provider}`);
      }

      // Finalize the message
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: sanitizeContent(fullContent),
        isStreaming: false,
        cursor: false,
        inputTokens,
        outputTokens,
      });

      return { success: true, messageId: assistantMessageId };
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      
      // Update message with error
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: `I encountered an error while generating a response: ${error.message}. Please try again or check your API settings.`,
        isStreaming: false,
        cursor: false,
      });

      throw error;
    }
  },
});

// Image generation action
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
      let imageUrl = "";
      
      switch (provider) {
        case "openai": {
          const apiKey = args.apiKey || process.env.CONVEX_OPENAI_API_KEY;
          if (!apiKey) throw new Error("OpenAI API key required");

          const client = new OpenAI({ apiKey });
          
          const response = await client.images.generate({
            model: "dall-e-3",
            prompt: args.prompt,
            n: 1,
            size: size as any,
          });

          imageUrl = response.data?.[0]?.url || "";
          break;
        }
        
        default:
          throw new Error(`Image generation not supported for provider: ${provider}`);
      }

      // Update message with image
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: `Generated image for: "${args.prompt}"`,
        isStreaming: false,
        generatedImageUrl: imageUrl,
      });

      return { success: true, imageUrl };
    } catch (error: any) {
      console.error("Image Generation Error:", error);
      
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: `Failed to generate image: ${error.message}`,
        isStreaming: false,
      });

      throw error;
    }
  },
});

// Regenerate a response for a given message
export const regenerateResponse = action({
  args: {
    messageId: v.id("messages"),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    apiKey: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
  },
  returns: v.object({ 
    success: v.boolean(), 
    newMessageId: v.id("messages"),
  }),
  handler: async (ctx, args) => {
    // Get the original assistant message
    const originalMessage = await ctx.runQuery(internal.messages.getById, {
      messageId: args.messageId,
    });
    
    if (!originalMessage || originalMessage.role !== "assistant") {
      throw new Error("Can only regenerate assistant messages");
    }
    
    // Get the thread
    const thread = await ctx.runQuery(internal.threads.getById, {
      threadId: originalMessage.threadId,
    });
    
    if (!thread) {
      throw new Error("Thread not found");
    }
    
    // Get all messages in the thread
    const messages = await ctx.runQuery(api.messages.list, {
      threadId: originalMessage.threadId,
    });
    
    // Find the user message that prompted this response
    const messageIndex = messages.findIndex(m => m._id === args.messageId);
    if (messageIndex <= 0) {
      throw new Error("Could not find previous user message");
    }
    
    const userMessage = messages[messageIndex - 1];
    if (!userMessage || userMessage.role !== "user") {
      throw new Error("Previous message is not a user message");
    }
    
    // Create a new assistant message
    const newMessageId: Id<"messages"> = await ctx.runMutation(api.messages.create, {
      threadId: originalMessage.threadId,
      role: "assistant",
      content: "",
      isStreaming: true,
      cursor: true,
    });
    
    // Build conversation history up to the user message
    const conversationHistory = messages
      .slice(0, messageIndex)
      .map((msg) => ({
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
    
    // Generate the response (inline the logic here to avoid circular reference)
    try {
      const provider = args.provider || originalMessage.provider || thread.provider || 'openai';
      const model = args.model || originalMessage.model || thread.model || 'gpt-4o-mini';
      const apiKey = args.apiKey;
      
      // Stream response based on provider
      let fullContent = "";
      let inputTokens = 0;
      let outputTokens = 0;
      
      switch (provider) {
        case "openai":
        case "openrouter": {
          const finalApiKey = apiKey || process.env.CONVEX_OPENAI_API_KEY;
          if (!finalApiKey) throw new Error("OpenAI API key required");
          
          const baseURL = provider === "openrouter" 
            ? "https://openrouter.ai/api/v1" 
            : process.env.CONVEX_OPENAI_BASE_URL;
          
          const client = createOpenAIClient(finalApiKey, baseURL);
          const streamBuffer = new StreamBuffer();
          
          const stream = await retryWithBackoff(async () => {
            return await client.chat.completions.create({
              model,
              messages: conversationHistory,
              stream: true,
              ...(provider === "openrouter" && {
                headers: {
                  "HTTP-Referer": "https://c3chat.app",
                  "X-Title": "C3Chat",
                },
              }),
            });
          });
          
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content || "";
            if (delta) {
              streamBuffer.add(delta);
              
              if (streamBuffer.shouldFlush()) {
                const bufferedContent = streamBuffer.flush();
                fullContent += bufferedContent;
                
                await ctx.runMutation(internal.messages.updateContent, {
                  messageId: newMessageId,
                  content: fullContent,
                  isStreaming: true,
                  cursor: true,
                });
              }
            }
            
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || 0;
              outputTokens = chunk.usage.completion_tokens || 0;
            }
          }
          
          const remaining = streamBuffer.flush();
          if (remaining) {
            fullContent += remaining;
          }
          break;
        }
        
        case "google": {
          const finalApiKey = apiKey || process.env.CONVEX_GOOGLE_API_KEY;
          if (!finalApiKey) throw new Error("Google API key required");
          
          const genAI = new GoogleGenAI({ apiKey: finalApiKey });
          
          const contents = conversationHistory
            .filter((msg) => msg.role !== "system")
            .map((msg) => ({
              role: msg.role === "assistant" ? "model" : "user",
              parts: [{ text: msg.content }],
            }));
          
          // Add system prompt as first user message if provided
          const systemMsg = conversationHistory.find((msg) => msg.role === "system");
          if (systemMsg) {
            if (contents.length > 0) {
              contents[0] = {
                role: "user",
                parts: [{ text: `System: ${systemMsg.content}\n\nUser: ${contents[0]?.parts[0]?.text || ''}` }],
              };
            }
          }
          
          const streamBuffer = new StreamBuffer();
          
          const stream = await genAI.models.generateContentStream({
            model,
            contents,
            config: {
              temperature: 0.7,
              topK: 40,
              topP: 0.95,
              maxOutputTokens: 8192,
            },
          });
          
          for await (const chunk of stream) {
            const text = chunk.text;
            if (text) {
              streamBuffer.add(text);
              
              if (streamBuffer.shouldFlush()) {
                const bufferedContent = streamBuffer.flush();
                fullContent += bufferedContent;
                
                await ctx.runMutation(internal.messages.updateContent, {
                  messageId: newMessageId,
                  content: fullContent,
                  isStreaming: true,
                  cursor: true,
                });
              }
            }
          }
          
          const remaining = streamBuffer.flush();
          if (remaining) {
            fullContent += remaining;
          }
          break;
        }
        
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
      
      // Finalize the message
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: newMessageId,
        content: sanitizeContent(fullContent),
        isStreaming: false,
        cursor: false,
        inputTokens,
        outputTokens,
      });
      
      return { 
        success: true, 
        newMessageId,
      };
    } catch (error: any) {
      // Update message with error
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: newMessageId,
        content: `Error regenerating response: ${error.message}`,
        isStreaming: false,
        cursor: false,
      });
      throw error;
    }
  },
});

// Enhanced message sending with web search and knowledge base
export const sendMessageWithContext = action({
  args: {
    threadId: v.id("threads"),
    content: v.string(),
    provider: v.string(),
    model: v.string(),
    apiKey: v.optional(v.string()),
    attachmentIds: v.optional(v.array(v.id("attachments"))),
    systemPrompt: v.optional(v.string()),
    // Enhanced features
    enableWebSearch: v.optional(v.boolean()),
    searchQueries: v.optional(v.array(v.string())),
    useKnowledgeBase: v.optional(v.boolean()),
    projectId: v.optional(v.id("projects")),
  },
  returns: v.object({ 
    success: v.boolean(), 
    messageId: v.id("messages"),
    searchResults: v.optional(v.array(v.object({
      query: v.string(),
      results: v.array(v.object({
        title: v.string(),
        url: v.string(),
        snippet: v.string(),
      })),
    }))),
  }),
  handler: async (ctx, args) => {
    // For now, just use sendMessage directly
    // TODO: Implement web search and knowledge base features
    const userMessageId: Id<"messages"> = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "user",
      content: args.content,
    });

    // Generate AI response using local function
    const assistantMessageId: Id<"messages"> = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "assistant",
      content: "",
      isStreaming: true,
      cursor: true,
    });

    // TODO: Actually implement AI generation here
    await ctx.runMutation(internal.messages.updateContent, {
      messageId: assistantMessageId,
      content: "Web search and knowledge base features are not yet implemented.",
      isStreaming: false,
      cursor: false,
    });
    
    return { 
      success: true, 
      messageId: userMessageId,
      searchResults: undefined
    };
  },
});