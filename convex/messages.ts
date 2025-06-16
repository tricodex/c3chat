import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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

    console.log("📨 Messages query for thread:", {
      threadId: args.threadId,
      messageCount: messages.length,
      messages: messages.map(m => ({
        id: m._id,
        role: m.role,
        contentLength: m.content?.length || 0,
        isStreaming: m.isStreaming,
        cursor: m.cursor,
        contentPreview: m.content ? m.content.substring(0, 30) + '...' : '[empty]'
      }))
    });

    return messages;
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
  },
  handler: async (ctx, args) => {
    console.log("📝 Updating message content:", {
      messageId: args.messageId,
      contentLength: args.content.length,
      isStreaming: args.isStreaming,
      cursor: args.cursor,
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
