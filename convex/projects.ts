import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { nanoid } from "nanoid";

// Create a new project
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    settings: v.optional(v.object({
      defaultModel: v.optional(v.string()),
      defaultProvider: v.optional(v.string()),
      enableKnowledgeBase: v.optional(v.boolean()),
      enableWebSearch: v.optional(v.boolean()),
      autoArchiveDays: v.optional(v.number()),
    })),
  },
  returns: v.id("projects"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const projectId = await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      color: args.color || "#3B82F6",
      icon: args.icon || "Folder",
      userId,
      isPublic: args.isPublic || false,
      shareId: args.isPublic ? nanoid(10) : undefined,
      settings: args.settings || {},
      threadCount: 0,
      memberCount: 1,
      lastActivityAt: Date.now(),
      createdAt: Date.now(),
    });

    // Add creator as owner
    await ctx.db.insert("projectMembers", {
      projectId,
      userId,
      role: "owner",
      joinedAt: Date.now(),
    });

    return projectId;
  },
});

// List user's projects
export const list = query({
  args: {
    includeShared: v.optional(v.boolean()),
  },
  returns: v.array(v.object({
    _id: v.id("projects"),
    _creationTime: v.number(),
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    userId: v.id("users"),
    isPublic: v.boolean(),
    shareId: v.optional(v.string()),
    threadCount: v.number(),
    memberCount: v.number(),
    lastActivityAt: v.number(),
    role: v.optional(v.union(v.literal("owner"), v.literal("admin"), v.literal("member"), v.literal("viewer"))),
  })),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get projects where user is owner
    const ownedProjects = await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Get projects where user is a member (if includeShared)
    let memberProjects: any[] = [];
    if (args.includeShared) {
      const memberships = await ctx.db
        .query("projectMembers")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();

      const memberProjectIds = memberships
        .filter(m => m.projectId)
        .map(m => m.projectId);

      memberProjects = await Promise.all(
        memberProjectIds.map(async (projectId) => {
          const project = await ctx.db.get(projectId);
          if (project && project.userId !== userId) {
            const membership = memberships.find(m => m.projectId === projectId);
            return {
              ...project,
              role: membership?.role,
            };
          }
          return null;
        })
      );

      memberProjects = memberProjects.filter(p => p !== null);
    }

    // Combine and sort by last activity
    const allProjects = [
      ...ownedProjects.map(p => ({ ...p, role: "owner" as const })),
      ...memberProjects,
    ].sort((a, b) => b.lastActivityAt - a.lastActivityAt);

    return allProjects;
  },
});

// Get project by ID
export const get = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    // Check if user has access
    if (project.userId === userId) {
      return { ...project, role: "owner" };
    }

    // Check if user is a member
    const membership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_and_user", (q) => 
        q.eq("projectId", args.projectId).eq("userId", userId)
      )
      .first();

    if (membership) {
      return { ...project, role: membership.role };
    }

    // Check if project is public
    if (project.isPublic) {
      return { ...project, role: "viewer" };
    }

    return null;
  },
});

// Update project
export const update = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    isPublic: v.optional(v.boolean()),
    settings: v.optional(v.object({
      defaultModel: v.optional(v.string()),
      defaultProvider: v.optional(v.string()),
      enableKnowledgeBase: v.optional(v.boolean()),
      enableWebSearch: v.optional(v.boolean()),
      autoArchiveDays: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Check permissions
    const canEdit = project.userId === userId || await checkPermission(ctx, args.projectId, userId, "admin");
    if (!canEdit) {
      throw new Error("Not authorized to edit this project");
    }

    const updates: any = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.color !== undefined) updates.color = args.color;
    if (args.icon !== undefined) updates.icon = args.icon;
    if (args.isPublic !== undefined) {
      updates.isPublic = args.isPublic;
      updates.shareId = args.isPublic ? (project.shareId || nanoid(10)) : undefined;
    }
    if (args.settings !== undefined) {
      updates.settings = { ...project.settings, ...args.settings };
    }

    updates.lastActivityAt = Date.now();

    await ctx.db.patch(args.projectId, updates);
  },
});

