ALTER TABLE `scout_items` ADD `item_type` text DEFAULT 'bug' NOT NULL;
--> statement-breakpoint
ALTER TABLE `scout_items` ADD `source` text DEFAULT 'widget' NOT NULL;
--> statement-breakpoint
CREATE INDEX `idx_items_project_type` ON `scout_items` (`project_id`,`item_type`);
