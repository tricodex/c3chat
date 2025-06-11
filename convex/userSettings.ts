import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get user settings
export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return settings || {
      userId,
      defaultProvider: "openai",
      defaultModel: "gpt-4o-mini",
      theme: "system" as const,
    };
  },
});

// Update user settings
export const updateUserSettings = mutation({
  args: {
    defaultProvider: v.optional(v.string()),
    defaultModel: v.optional(v.string()),
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check if settings exist
    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingSettings) {
      // Update existing settings
      const updates: any = {};
      if (args.defaultProvider !== undefined) updates.defaultProvider = args.defaultProvider;
      if (args.defaultModel !== undefined) updates.defaultModel = args.defaultModel;
      if (args.theme !== undefined) updates.theme = args.theme;

      await ctx.db.patch(existingSettings._id, updates);
    } else {
      // Create new settings
      await ctx.db.insert("userSettings", {
        userId,
        defaultProvider: args.defaultProvider,
        defaultModel: args.defaultModel,
        theme: args.theme,
      });
    }
  },
});
