CREATE TABLE `scout_item_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`item_id` text NOT NULL,
	`user_id` text,
	`kind` text DEFAULT 'handoff' NOT NULL,
	`environment` text NOT NULL,
	`role` text,
	`url` text,
	`scenario` text NOT NULL,
	`action` text NOT NULL,
	`visible_result` text NOT NULL,
	`console_result` text,
	`network_result` text,
	`api_result` text,
	`db_result` text,
	`fixture` text,
	`cleanup_result` text,
	`commit_sha` text,
	`deploy_sha` text,
	`risks` text,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `scout_items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_evidence_item_created` ON `scout_item_evidence` (`item_id`,`created_at`);
