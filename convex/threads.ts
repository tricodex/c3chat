import { query, mutation, internalQuery, action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { nanoid } from "nanoid";
import { api, internal } from "./_generated/api";

export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    let threadsQuery = ctx.db
      .query("threads")
      .withIndex("by_user_and_last_message", (q) => q.eq("userId", userId));

    const threads = await threadsQuery.order("desc").collect();

    // Filter by project if specified
    let filteredThreads = threads;
    if (args.projectId !== undefined) {
      filteredThreads = threads.filter(t => t.projectId === args.projectId);
    }

    // Filter out archived unless requested
    if (!args.includeArchived) {
      filteredThreads = filteredThreads.filter(t => !t.archived);
    }

    return filteredThreads;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    projectId: v.optional(v.id("projects")),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    parentThreadId: v.optional(v.id("threads")),
    branchPoint: v.optional(v.id("messages")),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Verify project ownership if projectId is provided
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== userId) {
        throw new Error("Project not found or not authorized");
      }

      // Update project stats
      await ctx.db.patch(args.projectId, {
        threadCount: project.threadCount + 1,
        lastActivityAt: Date.now(),
      });
    }

    const threadId = await ctx.db.insert("threads", {
      title: args.title,
      userId,
      lastMessageAt: Date.now(),
      projectId: args.projectId,
      provider: args.provider,
      model: args.model,
      parentThreadId: args.parentThreadId,
      branchPoint: args.branchPoint,
      tags: args.tags,
      archived: false,
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

// Update thread
export const update = mutation({
  args: {
    threadId: v.id("threads"),
    title: v.optional(v.string()),
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
    if (args.title !== undefined) updates.title = args.title;
    if (args.provider !== undefined) updates.provider = args.provider;
    if (args.model !== undefined) updates.model = args.model;

    await ctx.db.patch(args.threadId, updates);
  },
});

// Archive/unarchive thread
export const archive = mutation({
  args: {
    threadId: v.id("threads"),
    archived: v.boolean(),
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
      archived: args.archived,
    });
  },
});

// Search threads
export const search = query({
  args: {
    query: v.string(),
    projectId: v.optional(v.id("projects")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    // Get all user threads
    let threads = await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Filter by project if specified
    if (args.projectId) {
      threads = threads.filter(t => t.projectId === args.projectId);
    }

    // Filter out archived
    threads = threads.filter(t => !t.archived);

    // Simple text search in title
    const searchQuery = args.query.toLowerCase();
    const matchedThreads = threads.filter(thread => 
      thread.title.toLowerCase().includes(searchQuery)
    );

    // Sort by relevance (simple: exact matches first, then partial)
    matchedThreads.sort((a, b) => {
      const aExact = a.title.toLowerCase() === searchQuery;
      const bExact = b.title.toLowerCase() === searchQuery;
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return b.lastMessageAt - a.lastMessageAt;
    });

    return matchedThreads;
  },
});

// Update thread tags
export const updateTags = mutation({
  args: {
    threadId: v.id("threads"),
    tags: v.array(v.string()),
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
      tags: args.tags,
    });
  },
});

