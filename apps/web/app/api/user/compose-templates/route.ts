import { NextResponse } from "next/server";
import prisma from "@/utils/prisma";
import { withEmailAccount } from "@/utils/middleware";

export type ComposeTemplatesResponse = Awaited<
  ReturnType<typeof getComposeTemplatesData>
>;

async function getComposeTemplatesData(options: { emailAccountId: string }) {
  const [templates, emailAccount] = await Promise.all([
    prisma.composeTemplate.findMany({
      where: { emailAccountId: options.emailAccountId },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.emailAccount.findUnique({
      where: { id: options.emailAccountId },
      select: { defaultPersona: true },
    }),
  ]);

  return {
    templates,
    defaultPersona: emailAccount?.defaultPersona ?? null,
  };
}

export const GET = withEmailAccount(
  "user/compose-templates",
  async (request) => {
    const emailAccountId = request.auth.emailAccountId;

    const data = await getComposeTemplatesData({ emailAccountId });

    return NextResponse.json(data);
  },
);
