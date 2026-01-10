import { z } from "zod";

export const createTemplateBody = z.object({
  name: z.string().min(1, "Name is required").max(100),
  subject: z.string().max(200).optional(),
  bodyHtml: z.string().max(50_000).optional(),
  to: z.string().max(500).optional(),
  cc: z.string().max(500).optional(),
  bcc: z.string().max(500).optional(),
  persona: z.string().max(50).optional(),
});

export type CreateTemplateBody = z.infer<typeof createTemplateBody>;

export const updateTemplateBody = z.object({
  id: z.string(),
  name: z.string().min(1, "Name is required").max(100).optional(),
  subject: z.string().max(200).optional().nullable(),
  bodyHtml: z.string().max(50_000).optional().nullable(),
  to: z.string().max(500).optional().nullable(),
  cc: z.string().max(500).optional().nullable(),
  bcc: z.string().max(500).optional().nullable(),
  persona: z.string().max(50).optional().nullable(),
});

export type UpdateTemplateBody = z.infer<typeof updateTemplateBody>;

export const deleteTemplateBody = z.object({
  id: z.string(),
});

export type DeleteTemplateBody = z.infer<typeof deleteTemplateBody>;

export const setDefaultPersonaBody = z.object({
  persona: z.string().max(50).nullable(),
});

export type SetDefaultPersonaBody = z.infer<typeof setDefaultPersonaBody>;

export const migrateLocalTemplatesBody = z.object({
  templates: z.array(
    z.object({
      name: z.string().min(1).max(100),
      subject: z.string().max(200).optional(),
      bodyHtml: z.string().max(50_000).optional(),
      to: z.string().max(500).optional(),
      cc: z.string().max(500).optional(),
      bcc: z.string().max(500).optional(),
    }),
  ),
});

export type MigrateLocalTemplatesBody = z.infer<
  typeof migrateLocalTemplatesBody
>;
