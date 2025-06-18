import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // Projects/Workspaces for organizing conversations
  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    userId: v.id("users"),
    createdAt: v.number(),
    threadCount: v.number(),
    memberCount: v.number(),
    lastActivityAt: v.number(),
    isPublic: v.boolean(),
    shareId: v.optional(v.string()),
    settings: v.optional(v.object({
      defaultModel: v.optional(v.string()),
      defaultProvider: v.optional(v.string()),
      enableKnowledgeBase: v.optional(v.boolean()),
      enableWebSearch: v.optional(v.boolean()),
      autoArchiveDays: v.optional(v.number()),
    })),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_activity", ["userId", "lastActivityAt"])
    .index("by_share_id", ["shareId"]),

  // Project members for collaboration
  projectMembers: defineTable({
    projectId: v.id("projects"),
    userId: v.id("users"),
    role: v.union(v.literal("owner"), v.literal("admin"), v.literal("member"), v.literal("viewer")),
    joinedAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_user", ["userId"])
    .index("by_project_and_user", ["projectId", "userId"]),

  threads: defineTable({
    title: v.string(),
    userId: v.id("users"),
    lastMessageAt: v.number(),
    // Project/Workspace
    projectId: v.optional(v.id("projects")),
    // AI Provider settings
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
    // Branching support
    parentThreadId: v.optional(v.id("threads")),
    branchPoint: v.optional(v.id("messages")),
    // Sharing
    isPublic: v.optional(v.boolean()),
    shareId: v.optional(v.string()),
    // Archive status
    archived: v.optional(v.boolean()),
    // Tags for organization
    tags: v.optional(v.array(v.string())),
    // AI agent ID for specialized behavior
    agentId: v.optional(v.string()),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_last_message", ["userId", "lastMessageAt"])
    .index("by_share_id", ["shareId"])
    .index("by_project", ["projectId"])
    .index("by_user_and_project", ["userId", "projectId"]),

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
    // Media generation
    generatedImageUrl: v.optional(v.string()),
    generatedVideoUrl: v.optional(v.string()),
    // Edit tracking
    editedAt: v.optional(v.number()),
  })
    .index("by_thread", ["threadId"]),

  attachments: defineTable({
    messageId: v.optional(v.id("messages")),
    threadId: v.optional(v.id("threads")),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
    uploadedAt: v.number(),
    // Extracted text for PDFs
    extractedText: v.optional(v.string()),
    // Processing metadata
    metadata: v.optional(v.any()),
  })
    .index("by_message", ["messageId"])
    .index("by_thread", ["threadId"]),

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

  // Saved prompts/templates
  promptTemplates: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    prompt: v.string(),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    isPublic: v.optional(v.boolean()),
    usageCount: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_category", ["category"])
    .index("by_public", ["isPublic"]),

  // Knowledge base documents
  knowledgeBase: defineTable({
    userId: v.id("users"),
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    content: v.string(),
    type: v.union(
      v.literal("document"),
      v.literal("guide"),
      v.literal("faq"),
      v.literal("reference"),
      v.literal("snippet")
    ),
    tags: v.array(v.string()),
    storageId: v.optional(v.id("_storage")),
    searchVector: v.optional(v.array(v.float64())),
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      author: v.optional(v.string()),
      url: v.optional(v.string()),
      language: v.optional(v.string()),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_project", ["projectId"])
    .vectorIndex("by_embedding", {
      vectorField: "searchVector",
      dimensions: 1536,
    }),

  // API Keys (encrypted client-side)
  apiKeys: defineTable({
    userId: v.id("users"),
    provider: v.string(),
    encryptedKey: v.string(),
    lastUsed: v.optional(v.number()),
    usageCount: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_provider", ["userId", "provider"]),

  // Active collaboration sessions
  activeSessions: defineTable({
    threadId: v.id("threads"),
    userId: v.id("users"),
    cursor: v.object({
      line: v.number(),
      column: v.number(),
    }),
    isTyping: v.boolean(),
    lastActivity: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_user", ["userId"])
    .index("by_user_and_thread", ["userId", "threadId"]),

  // Collaborative annotations
  annotations: defineTable({
    threadId: v.id("threads"),
    messageId: v.id("messages"),
    userId: v.id("users"),
    content: v.string(),
    position: v.optional(v.object({
      start: v.number(),
      end: v.number(),
    })),
    createdAt: v.number(),
  })
    .index("by_thread", ["threadId"])
    .index("by_message", ["messageId"])
    .index("by_user", ["userId"]),

  // Analytics/Usage tracking
  analytics: defineTable({
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
    })),
    timestamp: v.number(),
  })
    .index("by_user_and_time", ["userId", "timestamp"])
    .index("by_event_type", ["eventType"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
