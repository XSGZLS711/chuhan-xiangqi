import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('rooms',{id:text('id').primaryKey(),state:text('state').notNull(),version:integer('version').notNull().default(0),updatedAt:integer('updated_at').notNull()});
export const presence=sqliteTable('presence',{id:text('id').primaryKey(),seenAt:integer('seen_at').notNull()});
