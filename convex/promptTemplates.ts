import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Predefined categories
export const PROMPT_CATEGORIES = [
  "writing",
  "coding",
  "analysis",
  "creative",
  "business",
  "education",
  "productivity",
  "research",
  "translation",
  "other",
] as const;

// Create a new prompt template
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    prompt: v.string(),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isPublic: v.optional(v.boolean()),
  },
  returns: v.id("promptTemplates"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    return await ctx.db.insert("promptTemplates", {
      userId,
      name: args.name,
      description: args.description,
      prompt: args.prompt,
      category: args.category || "other",
      tags: args.tags || [],
      isPublic: args.isPublic || false,
      usageCount: 0,
    });
  },
});

// List user's templates and public templates
export const list = query({
  args: {
    category: v.optional(v.string()),
    includePublic: v.optional(v.boolean()),
    searchQuery: v.optional(v.string()),
  },
  returns: v.array(
    v.object({
      _id: v.id("promptTemplates"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      prompt: v.string(),
      category: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      isPublic: v.optional(v.boolean()),
      usageCount: v.number(),
      isOwner: v.boolean(),
    })
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    
    let templates = [];

    // Get user's templates if authenticated
    if (userId) {
      const userTemplates = await ctx.db
        .query("promptTemplates")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      
      templates = userTemplates.map(t => ({ ...t, isOwner: true }));
    }

    // Add public templates if requested
    if (args.includePublic) {
      const publicTemplates = await ctx.db
        .query("promptTemplates")
        .withIndex("by_public", (q) => q.eq("isPublic", true))
        .collect();
      
      // Filter out user's own public templates to avoid duplicates
      const filteredPublic = publicTemplates
        .filter(t => !userId || t.userId !== userId)
        .map(t => ({ ...t, isOwner: false }));
      
      templates = [...templates, ...filteredPublic];
    }

    // Filter by category if specified
    if (args.category) {
      templates = templates.filter(t => t.category === args.category);
    }

    // Search filter
    if (args.searchQuery) {
      const query = args.searchQuery.toLowerCase();
      templates = templates.filter(t => 
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.prompt.toLowerCase().includes(query) ||
        t.tags?.some(tag => tag.toLowerCase().includes(query))
      );
    }

    // Sort by usage count (popular first) then by creation time
    templates.sort((a, b) => {
      if (b.usageCount !== a.usageCount) {
        return b.usageCount - a.usageCount;
      }
      return b._creationTime - a._creationTime;
    });

    return templates;
  },
});

// Get a specific template
export const get = query({
  args: { templateId: v.id("promptTemplates") },
  returns: v.union(
    v.object({
      _id: v.id("promptTemplates"),
      _creationTime: v.number(),
      userId: v.id("users"),
      name: v.string(),
      description: v.optional(v.string()),
      prompt: v.string(),
      category: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      isPublic: v.optional(v.boolean()),
      usageCount: v.number(),
      isOwner: v.boolean(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) return null;

    const userId = await getAuthUserId(ctx);
    
    // Check access: either owner or template is public
    if (template.isPublic || (userId && template.userId === userId)) {
      return {
        ...template,
        isOwner: userId ? template.userId === userId : false,
      };
    }

    return null;
  },
});

// Update template
export const update = mutation({
  args: {
    templateId: v.id("promptTemplates"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    prompt: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isPublic: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== userId) {
      throw new Error("Template not found or not authorized");
    }

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.prompt !== undefined) updates.prompt = args.prompt;
    if (args.category !== undefined) updates.category = args.category;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.isPublic !== undefined) updates.isPublic = args.isPublic;

    await ctx.db.patch(args.templateId, updates);
    return null;
  },
});

// Delete template
export const remove = mutation({
  args: {
    templateId: v.id("promptTemplates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const template = await ctx.db.get(args.templateId);
    if (!template || template.userId !== userId) {
      throw new Error("Template not found or not authorized");
    }

    await ctx.db.delete(args.templateId);
    return null;
  },
});

// Increment usage count
export const incrementUsage = mutation({
  args: {
    templateId: v.id("promptTemplates"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const template = await ctx.db.get(args.templateId);
    if (!template) return null;

    const userId = await getAuthUserId(ctx);
    
    // Only increment if user has access
    if (template.isPublic || (userId && template.userId === userId)) {
      await ctx.db.patch(args.templateId, {
        usageCount: template.usageCount + 1,
      });
    }

    return null;
  },
});

// Get popular templates
export const getPopular = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("promptTemplates"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      category: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      usageCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const limit = args.limit || 10;

    const publicTemplates = await ctx.db
      .query("promptTemplates")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .collect();

    // Sort by usage count and return top N
    return publicTemplates
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit)
      .map(t => ({
        _id: t._id,
        _creationTime: t._creationTime,
        name: t.name,
        description: t.description,
        category: t.category,
        tags: t.tags,
        usageCount: t.usageCount,
      }));
  },
});

// Clone a public template
export const clone = mutation({
  args: {
    templateId: v.id("promptTemplates"),
    name: v.optional(v.string()),
  },
  returns: v.id("promptTemplates"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const template = await ctx.db.get(args.templateId);
    if (!template || !template.isPublic) {
      throw new Error("Template not found or not public");
    }

    // Create a copy for the user
    return await ctx.db.insert("promptTemplates", {
      userId,
      name: args.name || `${template.name} (Copy)`,
      description: template.description,
      prompt: template.prompt,
      category: template.category,
      tags: template.tags,
      isPublic: false, // Cloned templates start as private
      usageCount: 0,
    });
  },
});
