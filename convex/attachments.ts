import { mutation, query, action, internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { getAuthUserId } from "@convex-dev/auth/server";

// Generate upload URL for file storage
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Generate a short-lived upload URL
    return await ctx.storage.generateUploadUrl();
  },
});

// Store file metadata after upload
export const createAttachment = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    threadId: v.optional(v.id("threads")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // If threadId provided, verify ownership
    if (args.threadId) {
      const thread = await ctx.db.get(args.threadId);
      if (!thread || thread.userId !== userId) {
        throw new Error("Thread not found");
      }
    }

    // Create attachment record
    const attachmentId = await ctx.db.insert("attachments", {
      storageId: args.storageId,
      filename: args.filename,
      contentType: args.contentType,
      size: args.size,
      threadId: args.threadId,
      messageId: undefined as any, // Will be linked when message is sent
      uploadedAt: Date.now(),
    });

    // Schedule processing based on file type
    if (args.contentType === "application/pdf") {
      await ctx.scheduler.runAfter(0, internal.attachments.processPdf, {
        attachmentId,
        storageId: args.storageId,
      });
    } else if (args.contentType.startsWith("image/")) {
      await ctx.scheduler.runAfter(0, internal.attachments.processImage, {
        attachmentId,
        storageId: args.storageId,
      });
    }

    return attachmentId;
  },
});

// Process PDF files
export const processPdf = internalAction({
  args: {
    attachmentId: v.id("attachments"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    try {
      const blob = await ctx.storage.get(args.storageId);
      if (!blob) return;

      // In production, use a PDF parsing library like pdf-parse
      // For now, we'll simulate text extraction
      const simulatedText = `Extracted text from PDF: ${args.attachmentId}
      
This is where the actual PDF content would be extracted using a library like pdf-parse.
The extracted text can then be used for:
- Adding context to AI conversations
- Searching within documents
- Creating summaries`;

      await ctx.runMutation(internal.attachments.updateProcessedData, {
        attachmentId: args.attachmentId,
        extractedText: simulatedText,
        metadata: {
          processed: true,
          processedAt: Date.now(),
        },
      });
    } catch (error) {
      console.error("Failed to process PDF:", error);
      await ctx.runMutation(internal.attachments.updateProcessedData, {
        attachmentId: args.attachmentId,
        metadata: {
          processed: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  },
});

// Process image files
export const processImage = internalAction({
  args: {
    attachmentId: v.id("attachments"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    try {
      const url = await ctx.storage.getUrl(args.storageId);
      if (!url) return;

      // Use OpenAI Vision API for image analysis
      const apiKey = process.env.CONVEX_OPENAI_API_KEY;
      if (!apiKey) {
        console.warn("OpenAI API key not configured for image analysis");
        return;
      }

      // TODO: Implement actual OpenAI Vision API call
      // For now, simulate the analysis
      const analysis = {
        description: "A simulated description of the image content",
        objects: ["object1", "object2"],
        text: "Any text found in the image",
        colors: ["#FF0000", "#00FF00", "#0000FF"],
      };

      await ctx.runMutation(internal.attachments.updateProcessedData, {
        attachmentId: args.attachmentId,
        extractedText: `Image Analysis:\n${analysis.description}\n\nDetected objects: ${analysis.objects.join(", ")}\nExtracted text: ${analysis.text}`,
        metadata: {
          processed: true,
          processedAt: Date.now(),
          imageAnalysis: analysis,
        },
      });
    } catch (error) {
      console.error("Failed to process image:", error);
      await ctx.runMutation(internal.attachments.updateProcessedData, {
        attachmentId: args.attachmentId,
        metadata: {
          processed: false,
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });
    }
  },
});

// Update processed data
export const updateProcessedData = internalMutation({
  args: {
    attachmentId: v.id("attachments"),
    extractedText: v.optional(v.string()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const updates: any = {};
    if (args.extractedText !== undefined) updates.extractedText = args.extractedText;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
    
    await ctx.db.patch(args.attachmentId, updates);
  },
});

// Get attachment URL
export const getAttachmentUrl = query({
  args: {
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    return await ctx.storage.getUrl(args.storageId);
  },
});

// Get attachments for a thread
export const getByThread = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify user owns the thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) return [];

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    // Get URLs for each attachment
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        const url = await ctx.storage.getUrl(attachment.storageId);
        return {
          ...attachment,
          url,
        };
      })
    );

    return attachmentsWithUrls;
  },
});

// Get attachments for a message
export const getByMessage = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const message = await ctx.db.get(args.messageId);
    if (!message) return [];

    // Verify user owns the thread
    const thread = await ctx.db.get(message.threadId);
    if (!thread || thread.userId !== userId) return [];

    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    // Get URLs for each attachment
    const attachmentsWithUrls = await Promise.all(
      attachments.map(async (attachment) => {
        const url = await ctx.storage.getUrl(attachment.storageId);
        return {
          ...attachment,
          url,
        };
      })
    );

    return attachmentsWithUrls;
  },
});

// Get attachments by IDs
export const getByIds = query({
  args: {
    ids: v.array(v.id("attachments")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const attachments = await Promise.all(
      args.ids.map(async (id) => {
        const attachment = await ctx.db.get(id);
        if (!attachment) return null;

        // Verify user has access
        if (attachment.threadId) {
          const thread = await ctx.db.get(attachment.threadId);
          if (!thread || thread.userId !== userId) return null;
        }

        const url = await ctx.storage.getUrl(attachment.storageId);
        return {
          ...attachment,
          url,
        };
      })
    );

    return attachments.filter(Boolean);
  },
});

// Delete attachment
export const deleteAttachment = mutation({
  args: {
    attachmentId: v.id("attachments"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      throw new Error("Attachment not found");
    }

    // If attached to a message, verify user owns it
    if (attachment.messageId) {
      const message = await ctx.db.get(attachment.messageId);
      if (message) {
        const thread = await ctx.db.get(message.threadId);
        if (!thread || thread.userId !== userId) {
          throw new Error("Not authorized");
        }
      }
    } else if (attachment.threadId) {
      // If only attached to thread, verify ownership
      const thread = await ctx.db.get(attachment.threadId);
      if (!thread || thread.userId !== userId) {
        throw new Error("Not authorized");
      }
    }

    // Delete storage object
    await ctx.storage.delete(attachment.storageId);
    
    // Delete attachment record
    await ctx.db.delete(args.attachmentId);
  },
});

// Link attachment to message
export const linkToMessage = internalMutation({
  args: {
    attachmentId: v.id("attachments"),
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.attachmentId, {
      messageId: args.messageId,
    });
  },
});