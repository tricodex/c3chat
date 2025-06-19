import { internal } from "./_generated/api";
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// Find orphaned attachments (uploaded more than 1 hour ago but not linked to any message)
export const findOrphanedAttachments = internalQuery({
  args: {},
  handler: async (ctx) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour in milliseconds
    
    // Get all attachments without a messageId that are older than 1 hour
    const orphanedAttachments = await ctx.db
      .query("attachments")
      .withIndex("by_message", (q) => q.eq("messageId", undefined as any))
      .filter((q) => q.lt(q.field("uploadedAt"), oneHourAgo))
      .collect();
    
    return orphanedAttachments;
  },
});

// Delete orphaned attachments
export const cleanupOrphans = internalMutation({
  args: {},
  handler: async (ctx) => {
    const oneHourAgo = Date.now() - 60 * 60 * 1000; // 1 hour in milliseconds
    
    // Get all attachments without a messageId that are older than 1 hour
    const orphans = await ctx.db
      .query("attachments")
      .withIndex("by_message", (q) => q.eq("messageId", undefined as any))
      .filter((q) => q.lt(q.field("uploadedAt"), oneHourAgo))
      .collect();
    
    console.log(`Found ${orphans.length} orphaned attachments to clean up`);
    
    let deletedCount = 0;
    let errorCount = 0;
    
    for (const orphan of orphans) {
      try {
        // Delete from storage
        await ctx.storage.delete(orphan.storageId);
        
        // Delete attachment record
        await ctx.db.delete(orphan._id);
        
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete orphaned attachment ${orphan._id}:`, error);
        errorCount++;
      }
    }
    
    console.log(`Cleaned up ${deletedCount} orphaned attachments, ${errorCount} errors`);
    
    return {
      found: orphans.length,
      deleted: deletedCount,
      errors: errorCount,
    };
  },
});

// Manual cleanup function that can be called on-demand
export const manualCleanup = internalMutation({
  args: {
    olderThanMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const cutoffMinutes = args.olderThanMinutes ?? 60; // Default to 1 hour
    const cutoffTime = Date.now() - cutoffMinutes * 60 * 1000;
    
    // Get all attachments without a messageId that are older than cutoff
    const orphanedAttachments = await ctx.db
      .query("attachments")
      .filter((q) => 
        q.and(
          q.eq(q.field("messageId"), undefined as any),
          q.lt(q.field("uploadedAt"), cutoffTime)
        )
      )
      .collect();
    
    console.log(`Manual cleanup: Found ${orphanedAttachments.length} orphaned attachments older than ${cutoffMinutes} minutes`);
    
    let deletedCount = 0;
    
    for (const orphan of orphanedAttachments) {
      try {
        await ctx.storage.delete(orphan.storageId);
        await ctx.db.delete(orphan._id);
        deletedCount++;
      } catch (error) {
        console.error(`Failed to delete orphaned attachment ${orphan._id}:`, error);
      }
    }
    
    return {
      found: orphanedAttachments.length,
      deleted: deletedCount,
    };
  },
});

// Clean up attachments when a message is deleted
export const cleanupMessageAttachments = internalMutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    // Find all attachments linked to this message
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();
    
    console.log(`Cleaning up ${attachments.length} attachments for deleted message ${args.messageId}`);
    
    for (const attachment of attachments) {
      try {
        // Delete from storage
        await ctx.storage.delete(attachment.storageId);
        
        // Delete attachment record
        await ctx.db.delete(attachment._id);
      } catch (error) {
        console.error(`Failed to delete attachment ${attachment._id}:`, error);
      }
    }
    
    return attachments.length;
  },
});

// Clean up attachments when a thread is deleted
export const cleanupThreadAttachments = internalMutation({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    // Find all attachments linked to this thread
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();
    
    console.log(`Cleaning up ${attachments.length} attachments for deleted thread ${args.threadId}`);
    
    for (const attachment of attachments) {
      try {
        // Delete from storage
        await ctx.storage.delete(attachment.storageId);
        
        // Delete attachment record
        await ctx.db.delete(attachment._id);
      } catch (error) {
        console.error(`Failed to delete attachment ${attachment._id}:`, error);
      }
    }
    
    return attachments.length;
  },
});