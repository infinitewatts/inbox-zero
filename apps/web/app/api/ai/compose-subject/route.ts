import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/middleware";
import { composeSubjectBody } from "@/app/api/ai/compose-subject/validation";
import { getEmailAccountWithAi, getWritingStyle } from "@/utils/user/get";
import { getModel } from "@/utils/llms/model";
import { createGenerateObject } from "@/utils/llms";
import { SafeError } from "@/utils/error";
import { createScopedLogger } from "@/utils/logger";
import { checkAiRateLimit, rateLimitResponse } from "@/utils/ratelimit";

const logger = createScopedLogger("compose-subject");

const subjectSchema = z.object({
  subject: z
    .string()
    .describe("Concise subject line for the email, 3-8 words."),
});

export const POST = withEmailAccount(async (request) => {
  const emailAccountId = request.auth.emailAccountId;

  const emailAccount = await getEmailAccountWithAi({ emailAccountId });
  if (!emailAccount) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rateLimit = await checkAiRateLimit(emailAccount.userId);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetIn);
  }

  const writingStyle = await getWritingStyle({ emailAccountId });

  const json = await request.json();
  const { content, prompt, to } = composeSubjectBody.parse(json);

  const system = `You are an expert email assistant. Generate a concise subject line.
Return only the subject. Keep it short and specific.`;

  const userPrompt = [
    emailAccount.about ? `About the user:\n${emailAccount.about}` : null,
    writingStyle ? `Writing style:\n${writingStyle}` : null,
    to ? `Recipient:\n${to}` : null,
    prompt ? `User prompt:\n${prompt}` : null,
    `Email content:\n${content}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const modelOptions = getModel(emailAccount.user);
  const generateObject = createGenerateObject({
    emailAccount: {
      id: emailAccount.id,
      userId: emailAccount.userId,
      email: emailAccount.email,
    },
    label: "Compose subject",
    modelOptions,
  });

  try {
    const result = await generateObject({
      ...modelOptions,
      system,
      prompt: userPrompt,
      schema: subjectSchema,
    });

    return NextResponse.json(result.object);
  } catch (error) {
    logger.error("Failed to generate subject", {
      error,
      emailAccountId,
      content: content.slice(0, 100),
    });

    if (error instanceof SafeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to generate subject. Please try again." },
      { status: 500 },
    );
  }
});
