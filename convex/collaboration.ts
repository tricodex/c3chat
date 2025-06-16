import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { internal } from "./_generated/api";

// Active sessions for real-time collaboration
export const joinSession = mutation({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify thread access
    const thread = await ctx.db.get(args.threadId);
    if (!thread || thread.userId !== userId) {
      // Check if thread is shared
      if (!thread?.isPublic) {
        throw new Error("Thread not found or unauthorized");
      }
    }

    // Check if already in session
    const existingSession = await ctx.db
      .query("activeSessions")
      .withIndex("by_user_and_thread", (q) => 
        q.eq("userId", userId).eq("threadId", args.threadId)
      )
      .first();

    if (existingSession) {
      // Update last activity
      await ctx.db.patch(existingSession._id, {
        lastActivity: Date.now(),
      });
      return existingSession._id;
    }

    // Create new session
    const sessionId = await ctx.db.insert("activeSessions", {
      threadId: args.threadId,
      userId,
      cursor: { line: 0, column: 0 },
      isTyping: false,
      lastActivity: Date.now(),
    });

    // Schedule cleanup after 5 minutes of inactivity
    await ctx.scheduler.runAfter(5 * 60 * 1000, internal.collaboration.cleanupSession, {
      sessionId,
    });

    return sessionId;
  },
});

// Leave collaborative session
export const leaveSession = mutation({
  args: {
    sessionId: v.id("activeSessions"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    await ctx.db.delete(args.sessionId);
  },
});

// Update cursor position
export const updateCursor = mutation({
  args: {
    sessionId: v.id("activeSessions"),
    cursor: v.object({
      line: v.number(),
      column: v.number(),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(args.sessionId, {
      cursor: args.cursor,
      lastActivity: Date.now(),
    });
  },
});

// Update typing status
export const updateTypingStatus = mutation({
  args: {
    sessionId: v.id("activeSessions"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const session = await ctx.db.get(args.sessionId);
    if (!session || session.userId !== userId) {
      throw new Error("Session not found");
    }

    await ctx.db.patch(args.sessionId, {
      isTyping: args.isTyping,
      lastActivity: Date.now(),
    });
  },
});

// Get active sessions for a thread
export const getActiveSessions = query({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    // Verify thread access
    const thread = await ctx.db.get(args.threadId);
    if (!thread || (thread.userId !== userId && !thread.isPublic)) {
      return [];
    }

    const sessions = await ctx.db
      .query("activeSessions")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect();

    // Get user details for each session
    const sessionsWithUsers = await Promise.all(
      sessions.map(async (session) => {
        const user = await ctx.db.get(session.userId);
        return {
          ...session,
          user: user ? {
            id: user._id,
            name: user.name || "Anonymous",
            email: user.email,
            image: user.image,
          } : null,
        };
      })
    );

    // Filter out the current user and inactive sessions
    const activeSessions = sessionsWithUsers.filter(
      s => s.userId !== userId && 
      Date.now() - s.lastActivity < 5 * 60 * 1000 // 5 minutes
    );

    return activeSessions;
  },
});

// Cleanup inactive session
export const cleanupSession = internalMutation({
  args: {
    sessionId: v.id("activeSessions"),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.sessionId);
    if (!session) return;

    // Check if still active (within last 5 minutes)
    if (Date.now() - session.lastActivity > 5 * 60 * 1000) {
      await ctx.db.delete(args.sessionId);
    }
  },
});

// Collaborative notes/annotations
export const addAnnotation = mutation({
  args: {
    threadId: v.id("threads"),
    messageId: v.id("messages"),
    content: v.string(),
    position: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify thread access
    const thread = await ctx.db.get(args.threadId);
    if (!thread || (thread.userId !== userId && !thread.isPublic)) {
      throw new Error("Thread not found or unauthorized");
    }

    const annotationId = await ctx.db.insert("annotations", {
      threadId: args.threadId,
      messageId: args.messageId,
      userId,
      content: args.content,
      position: args.position,
      createdAt: Date.now(),
    });

    return annotationId;
  },
});

// Get annotations for a message
export const getAnnotations = query({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const message = await ctx.db.get(args.messageId);
    if (!message) return [];

    const thread = await ctx.db.get(message.threadId);
    if (!thread || (thread.userId !== userId && !thread.isPublic)) {
      return [];
    }

    const annotations = await ctx.db
      .query("annotations")
      .withIndex("by_message", (q) => q.eq("messageId", args.messageId))
      .collect();

    // Get user details
    const annotationsWithUsers = await Promise.all(
      annotations.map(async (annotation) => {
        const user = await ctx.db.get(annotation.userId);
        return {
          ...annotation,
          user: user ? {
            id: user._id,
            name: user.name || "Anonymous",
            image: user.image,
          } : null,
        };
      })
    );

    return annotationsWithUsers;
  },
});

// Delete annotation
export const deleteAnnotation = mutation({
  args: {
    annotationId: v.id("annotations"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const annotation = await ctx.db.get(args.annotationId);
    if (!annotation || annotation.userId !== userId) {
      throw new Error("Annotation not found or unauthorized");
    }

    await ctx.db.delete(args.annotationId);
  },
});