CREATE TABLE `auto_candidates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`station_id` integer NOT NULL,
	`detected_at` integer NOT NULL,
	`kind_guess` text NOT NULL,
	`dwell_sec` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`visit_id` integer
);
--> statement-breakpoint
CREATE INDEX `auto_candidates_status_idx` ON `auto_candidates` (`status`,`detected_at`);--> statement-breakpoint
CREATE TABLE `excluded_stations` (
	`station_id` integer PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`visit_id` integer NOT NULL,
	`asset_id` text,
	`uri` text,
	`taken_at` integer,
	`lat` real,
	`lng` real,
	FOREIGN KEY (`visit_id`) REFERENCES `visits`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `photos_visit_idx` ON `photos` (`visit_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `visits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`station_id` integer NOT NULL,
	`kind` text NOT NULL,
	`visited_on` text,
	`source` text NOT NULL,
	`memo` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `visits_station_idx` ON `visits` (`station_id`);--> statement-breakpoint
CREATE INDEX `visits_date_idx` ON `visits` (`visited_on`);