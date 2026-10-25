CREATE TABLE `favorites` (
	`user_id` bigint unsigned NOT NULL,
	`kind` enum('player','club') NOT NULL,
	`tag` varchar(16) NOT NULL,
	`name` varchar(64) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `favorites_user_id_kind_tag_pk` PRIMARY KEY(`user_id`,`kind`,`tag`)
);
--> statement-breakpoint
CREATE TABLE `seasons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(64) NOT NULL,
	`started_at` datetime NOT NULL,
	`ended_at` datetime,
	CONSTRAINT `seasons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` char(64) NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tier_votes` (
	`season_id` int NOT NULL,
	`user_id` bigint unsigned NOT NULL,
	`brawler_id` int NOT NULL,
	`tier` tinyint NOT NULL,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `tier_votes_season_id_user_id_brawler_id_pk` PRIMARY KEY(`season_id`,`user_id`,`brawler_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint unsigned AUTO_INCREMENT NOT NULL,
	`discord_id` varchar(32) NOT NULL,
	`username` varchar(64) NOT NULL,
	`avatar_url` varchar(255),
	`player_tag` varchar(16),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_discord_id_unique` UNIQUE(`discord_id`)
);
--> statement-breakpoint
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tier_votes` ADD CONSTRAINT `tier_votes_season_id_seasons_id_fk` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tier_votes` ADD CONSTRAINT `tier_votes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;