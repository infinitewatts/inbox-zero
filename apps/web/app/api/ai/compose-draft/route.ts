import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/middleware";
import { composeDraftBody } from "@/app/api/ai/compose-draft/validation";
import { getEmailAccountWithAi, getWritingStyle } from "@/utils/user/get";
import { getModel } from "@/utils/llms/model";
import { createGenerateObject } from "@/utils/llms";

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

  const writingStyle = await getWritingStyle({ emailAccountId });

  const json = await request.json();
  const { prompt, subject, existingContent, replyContext } =
    composeDraftBody.parse(json);

  const isReply = Boolean(replyContext);
  const system = isReply
    ? `You are an expert email assistant drafting reply emails.
Write a concise, professional reply in the user's voice.
Return the email body as HTML in JSON format (no subject line, no signature unless explicitly asked).
Reference relevant details from the original email when appropriate.
Avoid placeholders unless required. Do not mention being an AI.`
    : `You are an expert email assistant drafting new outbound emails.
Write a concise, professional message in the user's voice.
Return the email body as HTML in JSON format (no subject line, no signature unless explicitly asked).
Avoid placeholders unless required. Do not mention being an AI.`;

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

  const result = await generateObject({
    ...modelOptions,
    system,
    prompt: userPrompt,
    schema: draftSchema,
  });

  return NextResponse.json(result.object);
});
