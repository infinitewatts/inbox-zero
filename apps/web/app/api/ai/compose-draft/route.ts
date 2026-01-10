import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/middleware";
import { composeDraftBody } from "@/app/api/ai/compose-draft/validation";
import { getEmailAccountWithAi, getWritingStyle } from "@/utils/user/get";
import { getModel } from "@/utils/llms/model";
import { createGenerateObject } from "@/utils/llms";
import { SafeError } from "@/utils/error";
import { createScopedLogger } from "@/utils/logger";
import { checkAiRateLimit, rateLimitResponse } from "@/utils/ratelimit";
import { getPersonaPromptInstruction } from "@/utils/compose/personas";

const logger = createScopedLogger("compose-draft");

const draftSchema = z.object({
  bodyHtml: z
    .string()
    .describe("HTML body of the email without subject or signature"),
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
  const { prompt, subject, existingContent, replyContext, persona } =
    composeDraftBody.parse(json);

  const personaInstruction = getPersonaPromptInstruction(persona);

  const isReply = Boolean(replyContext);
  const baseSystem = isReply
    ? `You are an expert email assistant drafting reply emails.
Write a concise, professional reply in the user's voice.
Return the email body as HTML in JSON format (no subject line, no signature unless explicitly asked).
Reference relevant details from the original email when appropriate.
Avoid placeholders unless required. Do not mention being an AI.`
    : `You are an expert email assistant drafting new outbound emails.
Write a concise, professional message in the user's voice.
Return the email body as HTML in JSON format (no subject line, no signature unless explicitly asked).
Avoid placeholders unless required. Do not mention being an AI.`;

  const system = personaInstruction
    ? `${baseSystem}\n\nWriting tone: ${personaInstruction}`
    : baseSystem;

  const replyContextPrompt = replyContext
    ? `Original email${replyContext.from ? ` from ${replyContext.from}` : ""}${replyContext.date ? ` (${replyContext.date})` : ""}:\n${replyContext.content}`
    : null;

  const userPrompt = [
    emailAccount.about ? `About the user:\n${emailAccount.about}` : null,
    writingStyle ? `Writing style:\n${writingStyle}` : null,
    subject ? `Subject:\n${subject}` : null,
    replyContextPrompt,
    existingContent ? `Existing draft:\n${existingContent}` : null,
    `Instructions:\n${prompt}`,
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
    label: "Compose draft",
    modelOptions,
  });

  try {
    const result = await generateObject({
      ...modelOptions,
      system,
      prompt: userPrompt,
      schema: draftSchema,
    });

    return NextResponse.json(result.object);
  } catch (error) {
    logger.error("Failed to generate draft", {
      error,
      emailAccountId,
      prompt: prompt.slice(0, 100),
    });

    if (error instanceof SafeError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const message =
      error instanceof Error ? error.message : "Failed to generate draft";

    return NextResponse.json(
      {
        error: "Failed to generate draft. Please try again.",
        details: message,
      },
      { status: 500 },
    );
  }
});
