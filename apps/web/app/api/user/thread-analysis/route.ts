import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/utils/prisma";
import { withEmailAccount } from "@/utils/middleware";

const querySchema = z.object({
  threadId: z.string(),
});

export type ThreadAnalysisResponse = Awaited<ReturnType<typeof getAnalysis>>;

async function getAnalysis(options: {
  emailAccountId: string;
  threadId: string;
}) {
  return await prisma.threadAnalysis.findUnique({
    where: {
      emailAccountId_threadId: {
        emailAccountId: options.emailAccountId,
        threadId: options.threadId,
      },
    },
  });
}

export const GET = withEmailAccount("user/thread-analysis", async (request) => {
  const emailAccountId = request.auth.emailAccountId;
  const { searchParams } = new URL(request.url);

  const parsed = querySchema.safeParse({
    threadId: searchParams.get("threadId"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "threadId is required" },
      { status: 400 },
    );
  }

  const analysis = await getAnalysis({
    emailAccountId,
    threadId: parsed.data.threadId,
  });

  return NextResponse.json(analysis);
});
