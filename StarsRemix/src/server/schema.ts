import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

export const communityBoards = pgTable("community_boards", {
  id: uuid("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  authorName: varchar("author_name", { length: 80 }).notNull(),
  title: varchar("title", { length: 80 }).notNull(),
  puzzle: jsonb("puzzle").notNull(),
  solution: jsonb("solution").notNull(),
  difficulty: jsonb("difficulty").notNull(),
  fingerprint: varchar("fingerprint", { length: 64 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("community_boards_fingerprint_unique").on(table.fingerprint),
  index("community_boards_owner_created_idx").on(table.ownerId, table.createdAt),
  index("community_boards_created_idx").on(table.createdAt),
]);
