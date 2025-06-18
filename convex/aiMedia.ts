import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";
import { GoogleGenAI, Modality } from "@google/genai";

// Helper to create OpenAI client
const createOpenAIClient = (apiKey: string, baseURL?: string) => {
  return new OpenAI({
    apiKey,
    baseURL,
    dangerouslyAllowBrowser: false,
  });
};

// Generate image using AI models
export const generateImage = action({
  args: {
    threadId: v.id("threads"),
    prompt: v.string(),
    provider: v.string(),
    model: v.string(),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Create user message
    const userMessageId = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "user",
      content: `/image ${args.prompt}`,
    });

    // Create assistant message
    const assistantMessageId = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "assistant",
      content: "",
      isStreaming: true,
      cursor: true,
    });

    try {
      if (args.provider === "google") {
        const apiKey = args.apiKey || process.env.CONVEX_GOOGLE_API_KEY;
        if (!apiKey) throw new Error("Google API key required");

        const ai = new GoogleGenAI({ apiKey });

        // Check if using the preview image generation model
        if (args.model === "gemini-2.0-flash-preview-image-generation") {
          // This model supports native image generation through the API
          await ctx.runMutation(internal.messages.updateContent, {
            messageId: assistantMessageId,
            content: "🎨 Generating image with Gemini...",
            isStreaming: true,
            cursor: true,
          });

          try {
            const response = await ai.models.generateContent({
              model: "gemini-2.0-flash-preview-image-generation",
              contents: args.prompt,
              config: {
                responseModalities: [Modality.TEXT, Modality.IMAGE],
              },
            });

            // Process the response
            let generatedImageUrl = "";
            let responseText = "";
            
            if (response.candidates && response.candidates.length > 0 && response.candidates[0].content && response.candidates[0].content.parts) {
              for (const part of response.candidates[0].content.parts) {
                if (part.text) {
                  responseText += part.text;
                } else if (part.inlineData) {
                  // Convert base64 to data URL
                  const mimeType = part.inlineData.mimeType || "image/png";
                  generatedImageUrl = `data:${mimeType};base64,${part.inlineData.data}`;
                }
              }
            }

            await ctx.runMutation(internal.messages.updateContent, {
              messageId: assistantMessageId,
              content: responseText || `Generated image for: "${args.prompt}"`,
              isStreaming: false,
              cursor: false,
              generatedImageUrl: generatedImageUrl,
            });
          } catch (error: any) {
            console.error("Gemini image generation error:", error);
            await ctx.runMutation(internal.messages.updateContent, {
              messageId: assistantMessageId,
              content: `🎨 Image generation failed. This model may not be available in your region or with your API plan.\n\nError: ${error.message}\n\nTry using OpenAI's DALL-E instead.`,
              isStreaming: false,
              cursor: false,
            });
          }
        } else if (args.model === "imagen-3.0-generate-002") {
          // Imagen 3 requires paid tier and uses different API method
          await ctx.runMutation(internal.messages.updateContent, {
            messageId: assistantMessageId,
            content: "🎨 Attempting to generate image with Imagen 3...",
            isStreaming: true,
            cursor: true,
          });

          try {
            // Note: This requires the paid tier of Gemini API
            const response = await ai.models.generateImages({
              model: 'imagen-3.0-generate-002',
              prompt: args.prompt,
              config: {
                numberOfImages: 1,
                aspectRatio: "1:1",
              },
            });

            if (response.generatedImages && response.generatedImages.length > 0) {
              const generatedImage = response.generatedImages[0];
              if (generatedImage.image && generatedImage.image.imageBytes) {
                const imageBytes = generatedImage.image.imageBytes;
                const generatedImageUrl = `data:image/png;base64,${imageBytes}`;
                
                await ctx.runMutation(internal.messages.updateContent, {
                  messageId: assistantMessageId,
                  content: `Generated image with Imagen 3 for: "${args.prompt}"`,
                  isStreaming: false,
                  cursor: false,
                  generatedImageUrl: generatedImageUrl,
                });
              }
            }
          } catch (error: any) {
            console.error("Imagen 3 generation error:", error);
            await ctx.runMutation(internal.messages.updateContent, {
              messageId: assistantMessageId,
              content: `🎨 Imagen 3 is only available on the paid tier of the Gemini API.\n\nError: ${error.message}\n\n**What "paid tier" means:**\n- You need a Google Cloud account with billing enabled\n- Your API key must be from a project with active billing\n- This is different from Vertex AI (which is a separate Google Cloud service)\n\nTo use Imagen 3:\n1. Go to console.cloud.google.com\n2. Create/select a project and enable billing\n3. Enable the Gemini API\n4. Create an API key from that billed project\n\nAlternatively, try:\n- **Gemini 2.0 Flash Image Gen** (works on free tier)\n- **OpenAI's DALL-E** (if you have an OpenAI API key)`,
              isStreaming: false,
              cursor: false,
            });
          }
        } else {
          // Other models don't support image generation
          throw new Error(`Model ${args.model} doesn't support image generation.`);
        }
        
        return { success: true };
      } else if (args.provider === "openai") {
        const apiKey = args.apiKey || process.env.CONVEX_OPENAI_API_KEY;
        if (!apiKey) throw new Error("OpenAI API key required");

        const client = createOpenAIClient(apiKey);
        
        await ctx.runMutation(internal.messages.updateContent, {
          messageId: assistantMessageId,
          content: "🎨 Generating image with DALL-E...",
          isStreaming: true,
          cursor: true,
        });

        const response = await client.images.generate({
          model: "dall-e-3",
          prompt: args.prompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
        });

        if (response.data && response.data[0]) {
          const imageUrl = response.data[0].url || "";
          await ctx.runMutation(internal.messages.updateContent, {
            messageId: assistantMessageId,
            content: `Generated image for: "${args.prompt}"`,
            isStreaming: false,
            cursor: false,
            generatedImageUrl: imageUrl,
          });
        }
      } else {
        throw new Error(`Image generation not supported for provider: ${args.provider}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error("Image generation error:", error);
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: `Failed to generate image: ${error.message}`,
        isStreaming: false,
        cursor: false,
      });
      throw error;
    }
  },
});

// Generate video using AI models
export const generateVideo = action({
  args: {
    threadId: v.id("threads"),
    prompt: v.string(),
    provider: v.string(),
    model: v.string(),
    apiKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Create user message
    const userMessageId = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "user",
      content: `/video ${args.prompt}`,
    });

    // Create assistant message
    const assistantMessageId = await ctx.runMutation(api.messages.create, {
      threadId: args.threadId,
      role: "assistant",
      content: "",
      isStreaming: true,
      cursor: true,
    });

    try {
      if (args.provider === "google") {
        // For Google, we'll provide a message that video generation requires separate API access
        await ctx.runMutation(internal.messages.updateContent, {
          messageId: assistantMessageId,
          content: `🎬 Veo 2 is only available on the paid tier of the Gemini API.\n\n**What you need:**\n- A Google Cloud account with billing enabled\n- API key from a project with active billing\n- $0.35 per second of generated video\n\nVeo 2 supports both text and image inputs for high-quality video generation.\n\n**Note:** Even with a paid account, Veo 2 might require additional approval or access.\n\nFor now, you can:\n- Use Gemini models for text generation and understanding\n- Upload videos to analyze them with Gemini's multimodal capabilities\n- Use third-party video generation services`,
          isStreaming: false,
          cursor: false,
        });
        
        return { success: true };
      } else {
        throw new Error(`Video generation not supported for provider: ${args.provider}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error("Video generation error:", error);
      await ctx.runMutation(internal.messages.updateContent, {
        messageId: assistantMessageId,
        content: `Failed to generate video: ${error.message}`,
        isStreaming: false,
        cursor: false,
      });
      throw error;
    }
  },
});