"use server";

import prisma from "@/utils/prisma";
import type { MigrateLocalTemplatesBody } from "@/utils/actions/compose-template.validation";
import {
  createTemplateBody,
  updateTemplateBody,
  deleteTemplateBody,
  setDefaultPersonaBody,
  migrateLocalTemplatesBody,
} from "@/utils/actions/compose-template.validation";
import { actionClient } from "@/utils/actions/safe-action";
import { SafeError } from "@/utils/error";

const MAX_TEMPLATES_PER_ACCOUNT = 50;

export const createTemplateAction = actionClient
  .metadata({ name: "createTemplate" })
  .inputSchema(createTemplateBody)
  .action(
    async ({
      ctx: { emailAccountId },
      parsedInput: { name, subject, bodyHtml, to, cc, bcc, persona },
    }) => {
      const templateCount = await prisma.composeTemplate.count({
        where: { emailAccountId },
      });

      if (templateCount >= MAX_TEMPLATES_PER_ACCOUNT) {
        throw new SafeError(
          `You can save up to ${MAX_TEMPLATES_PER_ACCOUNT} templates. Please delete some templates to create new ones.`,
        );
      }

      const existing = await prisma.composeTemplate.findUnique({
        where: { emailAccountId_name: { emailAccountId, name } },
      });

      if (existing) {
        throw new SafeError(
          `A template with the name "${name}" already exists.`,
        );
      }

      return await prisma.composeTemplate.create({
        data: {
          name,
          subject,
          bodyHtml,
          to,
          cc,
          bcc,
          persona,
          emailAccountId,
        },
      });
    },
  );

export const updateTemplateAction = actionClient
  .metadata({ name: "updateTemplate" })
  .inputSchema(updateTemplateBody)
  .action(
    async ({
      ctx: { emailAccountId },
      parsedInput: { id, name, subject, bodyHtml, to, cc, bcc, persona },
    }) => {
      const template = await prisma.composeTemplate.findUnique({
        where: { id, emailAccountId },
      });

      if (!template) {
        throw new SafeError("Template not found.");
      }

      if (name && name !== template.name) {
        const existing = await prisma.composeTemplate.findUnique({
          where: { emailAccountId_name: { emailAccountId, name } },
        });

        if (existing) {
          throw new SafeError(
            `A template with the name "${name}" already exists.`,
          );
        }
      }

      return await prisma.composeTemplate.update({
        where: { id, emailAccountId },
        data: {
          ...(name !== undefined && { name }),
          ...(subject !== undefined && { subject }),
          ...(bodyHtml !== undefined && { bodyHtml }),
          ...(to !== undefined && { to }),
          ...(cc !== undefined && { cc }),
          ...(bcc !== undefined && { bcc }),
          ...(persona !== undefined && { persona }),
        },
      });
    },
  );

export const deleteTemplateAction = actionClient
  .metadata({ name: "deleteTemplate" })
  .inputSchema(deleteTemplateBody)
  .action(async ({ ctx: { emailAccountId }, parsedInput: { id } }) => {
    await prisma.composeTemplate.delete({
      where: { id, emailAccountId },
    });
  });

export const setDefaultPersonaAction = actionClient
  .metadata({ name: "setDefaultPersona" })
  .inputSchema(setDefaultPersonaBody)
  .action(async ({ ctx: { emailAccountId }, parsedInput: { persona } }) => {
    await prisma.emailAccount.update({
      where: { id: emailAccountId },
      data: { defaultPersona: persona },
    });
  });

export const migrateLocalTemplatesAction = actionClient
  .metadata({ name: "migrateLocalTemplates" })
  .inputSchema(migrateLocalTemplatesBody)
  .action(async ({ ctx: { emailAccountId }, parsedInput: { templates } }) => {
    const existing = await prisma.composeTemplate.findMany({
      where: { emailAccountId },
      select: { name: true },
    });

    type LocalTemplate = MigrateLocalTemplatesBody["templates"][number];
    const existingNames = new Set(
      existing.map((t: { name: string }) => t.name),
    );

    const newTemplates = templates.filter(
      (t: LocalTemplate) => !existingNames.has(t.name),
    );

    const remainingSlots = MAX_TEMPLATES_PER_ACCOUNT - existing.length;
    const templatesToCreate = newTemplates.slice(0, remainingSlots);

    if (templatesToCreate.length > 0) {
      await prisma.composeTemplate.createMany({
        data: templatesToCreate.map((t: LocalTemplate) => ({
          name: t.name,
          subject: t.subject,
          bodyHtml: t.bodyHtml,
          to: t.to,
          cc: t.cc,
          bcc: t.bcc,
          emailAccountId,
        })),
      });
    }

    return { migrated: templatesToCreate.length };
  });
