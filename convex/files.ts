import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

if (!process.env.CONVEX_AWS_REGION || !process.env.CONVEX_AWS_ACCESS_KEY_ID || !process.env.CONVEX_AWS_SECRET_ACCESS_KEY) {
  throw new Error("Missing AWS configuration environment variables");
}

const s3Client = new S3Client({
  region: process.env.CONVEX_AWS_REGION,
  credentials: {
    accessKeyId: process.env.CONVEX_AWS_ACCESS_KEY_ID as string,
    secretAccessKey: process.env.CONVEX_AWS_SECRET_ACCESS_KEY as string,
  },
});

export const generateUploadUrl = mutation({
  args: { fileName: v.string(), fileType: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const command = new PutObjectCommand({
      Bucket: process.env.CONVEX_AWS_S3_BUCKET,
      Key: args.fileName,
      ContentType: args.fileType,
    });

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    return uploadUrl;
  },
});


// export const generateUploadUrl = mutation({
//   args: {},
//   handler: async (ctx) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) throw new Error("Not authenticated");
//     return await ctx.storage.generateUploadUrl();
//   },
// });

export const createFile = mutation({
  args: {
    name: v.string(),
    size: v.number(),
    storageId: v.string(),
    parentId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("files", {
      name: args.name,
      size: args.size,
      storageId: args.storageId,
      parentId: args.parentId,
      ownerId: userId,
    });
  },
});

export const createFolder = mutation({
  args: {
    name: v.string(),
    parentId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("folders", {
      name: args.name,
      parentId: args.parentId,
      ownerId: userId,
    });
  },
});


export const listItems = query({
  args: {
    parentId: v.optional(v.union(v.id("folders"), v.null())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { files: [], folders: [] };

    const files = await ctx.db
      .query("files")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();

    const folders = await ctx.db
      .query("folders")
      .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
      .collect();

    const filesWithUrls = await Promise.all(
      files.map(async (file) => {
        const command = new GetObjectCommand({
          Bucket: process.env.CONVEX_AWS_S3_BUCKET,
          Key: file.storageId,
        });
        const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
        return { ...file, url };
      })
    );

    return { files: filesWithUrls, folders };
  },
});
// export const listItems = query({
//   args: {
//     parentId: v.optional(v.union(v.id("folders"), v.null())),
//   },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) return { files: [], folders: [] };

//     const files = await ctx.db
//       .query("files")
//       .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
//       .collect();

//     const folders = await ctx.db
//       .query("folders")
//       .withIndex("by_parent", (q) => q.eq("parentId", args.parentId))
//       .collect();

//     const filesWithUrls = await Promise.all(
//       files.map(async (file) => ({
//         ...file,
//         url: await ctx.storage.getUrl(file.storageId),
//       }))
//     );

//     return { files: filesWithUrls, folders };
//   },
// });

// export const deleteFile = mutation({
//   args: { fileId: v.id("files") },
//   handler: async (ctx, args) => {
//     const userId = await getAuthUserId(ctx);
//     if (!userId) throw new Error("Not authenticated");

//     const file = await ctx.db.get(args.fileId);
//     if (!file || file.ownerId !== userId) {
//       throw new Error("File not found or unauthorized");
//     }

//     await ctx.storage.delete(file.storageId);
//     await ctx.db.delete(args.fileId);
//   },
// });

export const deleteFile = mutation({
  args: { fileId: v.id("files") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const file = await ctx.db.get(args.fileId);
    if (!file || file.ownerId !== userId) {
      throw new Error("File not found or unauthorized");
    }

    // Delete the file from S3
    const deleteParams = {
      Bucket: process.env.CONVEX_AWS_S3_BUCKET,
      Key: file.storageId, // The S3 key stored in the database
    };

    try {
      await s3Client.send(new DeleteObjectCommand(deleteParams));
    } catch (error) {
      console.error("Error deleting file from S3:", error);
      throw new Error("Failed to delete file from S3");
    }

    // Delete the file record from the database
    await ctx.db.delete(args.fileId);
  },
});

export const deleteFolder = mutation({
  args: { folderId: v.id("folders") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const folder = await ctx.db.get(args.folderId);
    if (!folder || folder.ownerId !== userId) {
      throw new Error("Folder not found or unauthorized");
    }

    await ctx.db.delete(args.folderId);
  },
});
