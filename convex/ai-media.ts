import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";

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
      if (args.provider === "google" && args.model.startsWith("imagen")) {
        const apiKey = args.apiKey || process.env.CONVEX_GOOGLE_API_KEY;
        if (!apiKey) throw new Error("Google API key required");

        // Update status
        await ctx.runMutation(internal.messages.updateContent, {
          messageId: assistantMessageId,
          content: "🎨 Generating image with " + args.model + "...",
          isStreaming: true,
          cursor: true,
        });

        // Use Google's Imagen API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateImage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            prompt: args.prompt,
            number_of_images: 1,
            safety_settings: [
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_ONLY_HIGH"
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_ONLY_HIGH"
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_ONLY_HIGH"
              },
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_ONLY_HIGH"
              }
            ],
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Imagen API error: ${error}`);
        }

        const data = await response.json();
        
        if (data.images && data.images.length > 0) {
          const imageData = data.images[0];
          // Store the base64 image data or URL
          const imageUrl = `data:image/png;base64,${imageData.image}`;
          
          await ctx.runMutation(internal.messages.updateContent, {
            messageId: assistantMessageId,
            content: `Generated image for: "${args.prompt}"`,
            isStreaming: false,
            cursor: false,
            generatedImageUrl: imageUrl,
          });
        } else {
          throw new Error("No image generated");
        }
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
      if (args.provider === "google" && args.model.startsWith("veo")) {
        const apiKey = args.apiKey || process.env.CONVEX_GOOGLE_API_KEY;
        if (!apiKey) throw new Error("Google API key required");

        // Update status
        await ctx.runMutation(internal.messages.updateContent, {
          messageId: assistantMessageId,
          content: "🎬 Generating video with " + args.model + "...\n\nThis may take a few minutes.",
          isStreaming: true,
          cursor: true,
        });

        // Use Google's Veo API
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateVideo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            prompt: args.prompt,
            video_generation_config: {
              duration: "5s", // 5 second video
              fps: 24,
              resolution: "720p",
            },
            safety_settings: [
              {
                category: "HARM_CATEGORY_HATE_SPEECH",
                threshold: "BLOCK_ONLY_HIGH"
              },
              {
                category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                threshold: "BLOCK_ONLY_HIGH"
              },
              {
                category: "HARM_CATEGORY_DANGEROUS_CONTENT",
                threshold: "BLOCK_ONLY_HIGH"
              },
              {
                category: "HARM_CATEGORY_HARASSMENT",
                threshold: "BLOCK_ONLY_HIGH"
              }
            ],
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`Veo API error: ${error}`);
        }

        const data = await response.json();
        
        if (data.video_url) {
          await ctx.runMutation(internal.messages.updateContent, {
            messageId: assistantMessageId,
            content: `🎬 Generated video for: "${args.prompt}"\n\n[Video URL: ${data.video_url}]`,
            isStreaming: false,
            cursor: false,
            generatedVideoUrl: data.video_url,
          });
        } else {
          throw new Error("No video generated");
        }
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