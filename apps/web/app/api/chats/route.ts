import { NextResponse } from "next/server";
import prisma from "@/utils/prisma";
import { withEmailAccount } from "@/utils/middleware";

export type GetChatsResponse = Awaited<ReturnType<typeof getChats>>;

export const GET = withEmailAccount("chats", async (request) => {
  const emailAccountId = request.auth.emailAccountId;
  const result = await getChats({ emailAccountId });
  return NextResponse.json(result);
});

async function getChats({ emailAccountId }: { emailAccountId: string }) {
  const chats = await prisma.chat.findMany({
    where: { emailAccountId },
    orderBy: { updatedAt: "desc" },
    take: 20, // Limit to recent chats
    include: {
      messages: {
        where: { role: "user" },
        orderBy: { createdAt: "asc" },
        take: 1, // Get first user message for preview
        select: {
          parts: true,
        },
      },
    },
  });

  // Extract preview text from first user message
  const chatsWithPreview = chats.map((chat) => {
    const firstMessage = chat.messages[0];
    let preview = "";

    if (firstMessage?.parts) {
      // parts is JSON array, extract text content
      const parts = firstMessage.parts as Array<{
        type: string;
        text?: string;
      }>;
      const textPart = parts.find((p) => p.type === "text" && p.text);
      preview = textPart?.text?.slice(0, 50) || "";
      if (textPart?.text && textPart.text.length > 50) {
        preview += "...";
      }
    }

    return {
      id: chat.id,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      preview: preview || "New conversation",
    };
  });

  return { chats: chatsWithPreview };
}
