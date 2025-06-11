import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { nanoid } from "nanoid";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const threads = await ctx.db
      .query("threads")
      .withIndex("by_user_and_last_message", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    return threads;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    parentThreadId: v.optional(v.id("threads")),
    branchPoint: v.optional(v.id("messages")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const threadId = await ctx.db.insert("threads", {
      title: args.title,
      userId,
      lastMessageAt: Date.now(),
      provider: args.provider,
      model: args.model,
      parentThreadId: args.parentThreadId,
      branchPoint: args.branchPoint,
    });

    return threadId;
  },
});

export const get = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) {
      return null;
    }

    return thread;
  },
});

export const updateLastMessage = mutation({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found");
    }

    await ctx.db.patch(args.threadId, {
      lastMessageAt: Date.now(),
    });
  },
});

// Share a thread publicly
export const shareThread = mutation({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found");
    }

    const shareId = nanoid(10);
    await ctx.db.patch(args.threadId, {
      isPublic: true,
      shareId,
    });

    return shareId;
  },
});

// Get shared thread by shareId
export const getSharedThread = query({
  args: {
    shareId: v.string(),
  },
  handler: async (ctx, args) => {
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_share_id", (q) => q.eq("shareId", args.shareId))
      .collect();

    const thread = threads[0];
    if (!thread || !thread.isPublic) {
      return null;
    }

    return thread;
  },
});

// Update thread settings
export const updateSettings = mutation({
  args: {
    threadId: v.id("threads"),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found");
    }

    const updates: any = {};
    if (args.provider !== undefined) updates.provider = args.provider;
    if (args.model !== undefined) updates.model = args.model;

    await ctx.db.patch(args.threadId, updates);
  },
});

// Get thread branches
export const getBranches = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const branches = await ctx.db
      .query("threads")
      .filter((q) => q.eq(q.field("parentThreadId"), args.threadId))
      .collect();

    // Only return branches owned by the user
    return branches.filter((branch) => branch.userId === userId);
  },
});

// Internal query for getting thread by ID
export const getById = internalQuery({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.threadId);
  },
});
