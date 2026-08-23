import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const videoTemplates = sqliteTable("video_templates", {
  id: text("id").primaryKey(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  prompt: text("prompt").notNull(),
  previewUrl: text("preview_url"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const promptVideos = sqliteTable("prompt_videos", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description").notNull(),
  prompt: text("prompt").notNull(),
  videoUrl: text("video_url"),
  videoKey: text("video_key"),
  posterUrl: text("poster_url"),
  posterKey: text("poster_key"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_prompt_videos_enabled_sort").on(table.enabled, table.sortOrder)]);
