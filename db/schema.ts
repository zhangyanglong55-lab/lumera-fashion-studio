import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

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