// Move thread to different project
export const moveToProject = mutation({
  args: {
    threadId: v.id("threads"),
    projectId: v.union(v.id("projects"), v.null()),
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

    // Verify new project ownership
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project || project.userId !== userId) {
        throw new Error("Project not found or not authorized");
      }
    }

    // Update old project stats
    if (thread.projectId) {
      const oldProject = await ctx.db.get(thread.projectId);
      if (oldProject) {
        await ctx.db.patch(thread.projectId, {
          threadCount: Math.max(0, oldProject.threadCount - 1),
        });
      }
    }

    // Update new project stats
    if (args.projectId) {
      const newProject = await ctx.db.get(args.projectId);
      if (newProject) {
        await ctx.db.patch(args.projectId, {
          threadCount: newProject.threadCount + 1,
          lastActivityAt: Date.now(),
        });
      }
    }

    // Update thread
    await ctx.db.patch(args.threadId, {
      projectId: args.projectId || undefined,
    });
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

// Create a branch from an existing thread
export const createBranch = mutation({
  args: {
    parentThreadId: v.id("threads"),
    branchPoint: v.optional(v.id("messages")),
  },
  returns: v.id("threads"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get parent thread
    const parentThread = await ctx.db.get(args.parentThreadId);
    if (!parentThread || parentThread.userId !== userId) {
      throw new Error("Thread not found or unauthorized");
    }

    // Create new thread as a branch
    const newThreadId = await ctx.db.insert("threads", {
      title: `${parentThread.title} (Branch)`,
      userId,
      lastMessageAt: Date.now(),
      projectId: parentThread.projectId,
      provider: parentThread.provider,
      model: parentThread.model,
      parentThreadId: args.parentThreadId,
      branchPoint: args.branchPoint,
    });

    // Copy messages up to branch point if specified
    if (args.branchPoint) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", args.parentThreadId))
        .collect();

      // Find branch point and copy all messages before it
      let foundBranchPoint = false;
      for (const message of messages) {
        if (message._id === args.branchPoint) {
          foundBranchPoint = true;
          break;
        }
        
        // Copy message to new thread
        await ctx.db.insert("messages", {
          threadId: newThreadId,
          role: message.role,
          content: message.content,
          provider: message.provider,
          model: message.model,
          inputTokens: message.inputTokens,
          outputTokens: message.outputTokens,
        });
      }
    }

    // Update project stats if applicable
    if (parentThread.projectId) {
      const project = await ctx.db.get(parentThread.projectId);
      if (project) {
        await ctx.db.patch(parentThread.projectId, {
          threadCount: project.threadCount + 1,
          lastActivityAt: Date.now(),
        });
      }
    }

    return newThreadId;
  },
});

