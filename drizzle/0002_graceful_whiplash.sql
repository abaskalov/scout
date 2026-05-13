ALTER TABLE `pivot_users_projects` ADD `role` text DEFAULT 'reporter' NOT NULL;
--> statement-breakpoint
UPDATE `pivot_users_projects`
SET `role` = 'developer'
WHERE `user_id` IN (SELECT `id` FROM `users` WHERE `role` = 'agent');
