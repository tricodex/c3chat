import { mutation, query, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api, internal } from "./_generated/api";
import OpenAI from "openai";

// Add a document to the knowledge base
export const addDocument = mutation({
  args: {
    projectId: v.optional(v.id("projects")),
    title: v.string(),
    content: v.string(),
    type: v.optional(v.union(
      v.literal("document"),
      v.literal("guide"),
      v.literal("faq"),
      v.literal("reference"),
      v.literal("snippet")
    )),
    tags: v.optional(v.array(v.string())),
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      author: v.optional(v.string()),
      url: v.optional(v.string()),
      language: v.optional(v.string()),
    })),
  },
  returns: v.id("knowledgeBase"),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    // Check project access if projectId provided
    if (args.projectId) {
      const project = await ctx.db.get(args.projectId);
      if (!project) {
        throw new Error("Project not found");
      }

      // Check permissions
      const hasAccess = project.userId === userId || 
        await checkProjectAccess(ctx, args.projectId, userId, "member");
      
      if (!hasAccess) {
        throw new Error("Not authorized to add to this project");
      }
    }

    const docId = await ctx.db.insert("knowledgeBase", {
      projectId: args.projectId,
      userId,
      title: args.title,
      content: args.content,
      type: args.type || "document",
      tags: args.tags || [],
      metadata: args.metadata || {},
      searchVector: undefined, // Will be set by embedding generation
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Schedule embedding generation
    await ctx.scheduler.runAfter(0, internal.knowledgeBase.generateEmbedding, {
      documentId: docId,
    });

    return docId;
  },
});

// Generate embedding for a document
export const generateEmbedding = internalAction({
  args: {
    documentId: v.id("knowledgeBase"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const document = await ctx.runQuery(internal.knowledgeBase.getDocument, {
      documentId: args.documentId,
    });

    if (!document) {
      throw new Error("Document not found");
    }

    const apiKey = process.env.CONVEX_OPENAI_API_KEY;
    if (!apiKey) {
      console.warn("OpenAI API key not configured for embeddings");
      return null;
    }

    const client = new OpenAI({ apiKey });

    try {
      // Generate embedding for title + content
      const textToEmbed = `${document.title}\n\n${document.content}`.slice(0, 8000);
      
      const response = await client.embeddings.create({
        model: "text-embedding-3-small",
        input: textToEmbed,
      });

      const embedding = response.data[0].embedding;

      // Store embedding
      await ctx.runMutation(internal.knowledgeBase.storeEmbedding, {
        documentId: args.documentId,
        embedding: new Float32Array(embedding),
      });

      return null;
    } catch (error) {
      console.error("Failed to generate embedding:", error);
      return null;
    }
  },
});

// Internal mutation to store embedding
export const storeEmbedding = internalMutation({
  args: {
    documentId: v.id("knowledgeBase"),
    embedding: v.any(), // Float32Array
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      searchVector: args.embedding,
    });
    return null;
  },
});

// Internal query to get document
export const getDocument = query({
  args: {
    documentId: v.id("knowledgeBase"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.documentId);
  },
});