// Export thread in various formats
export const exportThread = action({
  args: {
    threadId: v.id("threads"),
    format: v.optional(v.union(
      v.literal("markdown"),
      v.literal("json"),
      v.literal("txt"),
      v.literal("html")
    )),
  },
  returns: v.object({
    content: v.string(),
    mimeType: v.string(),
    filename: v.string(),
  }),
  handler: async (ctx, args): Promise<{content: string; mimeType: string; filename: string}> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Get thread
    const thread = await ctx.runQuery(api.threads.get, { threadId: args.threadId });
    if (!thread) {
      throw new Error("Thread not found");
    }

    // Get messages
    const messages = await ctx.runQuery(api.messages.list, { threadId: args.threadId });
    
    const format = args.format || "markdown";
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    let content = "";
    let mimeType = "text/plain";
    let extension = "txt";

    switch (format) {
      case "markdown":
        content = `# ${thread.title}\n\n`;
        content += `_Created: ${new Date(thread._creationTime).toLocaleString()}_\n\n`;
        if (thread.provider && thread.model) {
          content += `_Model: ${thread.provider}/${thread.model}_\n\n`;
        }
        content += "---\n\n";
        
        for (const message of messages) {
          const role = message.role === "user" ? "You" : "Assistant";
          content += `### ${role}\n\n${message.content}\n\n`;
          
          if (message.inputTokens || message.outputTokens) {
            content += `_Tokens: ${message.inputTokens || 0} in, ${message.outputTokens || 0} out_\n\n`;
          }
          content += "---\n\n";
        }
        
        mimeType = "text/markdown";
        extension = "md";
        break;

      case "json":
        content = JSON.stringify({
          thread: {
            id: thread._id,
            title: thread.title,
            createdAt: thread._creationTime,
            provider: thread.provider,
            model: thread.model,
          },
          messages: messages.map((m: any) => ({
            id: m._id,
            role: m.role,
            content: m.content,
            createdAt: m._creationTime,
            tokens: {
              input: m.inputTokens,
              output: m.outputTokens,
            },
          })),
        }, null, 2);
        
        mimeType = "application/json";
        extension = "json";
        break;

      case "html":
        content = `<!DOCTYPE html>
<html>
<head>
  <title>${thread.title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .message { margin: 20px 0; padding: 15px; border-radius: 8px; }
    .user { background: #e3f2fd; }
    .assistant { background: #f5f5f5; }
    .role { font-weight: bold; margin-bottom: 10px; }
    .content { white-space: pre-wrap; }
    .meta { font-size: 0.8em; color: #666; margin-top: 10px; }
  </style>
</head>
<body>
  <h1>${thread.title}</h1>
  <p><em>Created: ${new Date(thread._creationTime).toLocaleString()}</em></p>
`;
        
        if (thread.provider && thread.model) {
          content += `  <p><em>Model: ${thread.provider}/${thread.model}</em></p>\n`;
        }
        
        content += "  <hr>\n";
        
        for (const message of messages) {
          const roleClass = message.role === "user" ? "user" : "assistant";
          const roleLabel = message.role === "user" ? "You" : "Assistant";
          
          content += `  <div class="message ${roleClass}">\n`;
          content += `    <div class="role">${roleLabel}</div>\n`;
          content += `    <div class="content">${escapeHtml(message.content)}</div>\n`;
          
          if (message.inputTokens || message.outputTokens) {
            content += `    <div class="meta">Tokens: ${message.inputTokens || 0} in, ${message.outputTokens || 0} out</div>\n`;
          }
          
          content += "  </div>\n";
        }
        
        content += "</body>\n</html>";
        mimeType = "text/html";
        extension = "html";
        break;

      default:
        // Plain text
        content = `${thread.title}\n${'='.repeat(thread.title.length)}\n\n`;
        content += `Created: ${new Date(thread._creationTime).toLocaleString()}\n`;
        if (thread.provider && thread.model) {
          content += `Model: ${thread.provider}/${thread.model}\n`;
        }
        content += "\n" + "-".repeat(50) + "\n\n";
        
        for (const message of messages) {
          const role = message.role === "user" ? "You" : "Assistant";
          content += `${role}:\n${message.content}\n\n`;
          
          if (message.inputTokens || message.outputTokens) {
            content += `(Tokens: ${message.inputTokens || 0} in, ${message.outputTokens || 0} out)\n\n`;
          }
          content += "-".repeat(50) + "\n\n";
        }
        
        extension = "txt";
        break;
    }

    return {
      content,
      mimeType,
      filename: `${thread.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${timestamp}.${extension}`,
    };
  },
});

// Remove thread (delete)
export const remove = mutation({
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
      throw new Error("Thread not found or unauthorized");
    }

    // Delete all messages in the thread
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    for (const message of messages) {
      // Clean up attachments for each message
      await ctx.scheduler.runAfter(0, internal.attachmentCleanup.cleanupMessageAttachments, {
        messageId: message._id,
      });
      await ctx.db.delete(message._id);
    }

    // Also clean up any attachments directly linked to the thread
    await ctx.scheduler.runAfter(0, internal.attachmentCleanup.cleanupThreadAttachments, {
      threadId: args.threadId,
    });

    // Update project stats if applicable
    if (thread.projectId) {
      const project = await ctx.db.get(thread.projectId);
      if (project) {
        await ctx.db.patch(thread.projectId, {
          threadCount: Math.max(0, project.threadCount - 1),
        });
      }
    }

    // Delete the thread
    await ctx.db.delete(args.threadId);
  },
});

// Share thread mutation
export const share = mutation({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.string(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found or unauthorized");
    }

    // Generate share ID if not already shared
    const shareId = thread.shareId || nanoid(10);
    
    await ctx.db.patch(args.threadId, {
      isPublic: true,
      shareId,
    });

    return shareId;
  },
});

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}
