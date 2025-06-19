import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import { StreamBuffer, sanitizeContent, retryWithBackoff } from "./aiUtils";


// Helper function to fetch image as base64
async function fetchImageAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    
    // Convert ArrayBuffer to base64 without using Node.js Buffer
    // Convex runs in a V8 isolate without Node.js APIs
    const uint8Array = new Uint8Array(buffer);
    const chunks: string[] = [];
    
    // Process in chunks to avoid "Maximum call stack size exceeded" for large images
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.slice(i, i + chunkSize);
      chunks.push(String.fromCharCode(...chunk));
    }
    
    const base64 = btoa(chunks.join(''));
    return base64;
  } catch (error) {
    console.error('Failed to fetch image:', error);
    throw error;
  }
}

// Web search interface for TAVILY
interface WebSearchResult {
  title: string;
  url: string;
  content: string;
  score?: number;
}

interface TavilySearchResponse {
  query: string;
  follow_up_questions?: string[];
  answer?: string;
  images?: any[];
  results: {
    title: string;
    url: string;
    content: string;
    score: number;
  }[];
}

// Web search function using TAVILY API
const searchWeb = async (queries: string[], apiKey?: string): Promise<{ query: string; results: WebSearchResult[] }[]> => {
  const tavilyApiKey = apiKey || process.env.CONVEX_TAVILY_API_KEY;
  if (!tavilyApiKey) {
    console.warn("TAVILY_API_KEY not configured, skipping web search");
    return [];
  }

  const searchResults: { query: string; results: WebSearchResult[] }[] = [];

  for (const query of queries) {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${tavilyApiKey}`,
        },
        body: JSON.stringify({
          query,
          search_depth: "basic",
          include_answer: true,
          include_images: false,
          include_raw_content: false,
          max_results: 5,
        }),
      });

      if (!response.ok) {
        console.error(`Tavily search failed for query "${query}":`, response.status, response.statusText);
        continue;
      }

      const data: TavilySearchResponse = await response.json();
      
      const results: WebSearchResult[] = data.results.map(result => ({
        title: result.title,
        url: result.url,
        content: result.content,
        score: result.score,
      }));

      searchResults.push({ query, results });
      
      console.log(`🔍 Web search completed for "${query}": ${results.length} results`);
    } catch (error) {
      console.error(`Error searching web for query "${query}":`, error);
    }
  }

  return searchResults;
};

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
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
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
      // Get conversation history with attachments
      const messages = await ctx.runQuery(api.messages.list, {
        threadId: args.threadId,
      });

      console.log("🔍 Retrieved messages from Convex:", {
        count: messages.length,
        messages: messages.map((m: any) => ({
          id: m._id,
          role: m.role,
          hasAttachments: !!(m.attachments && m.attachments.length > 0),
          attachmentCount: m.attachments?.length || 0,
          attachments: m.attachments?.map((a: any) => ({
            filename: a.filename,
            contentType: a.contentType,
            hasUrl: !!a.url
          }))
        }))
      });

      // Convert to provider format (exclude the streaming message we just created)
      const conversationHistory = await Promise.all(
        messages
          .filter((msg: any) => msg._id !== assistantMessageId)
          .map(async (msg: any) => {
            // For messages with attachments, we need to format them differently for multimodal models
            if (msg.attachments && msg.attachments.length > 0 && args.provider === "google") {
              // For Google Gemini, format with parts array for multimodal
              const parts: any[] = [];
              
              // Add text content first
              if (msg.content) {
                parts.push({ text: msg.content });
              }
              
              // Add image attachments
              for (const attachment of msg.attachments) {
                if (attachment.contentType.startsWith('image/')) {
                  try {
                    console.log(`📸 Processing image attachment for Gemini:`, {
                      filename: attachment.filename,
                      contentType: attachment.contentType,
                      url: attachment.url
                    });
                    
                    // Fetch image data as base64 for Gemini
                    const base64Data = await fetchImageAsBase64(attachment.url);
                    console.log(`✅ Image converted to base64, length: ${base64Data.length}`);
                    
                    parts.push({
                      inlineData: {
                        mimeType: attachment.contentType,
                        data: base64Data
                      }
                    });
                  } catch (error) {
                    console.error('Failed to process image attachment:', error);
                    // Fall back to text description
                    parts.push({ text: `\n[Image attached: ${attachment.filename} - failed to load]\n` });
                  }
                } else if (attachment.extractedText) {
                  // For PDFs and documents, add extracted text
                  parts.push({ text: `\n[Attached ${attachment.filename}]:\n${attachment.extractedText}\n` });
                }
              }
              
              console.log(`📨 Prepared multimodal message with ${parts.length} parts for Gemini`, {
                role: msg.role,
                partsDetail: parts.map((p, idx) => ({
                  index: idx,
                  type: p.text ? 'text' : p.inlineData ? 'image' : 'unknown',
                  textLength: p.text?.length,
                  imageDataLength: p.inlineData?.data?.length,
                  mimeType: p.inlineData?.mimeType
                }))
              });
              
              return {
                role: msg.role as "user" | "assistant" | "system",
                parts,
              };
            } else if (msg.attachments && msg.attachments.length > 0) {
              // For other providers, append attachment info to content
              let enhancedContent = msg.content;
              
              for (const attachment of msg.attachments) {
                if (attachment.extractedText) {
                  enhancedContent += `\n\n[Attached ${attachment.filename}]:\n${attachment.extractedText}`;
                } else if (attachment.contentType.startsWith('image/')) {
                  enhancedContent += `\n\n[Image attached: ${attachment.filename}]`;
                }
              }
              
              return {
                role: msg.role as "user" | "assistant" | "system",
                content: enhancedContent,
              };
            } else {
              // No attachments, return as is
              return {
                role: msg.role as "user" | "assistant" | "system",
                content: msg.content,
              };
            }
          })
      );

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
          
          // Format messages for OpenAI vision models if needed
          const openAIMessages = conversationHistory.map((msg: any) => {
            if (msg.parts && args.model.includes('vision')) {
              // Convert multimodal format to OpenAI format
              const content: any[] = [];
              for (const part of msg.parts) {
                if (part.text) {
                  content.push({ type: 'text', text: part.text });
                } else if (part.inlineData) {
                  content.push({
                    type: 'image_url',
                    image_url: {
                      url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                    }
                  });
                }
              }
              return { role: msg.role, content };
            }
            return msg;
          });

          const stream = await retryWithBackoff(async () => {
            return await client.chat.completions.create({
              model: args.model,
              messages: openAIMessages,
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

          // Check if this is a media-only generation model
          const mediaOnlyModels = ['imagen-3.0-generate-002', 'veo-2.0-generate-001'];
          if (mediaOnlyModels.includes(args.model)) {
            // Update the assistant message with helpful error
            await ctx.runMutation(internal.messages.updateContent, {
              messageId: assistantMessageId,
              content: `❌ ${args.model === 'imagen-3.0-generate-002' ? 'Imagen 3' : 'Veo 2'} is for ${args.model === 'imagen-3.0-generate-002' ? 'image' : 'video'} generation only.\n\nTo generate ${args.model === 'imagen-3.0-generate-002' ? 'images' : 'videos'}:\n1. Keep this model selected\n2. Use the \`/${args.model === 'imagen-3.0-generate-002' ? 'image' : 'video'} <your prompt>\` command\n\nFor regular chat, please select a text model like:\n- Gemini 2.5 Flash\n- Gemini 2.5 Pro\n- Gemini 2.0 Flash`,
              isStreaming: false,
              cursor: false,
            });
            return; // Don't throw, just return early
          }

          // Create generation config
          const generationConfig = {
            temperature: args.temperature || 0.7,
            maxOutputTokens: args.maxTokens || 8192,
          };

          // Convert conversation history to Google AI format
          const contents = conversationHistory
            .filter((msg: any) => msg.role !== "system") // Filter out system messages
            .map((msg: any) => {
              // If message already has parts (multimodal), use them
              if (msg.parts) {
                return {
                  role: msg.role === "assistant" ? "model" : "user",
                  parts: msg.parts,
                };
              }
              // Otherwise, create text part
              return {
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
              };
            });

          // Add system prompt as first user message if provided
          if (args.systemPrompt) {
            const systemMsg = conversationHistory.find((msg: any) => msg.role === "system");
            if (systemMsg || args.systemPrompt) {
              const firstUserMsg = contents[0];
              if (firstUserMsg && firstUserMsg.role === "user") {
                // Prepend system prompt to first user message
                const systemText = `System: ${systemMsg?.content || args.systemPrompt}\n\nUser: `;
                if (firstUserMsg.parts[0] && firstUserMsg.parts[0].text) {
                  firstUserMsg.parts[0].text = systemText + firstUserMsg.parts[0].text;
                } else {
                  // If first part isn't text, add system prompt as first part
                  firstUserMsg.parts.unshift({ text: systemText });
                }
              } else {
                // No user messages, create one with system prompt
                contents.unshift({
                  role: "user",
                  parts: [{ text: `System: ${systemMsg?.content || args.systemPrompt}` }],
                });
              }
            }
          }

          const streamBuffer = new StreamBuffer();
          
          // Configure generation based on model type
          const config: any = {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          };
          
          // Add thinkingConfig for Gemini 2.5 models
          if (args.model.includes('2.5')) {
            config.thinkingConfig = {
              thinkingBudget: 16384 // Default thinking budget for 2.5 models
            };
          }
          
          const stream = await genAI.models.generateContentStream({
            model: args.model,
            contents,
            config,
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
    temperature: v.optional(v.number()),
    maxTokens: v.optional(v.number()),
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
      // Get conversation history with attachments
      const messages = await ctx.runQuery(api.messages.list, {
        threadId: args.threadId,
      });

      console.log("🔍 Retrieved messages from Convex:", {
        count: messages.length,
        messages: messages.map((m: any) => ({
          id: m._id,
          role: m.role,
          hasAttachments: !!(m.attachments && m.attachments.length > 0),
          attachmentCount: m.attachments?.length || 0,
          attachments: m.attachments?.map((a: any) => ({
            filename: a.filename,
            contentType: a.contentType,
            hasUrl: !!a.url
          }))
        }))
      });

      // Convert to provider format (exclude the streaming message we just created)
      const conversationHistory = await Promise.all(
        messages
          .filter((msg: any) => msg._id !== assistantMessageId)
          .map(async (msg: any) => {
            // For messages with attachments, we need to format them differently for multimodal models
            if (msg.attachments && msg.attachments.length > 0 && args.provider === "google") {
              // For Google Gemini, format with parts array for multimodal
              const parts: any[] = [];
              
              // Add text content first
              if (msg.content) {
                parts.push({ text: msg.content });
              }
              
              // Add image attachments
              for (const attachment of msg.attachments) {
                if (attachment.contentType.startsWith('image/')) {
                  try {
                    console.log(`📸 Processing image attachment for Gemini:`, {
                      filename: attachment.filename,
                      contentType: attachment.contentType,
                      url: attachment.url
                    });
                    
                    // Fetch image data as base64 for Gemini
                    const base64Data = await fetchImageAsBase64(attachment.url);
                    console.log(`✅ Image converted to base64, length: ${base64Data.length}`);
                    
                    parts.push({
                      inlineData: {
                        mimeType: attachment.contentType,
                        data: base64Data
                      }
                    });
                  } catch (error) {
                    console.error('Failed to process image attachment:', error);
                    // Fall back to text description
                    parts.push({ text: `\n[Image attached: ${attachment.filename} - failed to load]\n` });
                  }
                } else if (attachment.extractedText) {
                  // For PDFs and documents, add extracted text
                  parts.push({ text: `\n[Attached ${attachment.filename}]:\n${attachment.extractedText}\n` });
                }
              }
              
              console.log(`📨 Prepared multimodal message with ${parts.length} parts for Gemini`, {
                role: msg.role,
                partsDetail: parts.map((p, idx) => ({
                  index: idx,
                  type: p.text ? 'text' : p.inlineData ? 'image' : 'unknown',
                  textLength: p.text?.length,
                  imageDataLength: p.inlineData?.data?.length,
                  mimeType: p.inlineData?.mimeType
                }))
              });
              
              return {
                role: msg.role as "user" | "assistant" | "system",
                parts,
              };
            } else if (msg.attachments && msg.attachments.length > 0) {
              // For other providers, append attachment info to content
              let enhancedContent = msg.content;
              
              for (const attachment of msg.attachments) {
                if (attachment.extractedText) {
                  enhancedContent += `\n\n[Attached ${attachment.filename}]:\n${attachment.extractedText}`;
                } else if (attachment.contentType.startsWith('image/')) {
                  enhancedContent += `\n\n[Image attached: ${attachment.filename}]`;
                }
              }
              
              return {
                role: msg.role as "user" | "assistant" | "system",
                content: enhancedContent,
              };
            } else {
              // No attachments, return as is
              return {
                role: msg.role as "user" | "assistant" | "system",
                content: msg.content,
              };
            }
          })
      );

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
          
          // Format messages for OpenAI vision models if needed
          const openAIMessages = conversationHistory.map((msg: any) => {
            if (msg.parts && args.model.includes('vision')) {
              // Convert multimodal format to OpenAI format
              const content: any[] = [];
              for (const part of msg.parts) {
                if (part.text) {
                  content.push({ type: 'text', text: part.text });
                } else if (part.inlineData) {
                  content.push({
                    type: 'image_url',
                    image_url: {
                      url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
                    }
                  });
                }
              }
              return { role: msg.role, content };
            }
            return msg;
          });

          const stream = await retryWithBackoff(async () => {
            return await client.chat.completions.create({
              model: args.model,
              messages: openAIMessages,
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

          // Check if this is a media-only generation model
          const mediaOnlyModels = ['imagen-3.0-generate-002', 'veo-2.0-generate-001'];
          if (mediaOnlyModels.includes(args.model)) {
            // Update the assistant message with helpful error
            await ctx.runMutation(internal.messages.updateContent, {
              messageId: assistantMessageId,
              content: `❌ ${args.model === 'imagen-3.0-generate-002' ? 'Imagen 3' : 'Veo 2'} is for ${args.model === 'imagen-3.0-generate-002' ? 'image' : 'video'} generation only.\n\nTo generate ${args.model === 'imagen-3.0-generate-002' ? 'images' : 'videos'}:\n1. Keep this model selected\n2. Use the \`/${args.model === 'imagen-3.0-generate-002' ? 'image' : 'video'} <your prompt>\` command\n\nFor regular chat, please select a text model like:\n- Gemini 2.5 Flash\n- Gemini 2.5 Pro\n- Gemini 2.0 Flash`,
              isStreaming: false,
              cursor: false,
            });
            return; // Don't throw, just return early
          }

          // Create generation config
          const generationConfig = {
            temperature: args.temperature || 0.7,
            maxOutputTokens: args.maxTokens || 8192,
          };

          // Convert conversation history to Google AI format
          const contents = conversationHistory
            .filter((msg: any) => msg.role !== "system") // Filter out system messages
            .map((msg: any) => {
              // If message already has parts (multimodal), use them
              if (msg.parts) {
                return {
                  role: msg.role === "assistant" ? "model" : "user",
                  parts: msg.parts,
                };
              }
              // Otherwise, create text part
              return {
                role: msg.role === "assistant" ? "model" : "user",
                parts: [{ text: msg.content }],
              };
            });

          // Add system prompt as first user message if provided
          if (args.systemPrompt) {
            const systemMsg = conversationHistory.find((msg: any) => msg.role === "system");
            if (systemMsg || args.systemPrompt) {
              const firstUserMsg = contents[0];
              if (firstUserMsg && firstUserMsg.role === "user") {
                // Prepend system prompt to first user message
                const systemText = `System: ${systemMsg?.content || args.systemPrompt}\n\nUser: `;
                if (firstUserMsg.parts[0] && firstUserMsg.parts[0].text) {
                  firstUserMsg.parts[0].text = systemText + firstUserMsg.parts[0].text;
                } else {
                  // If first part isn't text, add system prompt as first part
                  firstUserMsg.parts.unshift({ text: systemText });
                }
              } else {
                // No user messages, create one with system prompt
                contents.unshift({
                  role: "user",
                  parts: [{ text: `System: ${systemMsg?.content || args.systemPrompt}` }],
                });
              }
            }
          }

          const streamBuffer = new StreamBuffer();
          
          // Configure generation based on model type
          const config: any = {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          };
          
          // Add thinkingConfig for Gemini 2.5 models
          if (args.model.includes('2.5')) {
            config.thinkingConfig = {
              thinkingBudget: 16384 // Default thinking budget for 2.5 models
            };
          }
          
          const stream = await genAI.models.generateContentStream({
            model: args.model,
            contents,
            config,
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
          
          // Configure generation based on model type
          const config: any = {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          };
          
          // Add thinkingConfig for Gemini 2.5 models
          if (model.includes('2.5')) {
            config.thinkingConfig = {
              thinkingBudget: 16384 // Default thinking budget for 2.5 models
            };
          }
          
          const stream = await genAI.models.generateContentStream({
            model,
            contents,
            config,
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
    // Create user message first
    const userMessageId: Id<"messages"> = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "user",
      content: args.content,
    });

    // Create assistant message for streaming response
    const assistantMessageId: Id<"messages"> = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "assistant",
      content: "",
      isStreaming: true,
      cursor: true,
    });

    try {
      let searchResults: { query: string; results: WebSearchResult[] }[] = [];
      let enrichedContent = args.content;

      // Perform web search if enabled
      if (args.enableWebSearch && args.searchQueries && args.searchQueries.length > 0) {
        await ctx.runMutation(internal.messages.updateContent, {
          messageId: assistantMessageId,
          content: "🔍 Searching the web...",
          isStreaming: true,
          cursor: true,
        });

        searchResults = await searchWeb(args.searchQueries);

        if (searchResults.length > 0) {
          // Enhance the user's query with search results
          const searchContext = searchResults
            .map(searchResult => {
              const topResults = searchResult.results.slice(0, 3);
              return `Search for "${searchResult.query}":\n${topResults
                .map(result => `- ${result.title}: ${result.content.substring(0, 200)}...`)
                .join('\n')}`;
            })
            .join('\n\n');

          enrichedContent = `User question: ${args.content}\n\nWeb search results:\n${searchContext}\n\nPlease provide a comprehensive answer based on the user's question and the search results above.`;
        }
      }

      // Update status
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: "💭 Generating response...",
        isStreaming: true,
        cursor: true,
      });

      // Get conversation history for context
      const messages = await ctx.runQuery(api.messages.list, {
        threadId: args.threadId,
      });

      // Filter out the streaming assistant message and build conversation history
      const conversationHistory = messages
        .filter((msg: any) => msg._id !== assistantMessageId)
        .map((msg: any) => ({
          role: msg.role as "user" | "assistant" | "system",
          content: msg._id === userMessageId ? enrichedContent : msg.content,
        }));

      // Add system prompt if provided
      if (args.systemPrompt) {
        conversationHistory.unshift({
          role: "system",
          content: args.systemPrompt,
        });
      }

      // Generate AI response
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
          const apiKey = args.apiKey || process.env.CONVEX_GOOGLE_API_KEY;
          if (!apiKey) throw new Error("Google API key required");

          const genAI = new GoogleGenAI({ apiKey });

          const contents = conversationHistory
            .filter((msg: any) => msg.role !== "system")
            .map((msg: any) => ({
              role: msg.role === "assistant" ? "model" : "user",
              parts: [{ text: msg.content }],
            }));

          if (args.systemPrompt) {
            const systemMsg = conversationHistory.find((msg: any) => msg.role === "system");
            if (systemMsg && contents.length > 0) {
              contents[0] = {
                role: "user",
                parts: [{ text: `System: ${systemMsg.content}\n\nUser: ${contents[0]?.parts[0]?.text || ''}` }],
              };
            }
          }

          const streamBuffer = new StreamBuffer();
          
          // Configure generation based on model type
          const config: any = {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
          };
          
          // Add thinkingConfig for Gemini 2.5 models
          if (args.model.includes('2.5')) {
            config.thinkingConfig = {
              thinkingBudget: 16384 // Default thinking budget for 2.5 models
            };
          }
          
          const stream = await genAI.models.generateContentStream({
            model: args.model,
            contents,
            config,
          });

          for await (const chunk of stream) {
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

          const remaining = streamBuffer.flush();
          if (remaining) {
            fullContent += remaining;
          }
          break;
        }

        default:
          throw new Error(`Unsupported provider: ${args.provider}`);
      }

      // Finalize the assistant message
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: sanitizeContent(fullContent),
        isStreaming: false,
        cursor: false,
        inputTokens,
        outputTokens,
      });

      // Format search results for return
      const formattedSearchResults = searchResults.map(sr => ({
        query: sr.query,
        results: sr.results.map(r => ({
          title: r.title,
          url: r.url,
          snippet: r.content.substring(0, 200) + "...",
        })),
      }));

      return { 
        success: true, 
        messageId: userMessageId,
        searchResults: formattedSearchResults.length > 0 ? formattedSearchResults : undefined,
      };

    } catch (error: any) {
      // Update assistant message with error
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: `Error: ${error.message}`,
        isStreaming: false,
        cursor: false,
      });

      return { 
        success: false, 
        messageId: userMessageId,
        searchResults: undefined,
      };
    }
  },
});