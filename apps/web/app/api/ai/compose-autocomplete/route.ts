import { NextResponse } from "next/server";
import { withEmailAccount } from "@/utils/middleware";
import { composeAutocompleteBody } from "@/app/api/ai/compose-autocomplete/validation";
import { chatCompletionStream } from "@/utils/llms";
import { getEmailAccountWithAi, getWritingStyle } from "@/utils/user/get";
import { checkAiRateLimit, rateLimitResponse } from "@/utils/ratelimit";

export const POST = withEmailAccount(async (request) => {
  const emailAccountId = request.auth.emailAccountId;

  const user = await getEmailAccountWithAi({ emailAccountId });

  if (!user) return NextResponse.json({ error: "Not authenticated" });

  const rateLimit = await checkAiRateLimit(user.userId);
  if (!rateLimit.allowed) {
    return rateLimitResponse(rateLimit.resetIn);
  }

  const writingStyle = await getWritingStyle({ emailAccountId });

  const json = await request.json();
  const { prompt } = composeAutocompleteBody.parse(json);

  const styleGuidelines = [
    user.about ? `User context:\n${user.about}` : null,
    writingStyle ? `Writing style:\n${writingStyle}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const system = `You are an AI writing assistant that continues existing text based on context from prior text.
Give more weight/priority to the later characters than the beginning ones.
Limit your response to no more than 200 characters, but make sure to construct complete sentences.
${styleGuidelines ? `\n${styleGuidelines}` : ""}`;

  const response = await chatCompletionStream({
    userAi: user.user,
    messages: [
      {
        role: "system",
        content: system,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    userEmail: user.email,
    usageLabel: "Compose auto complete",
  });

  return response.toTextStreamResponse();
});