// Delete project
export const remove = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      throw new Error("Project not found or not authorized");
    }

    // Delete all threads in project
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const thread of threads) {
      // Delete all messages in thread
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();

      for (const message of messages) {
        await ctx.db.delete(message._id);
      }

      await ctx.db.delete(thread._id);
    }

    // Delete all knowledge base items
    const kbItems = await ctx.db
      .query("knowledgeBase")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const item of kbItems) {
      await ctx.db.delete(item._id);
    }

    // Delete all project members
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const member of members) {
      await ctx.db.delete(member._id);
    }

    // Delete the project
    await ctx.db.delete(args.projectId);
  },
});

// Add member to project
export const addMember = mutation({
  args: {
    projectId: v.id("projects"),
    userEmail: v.string(),
    role: v.union(v.literal("admin"), v.literal("member"), v.literal("viewer")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    // Check permissions
    const canAddMembers = project.userId === userId || 
      await checkPermission(ctx, args.projectId, userId, "admin");
    if (!canAddMembers) {
      throw new Error("Not authorized to add members");
    }

    // Find user by email
    const users = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("email"), args.userEmail))
      .collect();

    const targetUser = users[0];
    if (!targetUser) {
      throw new Error("User not found");
    }

    // Check if already a member
    const existingMembership = await ctx.db
      .query("projectMembers")
      .withIndex("by_project_and_user", (q) => 
        q.eq("projectId", args.projectId).eq("userId", targetUser._id)
      )
      .first();

    if (existingMembership) {
      throw new Error("User is already a member");
    }

    // Add member
    await ctx.db.insert("projectMembers", {
      projectId: args.projectId,
      userId: targetUser._id,
      role: args.role,
      joinedAt: Date.now(),
    });

    // Update member count
    await ctx.db.patch(args.projectId, {
      memberCount: project.memberCount + 1,
      lastActivityAt: Date.now(),
    });
  },
});

// Get project members
export const getMembers = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Check if user has access to project
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return [];
    }

    const hasAccess = project.userId === userId ||
      project.isPublic ||
      await checkPermission(ctx, args.projectId, userId, "viewer");

    if (!hasAccess) {
      return [];
    }

    // Get all members
    const members = await ctx.db
      .query("projectMembers")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get user details
    const memberDetails = await Promise.all(
      members.map(async (member) => {
        const user = await ctx.db.get(member.userId);
        if (!user) return null;

        return {
          userId: member.userId,
          email: user.email,
          name: user.name,
          image: user.image,
          role: member.role,
          joinedAt: member.joinedAt,
        };
      })
    );

    return memberDetails.filter(m => m !== null);
  },
});

// Helper function to check permissions
async function checkPermission(
  ctx: any,
  projectId: any,
  userId: any,
  requiredRole: "owner" | "admin" | "member" | "viewer"
): Promise<boolean> {
  const membership = await ctx.db
    .query("projectMembers")
    .withIndex("by_project_and_user", (q: any) => 
      q.eq("projectId", projectId).eq("userId", userId)
    )
    .first();

  if (!membership) return false;

  const roleHierarchy = {
    owner: 4,
    admin: 3,
    member: 2,
    viewer: 1,
  };

  return roleHierarchy[membership.role] >= roleHierarchy[requiredRole];
}

// Get project statistics
export const getStats = query({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    // Check access
    const hasAccess = project.userId === userId ||
      project.isPublic ||
      await checkPermission(ctx, args.projectId, userId, "viewer");

    if (!hasAccess) {
      return null;
    }

    // Get thread count
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get message count
    let messageCount = 0;
    let tokenCount = 0;
    for (const thread of threads) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();
      
      messageCount += messages.length;
      
      for (const message of messages) {
        tokenCount += (message.inputTokens || 0) + (message.outputTokens || 0);
      }
    }

    // Get knowledge base count
    const kbCount = await ctx.db
      .query("knowledgeBase")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()
      .then(items => items.length);

    return {
      threadCount: threads.length,
      messageCount,
      tokenCount,
      knowledgeBaseCount: kbCount,
      memberCount: project.memberCount,
      lastActivityAt: project.lastActivityAt,
    };
  },
});
