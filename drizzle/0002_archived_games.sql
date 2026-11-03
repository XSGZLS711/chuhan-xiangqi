CREATE TABLE `archived_games` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`played_at` integer NOT NULL,
	`data` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `archived_games_newest` ON `archived_games` (`user_id`,`played_at`,`id`);