import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/middleware";
import { createGenerateObject } from "@/utils/llms";
import { getModel } from "@/utils/llms/model";
import { getEmailAccountWithAi } from "@/utils/user/get";

const smartRepliesBody = z.object({
  emailContent: z.string().min(1),
  subject: z.string().optional(),
  senderName: z.string().optional(),
});

const smartRepliesSchema = z.object({
  replies: z
    .array(
      z.object({
        text: z.string().describe("The reply text, 1-2 sentences max"),
        tone: z
          .enum(["positive", "neutral", "decline"])
          .describe("The tone of the reply"),
      }),
    )
    .max(3)
    .describe("Exactly 3 short reply options"),
});

export const POST = withEmailAccount(async (request) => {
  const emailAccountId = request.auth.emailAccountId;

  const emailAccount = await getEmailAccountWithAi({ emailAccountId });
  if (!emailAccount) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const json = await request.json();
  const parsed = smartRepliesBody.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { emailContent, subject, senderName } = parsed.data;

  const system = `You generate 3 short, contextual email reply options.

Rules:
- Each reply should be 1-2 sentences max (under 100 characters preferred)
- Provide variety: one positive/agreeing, one neutral/informational, one declining/delaying
- Match the formality of the original email
- Be natural and human-sounding
- Don't include greetings or sign-offs (those will be added separately)

Output exactly 3 replies with their tone.`;

  const userPrompt = [
    subject ? `Subject: ${subject}` : null,
    senderName ? `From: ${senderName}` : null,
    "",
    "Email to reply to:",
    emailContent.slice(0, 1500),
  ]
    .filter((line) => line !== null)
    .join("\n");

  const modelOptions = getModel(emailAccount.user);
  const generateObject = createGenerateObject({
    emailAccount: {
      id: emailAccount.id,
      userId: emailAccount.userId,
      email: emailAccount.email,
    },
    label: "Smart replies",
    modelOptions,
  });

  try {
    const result = await generateObject({
      ...modelOptions,
      system,
      prompt: userPrompt,
      schema: smartRepliesSchema,
    });

    return NextResponse.json(result.object);
  } catch (error) {
    console.error("Smart replies error:", error);
    return NextResponse.json(
      { error: "Failed to generate replies" },
      { status: 500 },
    );
  }
});
