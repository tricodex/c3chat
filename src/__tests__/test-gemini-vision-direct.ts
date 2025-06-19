// Direct test of Gemini Vision API
import { GoogleGenAI } from "@google/genai";

async function testGeminiVision() {
  const apiKey = process.env.GOOGLE_API_KEY || "YOUR_API_KEY_HERE";
  const genAI = new GoogleGenAI({ apiKey });
  
  // Test with gemini-2.0-flash
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  
  // Simple test image - a red square
  const redSquareBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFklEQVR42mP8/5+hnoEIwDiqkL4KAcT9GO0U4BxoAAAAAElFTkSuQmCC";
  
  const request = {
    contents: [{
      role: "user",
      parts: [
        { text: "What do you see in this image? Please describe it." },
        {
          inlineData: {
            mimeType: "image/png",
            data: redSquareBase64
          }
        }
      ]
    }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
    }
  };
  
  console.log("🧪 Testing Gemini Vision API...");
  console.log("Model:", "gemini-2.0-flash");
  console.log("Request structure:", JSON.stringify(request, null, 2));
  
  try {
    const result = await model.generateContent(request);
    const response = result.response.text();
    console.log("✅ Success! Response:", response);
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

// Run the test
testGeminiVision().catch(console.error);