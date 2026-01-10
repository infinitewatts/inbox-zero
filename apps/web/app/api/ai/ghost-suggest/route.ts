import { NextResponse } from "next/server";
import { z } from "zod";
import { withEmailAccount } from "@/utils/middleware";
import { chatCompletionStream } from "@/utils/llms";
import { getEmailAccountWithAi } from "@/utils/user/get";

const ghostSuggestBody = z.object({
  prefix: z.string().min(2).max(200),
  context: z.string().max(500).optional(),
});

export const POST = withEmailAccount(async (request) => {
  const emailAccountId = request.auth.emailAccountId;

  const user = await getEmailAccountWithAi({ emailAccountId });
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const json = await request.json();
  const parsed = ghostSuggestBody.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const { prefix, context } = parsed.data;

  const system = `Complete the text naturally. Output ONLY the completion (what comes after the prefix), no quotes or explanation.
Keep it short (under 50 characters) and natural.
Match the user's writing style and tone.`;

  const userPrompt = context
    ? `Context: ${context}\n\nComplete this: "${prefix}"`
    : `Complete this: "${prefix}"`;

  const response = await chatCompletionStream({
    userAi: user.user,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userPrompt },
    ],
    userEmail: user.email,
    usageLabel: "Ghost suggest",
  });

  return response.toTextStreamResponse();
});
