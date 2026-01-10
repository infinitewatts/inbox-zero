import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/middleware";
import { composeSubjectBody } from "@/app/api/ai/compose-subject/validation";
import { getEmailAccountWithAi, getWritingStyle } from "@/utils/user/get";
import { getModel } from "@/utils/llms/model";
import { createGenerateObject } from "@/utils/llms";

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

  const writingStyle = await getWritingStyle({ emailAccountId });

  const json = await request.json();
  const { content, prompt, to } = composeSubjectBody.parse(json);

  const system = `You are an expert email assistant. Generate a concise subject line.
Return only the subject. Keep it short and specific.`;

  const userPrompt = [
    emailAccount.about
      ? `About the user:\n${emailAccount.about}`
      : null,
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

  const result = await generateObject({
    ...modelOptions,
    system,
    prompt: userPrompt,
    schema: subjectSchema,
  });

  return NextResponse.json(result.object);
});
