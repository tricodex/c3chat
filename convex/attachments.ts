import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
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
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Create attachment record
    const attachmentId = await ctx.db.insert("attachments", {
      storageId: args.storageId,
      filename: args.filename,
      contentType: args.contentType,
      size: args.size,
      messageId: undefined as any, // Will be linked when message is sent
    });

    return attachmentId;
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
    }

    // Delete storage object
    await ctx.storage.delete(attachment.storageId);
    
    // Delete attachment record
    await ctx.db.delete(args.attachmentId);
  },
});
