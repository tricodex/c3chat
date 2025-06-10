import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {

  threads: defineTable({
    title: v.string(),
    userId: v.id("users"),
    lastMessageAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_and_last_message", ["userId", "lastMessageAt"]),

  messages: defineTable({
    threadId: v.id("threads"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    isStreaming: v.optional(v.boolean()),
    cursor: v.optional(v.boolean()),
  })
    .index("by_thread", ["threadId"]),

  attachments: defineTable({
    messageId: v.id("messages"),
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    size: v.number(),
  }).index("by_message", ["messageId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
