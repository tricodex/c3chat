import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

export const list = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Verify user owns the thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) {
      return [];
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .collect();

    // Fetch attachments for each message
    const messagesWithAttachments = await Promise.all(
      messages.map(async (message) => {
        const attachments = await ctx.db
          .query("attachments")
          .withIndex("by_message", (q) => q.eq("messageId", message._id))
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
        
        return {
          ...message,
          attachments: attachmentsWithUrls,
        };
      })
    );

    console.log("📨 Messages query for thread:", {
      threadId: args.threadId,
      messageCount: messagesWithAttachments.length,
      messages: messagesWithAttachments.map(m => ({
        id: m._id,
        role: m.role,
        contentLength: m.content?.length || 0,
        isStreaming: m.isStreaming,
        cursor: m.cursor,
        contentPreview: m.content ? m.content.substring(0, 30) + '...' : '[empty]',
        attachmentCount: m.attachments?.length || 0,
        toolCalls: m.toolCalls
      }))
    });

    return messagesWithAttachments;
  },
});

export const create = mutation({
  args: {
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    isStreaming: v.optional(v.boolean()),
    cursor: v.optional(v.boolean()),
    attachmentIds: v.optional(v.array(v.id("attachments"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify user owns the thread
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found");
    }

    const messageId = await ctx.db.insert("messages", {
      threadId: args.threadId,
      role: args.role,
      content: args.content,
      isStreaming: args.isStreaming,
      cursor: args.cursor,
    });

    // Link attachments to message if provided
    if (args.attachmentIds && args.attachmentIds.length > 0) {
      await Promise.all(
        args.attachmentIds.map(async (attachmentId) => {
          await ctx.db.patch(attachmentId, {
            messageId: messageId,
          });
        })
      );
    }

    // Update thread's last message time
    await ctx.db.patch(args.threadId, {
      lastMessageAt: Date.now(),
    });

    return messageId;
  },
});

// Public mutation for users to update their own messages
export const update = mutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get the message
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Verify user owns the thread
    const thread = await ctx.db.get(message.threadId);
    if (!thread || thread.userId !== userId) {
      throw new Error("Unauthorized");
    }

    // Only allow editing user messages
    if (message.role !== "user") {
      throw new Error("Can only edit user messages");
    }

    await ctx.db.patch(args.messageId, {
      content: args.content,
      editedAt: Date.now(),
    });
  },
});

export const updateContent = internalMutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
    isStreaming: v.optional(v.boolean()),
    cursor: v.optional(v.boolean()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    generatedImageUrl: v.optional(v.string()),
    generatedVideoUrl: v.optional(v.string()),
    toolCalls: v.optional(v.array(v.object({
      id: v.string(),
      type: v.string(),
      function: v.object({
        name: v.string(),
        arguments: v.string(),
      }),
    }))),
  },
  handler: async (ctx, args) => {
    console.log("📝 Updating message content:", {
      messageId: args.messageId,
      contentLength: args.content.length,
      isStreaming: args.isStreaming,
      cursor: args.cursor,
      toolCalls: args.toolCalls,
      contentPreview: args.content.substring(0, 50) + '...'
    });
    
    const updates: any = {
      content: args.content,
    };
    
    if (args.isStreaming !== undefined) updates.isStreaming = args.isStreaming;
    if (args.cursor !== undefined) updates.cursor = args.cursor;
    if (args.inputTokens !== undefined) updates.inputTokens = args.inputTokens;
    if (args.outputTokens !== undefined) updates.outputTokens = args.outputTokens;
    if (args.generatedImageUrl !== undefined) updates.generatedImageUrl = args.generatedImageUrl;
    if (args.generatedVideoUrl !== undefined) updates.generatedVideoUrl = args.generatedVideoUrl;
    if (args.toolCalls !== undefined) updates.toolCalls = args.toolCalls;
    
    await ctx.db.patch(args.messageId, updates);
    
    console.log("✅ Message updated successfully");
  },
});

// Get message by ID (internal use)
export const getById = internalQuery({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.messageId);
  },
});

// Link attachment to message
export const linkAttachment = internalMutation({
  args: {
    messageId: v.id("messages"),
    attachmentId: v.id("attachments"),
  },
  handler: async (ctx, args) => {
    // Verify attachment exists and update its messageId
    const attachment = await ctx.db.get(args.attachmentId);
    if (!attachment) {
      throw new Error("Attachment not found");
    }
    
    await ctx.db.patch(args.attachmentId, {
      messageId: args.messageId,
    });
  },
});

// Store web search results
export const storeSearchResults = internalMutation({
  args: {
    messageId: v.id("messages"),
    query: v.string(),
    results: v.array(v.object({
      title: v.string(),
      url: v.string(),
      snippet: v.string(),
      favicon: v.optional(v.string()),
    })),
    searchedAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("searchResults", {
      messageId: args.messageId,
      query: args.query,
      results: args.results,
      searchedAt: args.searchedAt,
    });
  },
});

// Get message with attachments
export const getWithAttachments = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      return null;
    }

    // Verify user owns the thread
    const thread = await ctx.db.get(message.threadId);
    if (!thread || thread.userId !== userId) {
      return null;
    }

    // Get attachments
    const attachments = await ctx.db
      .query("attachments")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    // Get search results if any
    const searchResults = await ctx.db
      .query("searchResults")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .first();

    return {
      ...message,
      attachments,
      searchResults,
    };
  },
});

// Delete a message and its attachments
export const remove = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    // Verify user owns the thread
    const thread = await ctx.db.get(message.threadId);
    if (!thread || thread.userId !== userId) {
      throw new Error("Not authorized");
    }

    // Clean up attachments associated with this message
    await ctx.scheduler.runAfter(0, internal.attachmentCleanup.cleanupMessageAttachments, {
      messageId: args.messageId,
    });

    // Delete the message
    await ctx.db.delete(args.messageId);

    return { success: true };
  },
});
