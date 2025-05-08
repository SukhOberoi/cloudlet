import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  files: defineTable({
    name: v.string(),
    size: v.number(),
    storageId: v.string(),
    parentId: v.optional(v.union(v.id("folders"), v.null())),
    ownerId: v.id("users"),
  })
    .index("by_parent", ["parentId"])
    .index("by_storageId", ["storageId"]),

  folders: defineTable({
    name: v.string(),
    parentId: v.optional(v.union(v.id("folders"), v.null())),
    ownerId: v.id("users"),
  }).index("by_parent", ["parentId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
