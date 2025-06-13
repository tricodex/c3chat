import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get user settings
export const getUserSettings = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("userSettings"),
      _creationTime: v.number(),
      userId: v.id("users"),
      defaultProvider: v.optional(v.string()),
      defaultModel: v.optional(v.string()),
      theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
    }),
    v.null()
  ),
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return settings;
  },
});

// Update user settings
export const updateUserSettings = mutation({
  args: {
    defaultProvider: v.optional(v.string()),
    defaultModel: v.optional(v.string()),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    // Filter out undefined values
    const updates: Record<string, any> = {};
    if (args.defaultProvider !== undefined) updates.defaultProvider = args.defaultProvider;
    if (args.defaultModel !== undefined) updates.defaultModel = args.defaultModel;
    if (args.theme !== undefined) updates.theme = args.theme;

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, updates);
    } else {
      // Create new settings
      await ctx.db.insert("userSettings", {
        userId,
        ...updates,
      });
    }

    return null;
  },
});

// Set default provider
export const setDefaultProvider = mutation({
  args: {
    provider: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        defaultProvider: args.provider,
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        defaultProvider: args.provider,
      });
    }

    return null;
  },
});

// Set default model
export const setDefaultModel = mutation({
  args: {
    model: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        defaultModel: args.model,
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        defaultModel: args.model,
      });
    }

    return null;
  },
});

// Set theme preference
export const setTheme = mutation({
  args: {
    theme: v.union(v.literal("light"), v.literal("dark"), v.literal("system")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        theme: args.theme,
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        theme: args.theme,
      });
    }

    return null;
  },
});