// Search knowledge base
export const search = action({
  args: {
    query: v.string(),
    projectId: v.optional(v.id("projects")),
    limit: v.optional(v.number()),
    type: v.optional(v.union(
      v.literal("document"),
      v.literal("guide"),
      v.literal("faq"),
      v.literal("reference"),
      v.literal("snippet")
    )),
    tags: v.optional(v.array(v.string())),
  },
  returns: v.array(v.object({
    _id: v.id("knowledgeBase"),
    title: v.string(),
    content: v.string(),
    type: v.string(),
    tags: v.array(v.string()),
    score: v.number(),
    snippet: v.string(),
  })),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const limit = args.limit || 10;

    // First, try vector search if we have embeddings
    const apiKey = process.env.CONVEX_OPENAI_API_KEY;
    let vectorResults: any[] = [];
    
    if (apiKey) {
      const client = new OpenAI({ apiKey });
      
      try {
        // Generate embedding for query
        const response = await client.embeddings.create({
          model: "text-embedding-3-small",
          input: args.query,
        });

        const queryEmbedding = new Float32Array(response.data[0].embedding);

        // Search with vector similarity
        let vectorQuery = ctx.vectorSearch("knowledgeBase", "by_embedding", queryEmbedding)
          .limit(limit * 2); // Get more to filter later

        if (args.projectId) {
          vectorQuery = vectorQuery.filter((q) => q.eq("projectId", args.projectId));
        }

        const results = await vectorQuery.execute();
        
        vectorResults = results.map(r => ({
          ...r,
          score: 1 - r._score, // Convert distance to similarity
        }));
      } catch (error) {
        console.error("Vector search failed:", error);
      }
    }

    // Fallback to text search
    let textResults = await ctx.runQuery(api.knowledgeBase.textSearch, {
      query: args.query,
      projectId: args.projectId,
      limit: limit * 2,
    });

    // Combine and deduplicate results
    const allResults = new Map();
    
    // Add vector results first (higher priority)
    vectorResults.forEach(r => {
      allResults.set(r._id, { ...r, score: r.score });
    });

    // Add text results
    textResults.forEach(r => {
      if (!allResults.has(r._id)) {
        allResults.set(r._id, { ...r, score: r.score * 0.8 }); // Lower score for text-only matches
      }
    });

    // Filter by type and tags if specified
    let finalResults = Array.from(allResults.values());
    
    if (args.type) {
      finalResults = finalResults.filter(r => r.type === args.type);
    }

    if (args.tags && args.tags.length > 0) {
      finalResults = finalResults.filter(r => 
        args.tags!.some(tag => r.tags.includes(tag))
      );
    }

    // Check access permissions
    const accessibleResults = await Promise.all(
      finalResults.map(async (result) => {
        // User's own documents
        if (result.userId === userId) return result;

        // Project documents
        if (result.projectId) {
          const hasAccess = await checkProjectAccess(
            ctx, 
            result.projectId, 
            userId, 
            "viewer"
          );
          if (hasAccess) return result;
        }

        return null;
      })
    );

    // Sort by score and limit
    const sortedResults = accessibleResults
      .filter(r => r !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Generate snippets
    return sortedResults.map(r => ({
      _id: r._id,
      title: r.title,
      content: r.content,
      type: r.type,
      tags: r.tags,
      score: r.score,
      snippet: generateSnippet(r.content, args.query),
    }));
  },
});

// Text-based search fallback
export const textSearch = query({
  args: {
    query: v.string(),
    projectId: v.optional(v.id("projects")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    const limit = args.limit || 20;
    const queryLower = args.query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

    // Get all accessible documents
    let documents = await ctx.db.query("knowledgeBase").collect();

    // Filter by project if specified
    if (args.projectId) {
      documents = documents.filter(d => d.projectId === args.projectId);
    }

    // Score documents by relevance
    const scoredDocs = documents.map(doc => {
      let score = 0;
      const titleLower = doc.title.toLowerCase();
      const contentLower = doc.content.toLowerCase();

      // Title matches (higher weight)
      if (titleLower.includes(queryLower)) {
        score += 10;
      }
      queryWords.forEach(word => {
        if (titleLower.includes(word)) {
          score += 3;
        }
      });

      // Content matches
      if (contentLower.includes(queryLower)) {
        score += 5;
      }
      queryWords.forEach(word => {
        const count = (contentLower.match(new RegExp(word, 'g')) || []).length;
        score += Math.min(count * 0.5, 5);
      });

      // Tag matches
      doc.tags.forEach(tag => {
        if (tag.toLowerCase().includes(queryLower)) {
          score += 4;
        }
      });

      return { ...doc, score };
    });

    // Filter and sort
    return scoredDocs
      .filter(d => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },
});

// List knowledge base items
export const list = query({
  args: {
    projectId: v.optional(v.id("projects")),
    type: v.optional(v.union(
      v.literal("document"),
      v.literal("guide"),
      v.literal("faq"),
      v.literal("reference"),
      v.literal("snippet")
    )),
    tags: v.optional(v.array(v.string())),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return [];
    }

    let query = ctx.db.query("knowledgeBase");

    // Filter by project
    if (args.projectId) {
      const hasAccess = await checkProjectAccess(ctx, args.projectId, userId, "viewer");
      if (!hasAccess) {
        return [];
      }
      
      query = query.filter((q) => q.eq(q.field("projectId"), args.projectId));
    } else {
      // Only user's own documents if no project specified
      query = query.filter((q) => q.eq(q.field("userId"), userId));
    }

    let results = await query.collect();

    // Filter by type
    if (args.type) {
      results = results.filter(r => r.type === args.type);
    }

    // Filter by tags
    if (args.tags && args.tags.length > 0) {
      results = results.filter(r => 
        args.tags!.some(tag => r.tags.includes(tag))
      );
    }

    // Sort by updated time and limit
    return results
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, args.limit || 50);
  },
});

