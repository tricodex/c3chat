import { action } from "./_generated/server";
import { v } from "convex/values";
import { GoogleGenAI } from "@google/genai";

export const testGeminiVision = action({
  args: {
    apiKey: v.string(),
    model: v.string(),
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      console.log("🧪 Testing Gemini Vision with model:", args.model);
      
      // Initialize Gemini
      const genAI = new GoogleGenAI({ apiKey: args.apiKey });
      // Fetch image
      const response = await fetch(args.imageUrl);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      
      // Convert to base64
      const uint8Array = new Uint8Array(buffer);
      const chunks: string[] = [];
      const chunkSize = 8192;
      for (let i = 0; i < uint8Array.length; i += chunkSize) {
        const chunk = uint8Array.slice(i, i + chunkSize);
        chunks.push(String.fromCharCode(...chunk));
      }
      const base64 = btoa(chunks.join(''));
      
      console.log("📸 Image converted to base64, length:", base64.length);
      
      // Create request with image
      const request = {
        contents: [{
          role: "user",
          parts: [
            { text: "What do you see in this image? Please describe it in detail." },
            {
              inlineData: {
                mimeType: "image/jpeg", // Assuming JPEG, adjust if needed
                data: base64
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        }
      };
      
      console.log("📤 Sending request to Gemini:", {
        model: args.model,
        partsCount: request.contents[0].parts.length,
        hasText: true,
        hasImage: true,
        imageDataLength: base64.length
      });
      
      // Generate response using the new API
      const result = await genAI.models.generateContent({
        model: args.model,
        ...request
      });
      const response_text = result.text || "No response generated";
      
      console.log("✅ Gemini response:", response_text);
      
      return {
        success: true,
        response: response_text,
        model: args.model,
      };
    } catch (error: any) {
      console.error("❌ Test failed:", error);
      return {
        success: false,
        error: error.message,
        model: args.model,
      };
    }
  },
});