import { z } from 'zod';

// === Shared ===
const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(20),
});

const uuidSchema = z.string().uuid();

// === Auth ===
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// === Projects ===
export const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string()
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens')
    .min(2)
    .max(50),
  allowedOrigins: z.array(z.string().url()).default([]),
});

export const updateProjectSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100).optional(),
  allowedOrigins: z.array(z.string().url()).optional(),
  autofixEnabled: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const getProjectSchema = z.object({ id: uuidSchema });
export const deleteProjectSchema = z.object({ id: uuidSchema });
export const listProjectsSchema = paginationSchema;

// === Users ===
export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).max(100),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'member', 'agent']),
  projectIds: z.array(uuidSchema).default([]),
});

export const updateUserSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100).optional(),
  role: z.enum(['admin', 'member', 'agent']).optional(),
  isActive: z.boolean().optional(),
  projectIds: z.array(uuidSchema).optional(),
  password: z.string().min(6).max(100).optional(),
});

export const getUserSchema = z.object({ id: uuidSchema });
export const deleteUserSchema = z.object({ id: uuidSchema });
export const listUsersSchema = paginationSchema.extend({
  projectId: uuidSchema.optional(),
});

// === Items ===
export const createItemSchema = z.object({
  projectId: uuidSchema,
  message: z.string().min(3).max(5000),
  pageUrl: z.string().max(500).nullish(),
  pageRoute: z.string().max(255).nullish(),
  componentFile: z.string().max(255).nullish(),
  cssSelector: z.string().max(1000).nullish(),
  elementText: z.string().transform((v) => v?.substring(0, 500)).nullish(),
  elementHtml: z.string().transform((v) => v?.substring(0, 2000)).nullish(),
  viewportWidth: z.number().int().min(1).nullish(),
  viewportHeight: z.number().int().min(1).nullish(),
  screenshot: z.string().max(7_000_000).nullish(),       // base64, ~5MB file
  sessionRecording: z.string().max(3_000_000).nullish(),  // base64, ~2MB file
});

export const listItemsSchema = paginationSchema.extend({
  projectId: uuidSchema,
  status: z.enum(['new', 'in_progress', 'review', 'done', 'cancelled']).optional(),
  assigneeId: uuidSchema.optional(),
});

export const getItemSchema = z.object({ id: uuidSchema });

export const countItemsSchema = z.object({
  projectId: uuidSchema,
  status: z.enum(['new', 'in_progress', 'review', 'done', 'cancelled']).optional(),
});

export const claimItemSchema = z.object({ id: uuidSchema });

export const resolveItemSchema = z.object({
  id: uuidSchema,
  resolutionNote: z.string().max(5000).optional(),
  branchName: z.string().max(255).optional(),
  mrUrl: z.string().url().max(500).optional(),
});

export const cancelItemSchema = z.object({ id: uuidSchema });

export const updateItemStatusSchema = z.object({
  id: uuidSchema,
  status: z.enum(['new', 'in_progress', 'review', 'done', 'cancelled']),
  branchName: z.string().max(255).optional(),
  mrUrl: z.string().url().max(500).optional(),
  attemptCount: z.number().int().min(0).optional(),
});

export const addNoteSchema = z.object({
  itemId: uuidSchema,
  content: z.string().min(1).max(5000),
});