// Update document
export const update = mutation({
  args: {
    documentId: v.id("knowledgeBase"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("document"),
      v.literal("guide"),
      v.literal("faq"),
      v.literal("reference"),
      v.literal("snippet")
    )),
    tags: v.optional(v.array(v.string())),
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      author: v.optional(v.string()),
      url: v.optional(v.string()),
      language: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Check permissions
    const canEdit = document.userId === userId || 
      (document.projectId && await checkProjectAccess(ctx, document.projectId, userId, "member"));
    
    if (!canEdit) {
      throw new Error("Not authorized to edit this document");
    }

    const updates: any = { updatedAt: Date.now() };
    
    if (args.title !== undefined) updates.title = args.title;
    if (args.content !== undefined) updates.content = args.content;
    if (args.type !== undefined) updates.type = args.type;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.metadata !== undefined) {
      updates.metadata = { ...document.metadata, ...args.metadata };
    }

    await ctx.db.patch(args.documentId, updates);

    // Regenerate embedding if content changed
    if (args.title !== undefined || args.content !== undefined) {
      await ctx.scheduler.runAfter(0, internal.knowledgeBase.generateEmbedding, {
        documentId: args.documentId,
      });
    }
  },
});

// Delete document
export const remove = mutation({
  args: {
    documentId: v.id("knowledgeBase"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const document = await ctx.db.get(args.documentId);
    if (!document) {
      throw new Error("Document not found");
    }

    // Check permissions
    const canDelete = document.userId === userId || 
      (document.projectId && await checkProjectAccess(ctx, document.projectId, userId, "admin"));
    
    if (!canDelete) {
      throw new Error("Not authorized to delete this document");
    }

    await ctx.db.delete(args.documentId);
  },
});

// Helper functions
async function checkProjectAccess(
  ctx: any,
  projectId: any,
  userId: any,
  requiredRole: "owner" | "admin" | "member" | "viewer"
): Promise<boolean> {
  const project = await ctx.db.get(projectId);
  if (!project) return false;

  // Project owner always has access
  if (project.userId === userId) return true;

  // Public projects allow viewer access
  if (project.isPublic && requiredRole === "viewer") return true;

  // Check membership
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

function generateSnippet(content: string, query: string, maxLength: number = 200): string {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Find the best matching position
  const index = contentLower.indexOf(queryLower);
  
  if (index === -1) {
    // If exact match not found, return beginning of content
    return content.slice(0, maxLength) + (content.length > maxLength ? "..." : "");
  }

  // Extract snippet around the match
  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + queryLower.length + 150);
  
  let snippet = content.slice(start, end);
  
  // Add ellipsis if needed
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  
  return snippet;
}
