import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {

  threads: defineTable({
    title: v.string(),
    userId: v.id("users"),
    lastMessageAt: v.number(),
    // AI Provider settings
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    // Branching support
    parentThreadId: v.optional(v.id("threads")),
    branchPoint: v.optional(v.id("messages")),
    // Sharing
    isPublic: v.optional(v.boolean()),
    shareId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_last_message", ["userId", "lastMessageAt"])
    .index("by_share_id", ["shareId"]),

  messages: defineTable({
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    content: v.string(),
    isStreaming: v.optional(v.boolean()),
    cursor: v.optional(v.boolean()),
    // Model info
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    // Token usage
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    // Tool/Function calls
    toolCalls: v.optional(v.array(v.object({
      id: v.string(),
      type: v.string(),
      function: v.object({
        name: v.string(),
        arguments: v.string(),
      }),
    }))),
    // Image generation
    generatedImageUrl: v.optional(v.string()),
  })
    .index("by_thread", ["threadId"]),

  attachments: defineTable({
    messageId: v.id("messages"),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    // Extracted text for PDFs
    extractedText: v.optional(v.string()),
  }).index("by_message", ["messageId"]),

  // User preferences
  userSettings: defineTable({
    userId: v.id("users"),
    defaultProvider: v.optional(v.string()),
    defaultModel: v.optional(v.string()),
    // Encrypted API keys stored client-side only
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("system"))),
  }).index("by_user", ["userId"]),

  // Web search results cache
  searchResults: defineTable({
    messageId: v.id("messages"),
    query: v.string(),
    results: v.array(v.object({
      title: v.string(),
      url: v.string(),
      snippet: v.string(),
      favicon: v.optional(v.string()),
    })),
    searchedAt: v.number(),
  }).index("by_message", ["messageId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
