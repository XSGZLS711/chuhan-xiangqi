import {sqliteTable,text,integer,primaryKey,index} from 'drizzle-orm/sqlite-core';
export const rooms=sqliteTable('rooms',{id:text('id').primaryKey(),state:text('state').notNull(),version:integer('version').notNull().default(0),updatedAt:integer('updated_at').notNull()});
export const presence=sqliteTable('presence',{id:text('id').primaryKey(),seenAt:integer('seen_at').notNull()});
// An account; each way of signing in to it is one row in identities (only Google for now).
export const users=sqliteTable('users',{id:text('id').primaryKey(),name:text('name').notNull(),createdAt:integer('created_at').notNull()});
export const identities=sqliteTable('identities',{provider:text('provider').notNull(),subject:text('subject').notNull(),userId:text('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),email:text('email').notNull().default(''),createdAt:integer('created_at').notNull()},(t)=>[primaryKey({columns:[t.provider,t.subject]}),index('identities_user').on(t.userId)]);
// Keyed by the hash of the session cookie, like anonymous players.
export const sessions=sqliteTable('sessions',{id:text('id').primaryKey(),userId:text('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),createdAt:integer('created_at').notNull(),expiresAt:integer('expires_at').notNull()},(t)=>[index('sessions_user').on(t.userId)]);
// A signed-in player's finished games: the compact ArchivedGame JSON, newest 200 per account.
export const archivedGames=sqliteTable('archived_games',{userId:text('user_id').notNull().references(()=>users.id,{onDelete:'cascade'}),id:text('id').notNull(),playedAt:integer('played_at').notNull(),data:text('data').notNull(),createdAt:integer('created_at').notNull()},(t)=>[primaryKey({columns:[t.userId,t.id]}),index('archived_games_newest').on(t.userId,t.playedAt,t.id)]);
