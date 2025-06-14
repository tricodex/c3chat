import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// Event types
export const EVENT_TYPES = {
  MESSAGE_SENT: "message_sent",
  THREAD_CREATED: "thread_created",
  THREAD_ARCHIVED: "thread_archived",
  IMAGE_GENERATED: "image_generated",
  WEB_SEARCH: "web_search",
  KNOWLEDGE_SEARCH: "knowledge_search",
  API_ERROR: "api_error",
  MODEL_SWITCHED: "model_switched",
  PROJECT_CREATED: "project_created",
  TEMPLATE_USED: "template_used",
} as const;

// Track an event
export const track = internalMutation({
  args: {
    userId: v.id("users"),
    eventType: v.string(),
    eventData: v.optional(v.object({
      threadId: v.optional(v.id("threads")),
      messageId: v.optional(v.id("messages")),
      provider: v.optional(v.string()),
      model: v.optional(v.string()),
      inputTokens: v.optional(v.number()),
      outputTokens: v.optional(v.number()),
      duration: v.optional(v.number()),
      error: v.optional(v.string()),
      searchQuery: v.optional(v.string()),
      resultCount: v.optional(v.number()),
      projectId: v.optional(v.id("projects")),
      templateId: v.optional(v.id("promptTemplates")),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("analytics", {
      userId: args.userId,
      eventType: args.eventType,
      eventData: args.eventData,
      timestamp: Date.now(),
    });
    return null;
  },
});

// Get user's usage stats
export const getUserStats = query({
  args: {
    timeRange: v.optional(v.union(
      v.literal("day"),
      v.literal("week"),
      v.literal("month"),
      v.literal("all")
    )),
  },
  returns: v.object({
    totalMessages: v.number(),
    totalTokens: v.object({
      input: v.number(),
      output: v.number(),
    }),
    modelUsage: v.array(v.object({
      provider: v.string(),
      model: v.string(),
      count: v.number(),
      tokens: v.object({
        input: v.number(),
        output: v.number(),
      }),
    })),
    featureUsage: v.object({
      webSearches: v.number(),
      knowledgeSearches: v.number(),
      imagesGenerated: v.number(),
      templatesUsed: v.number(),
    }),
    errorRate: v.number(),
    dailyActivity: v.array(v.object({
      date: v.string(),
      messageCount: v.number(),
      tokenCount: v.number(),
    })),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        totalMessages: 0,
        totalTokens: { input: 0, output: 0 },
        modelUsage: [],
        featureUsage: {
          webSearches: 0,
          knowledgeSearches: 0,
          imagesGenerated: 0,
          templatesUsed: 0,
        },
        errorRate: 0,
        dailyActivity: [],
      };
    }

    // Calculate time range
    const now = Date.now();
    let startTime = 0;
    switch (args.timeRange) {
      case "day":
        startTime = now - 24 * 60 * 60 * 1000;
        break;
      case "week":
        startTime = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        startTime = now - 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        startTime = 0;
    }

    // Get all events in time range
    const events = await ctx.db
      .query("analytics")
      .withIndex("by_user_and_time", (q) => 
        q.eq("userId", userId).gte("timestamp", startTime)
      )
      .collect();

    // Calculate stats
    const stats = {
      totalMessages: 0,
      totalTokens: { input: 0, output: 0 },
      modelUsage: new Map<string, {
        count: number;
        tokens: { input: number; output: number };
      }>(),
      featureUsage: {
        webSearches: 0,
        knowledgeSearches: 0,
        imagesGenerated: 0,
        templatesUsed: 0,
      },
      errors: 0,
      dailyActivity: new Map<string, {
        messageCount: number;
        tokenCount: number;
      }>(),
    };

    // Process events
    for (const event of events) {
      const date = new Date(event.timestamp).toISOString().split('T')[0];
      
      if (!stats.dailyActivity.has(date)) {
        stats.dailyActivity.set(date, { messageCount: 0, tokenCount: 0 });
      }

      switch (event.eventType) {
        case EVENT_TYPES.MESSAGE_SENT:
          stats.totalMessages++;
          const dayStats = stats.dailyActivity.get(date)!;
          dayStats.messageCount++;
          
          if (event.eventData) {
            // Token counting
            const inputTokens = event.eventData.inputTokens || 0;
            const outputTokens = event.eventData.outputTokens || 0;
            stats.totalTokens.input += inputTokens;
            stats.totalTokens.output += outputTokens;
            dayStats.tokenCount += inputTokens + outputTokens;

            // Model usage
            if (event.eventData.provider && event.eventData.model) {
              const key = `${event.eventData.provider}:${event.eventData.model}`;
              const modelStats = stats.modelUsage.get(key) || {
                count: 0,
                tokens: { input: 0, output: 0 },
              };
              modelStats.count++;
              modelStats.tokens.input += inputTokens;
              modelStats.tokens.output += outputTokens;
              stats.modelUsage.set(key, modelStats);
            }
          }
          break;

        case EVENT_TYPES.WEB_SEARCH:
          stats.featureUsage.webSearches++;
          break;

        case EVENT_TYPES.KNOWLEDGE_SEARCH:
          stats.featureUsage.knowledgeSearches++;
          break;

        case EVENT_TYPES.IMAGE_GENERATED:
          stats.featureUsage.imagesGenerated++;
          break;

        case EVENT_TYPES.TEMPLATE_USED:
          stats.featureUsage.templatesUsed++;
          break;

        case EVENT_TYPES.API_ERROR:
          stats.errors++;
          break;
      }
    }

    // Convert maps to arrays
    const modelUsageArray = Array.from(stats.modelUsage.entries()).map(([key, value]) => {
      const [provider, model] = key.split(':');
      return { provider, model, ...value };
    });

    const dailyActivityArray = Array.from(stats.dailyActivity.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Calculate error rate
    const errorRate = stats.totalMessages > 0 
      ? stats.errors / stats.totalMessages 
      : 0;

    return {
      totalMessages: stats.totalMessages,
      totalTokens: stats.totalTokens,
      modelUsage: modelUsageArray,
      featureUsage: stats.featureUsage,
      errorRate,
      dailyActivity: dailyActivityArray,
    };
  },
});

// Get project stats
export const getProjectStats = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.object({
    threadCount: v.number(),
    messageCount: v.number(),
    knowledgeBaseCount: v.number(),
    lastActivityAt: v.number(),
    tokenUsage: v.object({
      input: v.number(),
      output: v.number(),
    }),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return {
        threadCount: 0,
        messageCount: 0,
        knowledgeBaseCount: 0,
        lastActivityAt: 0,
        tokenUsage: { input: 0, output: 0 },
      };
    }

    // Verify project ownership
    const project = await ctx.db.get(args.projectId);
    if (!project || project.userId !== userId) {
      return {
        threadCount: 0,
        messageCount: 0,
        knowledgeBaseCount: 0,
        lastActivityAt: 0,
        tokenUsage: { input: 0, output: 0 },
      };
    }

    // Get thread count
    const threads = await ctx.db
      .query("threads")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    // Get message count and token usage
    let messageCount = 0;
    const tokenUsage = { input: 0, output: 0 };

    for (const thread of threads) {
      const messages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();

      messageCount += messages.length;

      for (const message of messages) {
        tokenUsage.input += message.inputTokens || 0;
        tokenUsage.output += message.outputTokens || 0;
      }
    }

    // Get knowledge base count
    const knowledgeBaseCount = await ctx.db
      .query("knowledgeBase")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect()
      .then(docs => docs.length);

    return {
      threadCount: threads.length,
      messageCount,
      knowledgeBaseCount,
      lastActivityAt: project.lastActivityAt,
      tokenUsage,
    };
  },
});

// Get popular models across all users (for recommendations)
export const getPopularModels = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(v.object({
    provider: v.string(),
    model: v.string(),
    userCount: v.number(),
    totalMessages: v.number(),
  })),
  handler: async (ctx, args) => {
    const limit = args.limit || 5;

    // Get all recent message events
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const events = await ctx.db
      .query("analytics")
      .withIndex("by_event_type", (q) => q.eq("eventType", EVENT_TYPES.MESSAGE_SENT))
      .filter((q) => q.gte(q.field("timestamp"), thirtyDaysAgo))
      .collect();

    // Aggregate by model
    const modelStats = new Map<string, {
      users: Set<string>;
      count: number;
    }>();

    for (const event of events) {
      if (event.eventData?.provider && event.eventData?.model) {
        const key = `${event.eventData.provider}:${event.eventData.model}`;
        const stats = modelStats.get(key) || {
          users: new Set<string>(),
          count: 0,
        };
        stats.users.add(event.userId);
        stats.count++;
        modelStats.set(key, stats);
      }
    }

    // Convert to array and sort
    const popularModels = Array.from(modelStats.entries())
      .map(([key, stats]) => {
        const [provider, model] = key.split(':');
        return {
          provider,
          model,
          userCount: stats.users.size,
          totalMessages: stats.count,
        };
      })
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, limit);

    return popularModels;
  },
});

// Clean up old analytics data (scheduled job)
export const cleanupOldData = internalMutation({
  args: {
    daysToKeep: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cutoffTime = Date.now() - args.daysToKeep * 24 * 60 * 60 * 1000;

    // Get old events
    const oldEvents = await ctx.db
      .query("analytics")
      .filter((q) => q.lt(q.field("timestamp"), cutoffTime))
      .collect();

    // Delete in batches
    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
    }

    return null;
  },
});
