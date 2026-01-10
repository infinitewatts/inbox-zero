import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/middleware";
import { createGenerateObject } from "@/utils/llms";
import { getModel } from "@/utils/llms/model";
import { getEmailAccountWithAi } from "@/utils/user/get";
import { checkAiRateLimit, rateLimitResponse } from "@/utils/ratelimit";

const smartRepliesBody = z.object({
  emailContent: z.string().min(1),
  subject: z.string().optional(),
  senderName: z.string().optional(),
});

const smartRepliesResponse = z.object({
  replies: z
    .array(
      z.object({
        text: z.string(),
        tone: z.enum(["positive", "neutral", "decline"]),
      }),
    )
    .max(3),
});

export const POST = withEmailAccount(async (request) => {
  const emailAccountId = request.auth.emailAccountId;

  const user = await getEmailAccountWithAi({ emailAccountId });
  if (!user)
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const rateLimit = await checkAiRateLimit(user.userId);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetIn);
  }

  const json = await request.json();
  const parsed = smartRepliesBody.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
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

  const modelOptions = getModel(user.user, "economy");
  const generateObject = createGenerateObject({
    emailAccount: {
      id: user.id,
      userId: user.userId,
      email: user.email,
    },
    label: "Smart replies",
    modelOptions,
  });

  try {
    const result = await generateObject({
      ...modelOptions,
      system,
      prompt: userPrompt,
      schema: smartRepliesResponse,
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
