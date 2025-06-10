import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

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
