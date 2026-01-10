"use client";

import { useHotkeys } from "react-hotkeys-hook";
import {
  Combobox,
  ComboboxInput,
  ComboboxOption,
  ComboboxOptions,
} from "@headlessui/react";
import { CheckCircleIcon, SparklesIcon, TrashIcon, XIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type SubmitHandler, useForm } from "react-hook-form";
import useSWR from "swr";
import { z } from "zod";
import { Input, Label } from "@/components/Input";
import { toastError, toastSuccess } from "@/components/Toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonLoader } from "@/components/Loading";
import { Input as UiInput } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { env } from "@/env";
import { extractNameFromEmail } from "@/utils/email";
import { Tiptap, type TiptapHandle } from "@/components/editor/Tiptap";
import { sendEmailAction } from "@/utils/actions/mail";
import type { ContactsResponse } from "@/app/api/google/contacts/route";
import type { SendEmailBody } from "@/utils/gmail/mail";
import { CommandShortcut } from "@/components/ui/command";
import { useModifierKey } from "@/hooks/useModifierKey";
import { useAccount } from "@/providers/EmailAccountProvider";
import { Textarea } from "@/components/ui/textarea";
import { EMAIL_ACCOUNT_HEADER } from "@/utils/config";
import { htmlToText } from "@/utils/parse/parseHtml.client";
import { SmartReplies } from "@/components/compose/SmartReplies";
import {
  ComposeToolbar,
  AutocompleteStatusBar,
} from "@/components/compose/ComposeToolbar";
import { useComposeTemplates } from "@/hooks/useComposeTemplates";
import {
  createTemplateAction,
  deleteTemplateAction,
  migrateLocalTemplatesAction,
} from "@/utils/actions/compose-template";
import { useAction } from "next-safe-action/hooks";

export type ReplyingToEmail = {
  threadId: string;
  headerMessageId: string;
  references?: string;
  subject: string;
  to: string;
  cc?: string;
  bcc?: string;
  draftHtml?: string | undefined; // The part being written/edited
  quotedContentHtml?: string | undefined; // The part being quoted/replied to
  date?: string; // The date of the original email
};

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const wrapTextInParagraphs = (value: string) => {
  const escaped = escapeHtml(value);
  const lines = escaped.split(/\n{2,}/g).map((line) => line.trim());
  return lines
    .filter(Boolean)
    .map((line) => `<p>${line.replace(/\n/g, "<br />")}</p>`)
    .join("");
};

const composeTemplateSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  subject: z.string().nullish(),
  to: z.string().nullish(),
  cc: z.string().nullish(),
  bcc: z.string().nullish(),
  bodyHtml: z.string().nullish(),
  updatedAt: z.union([z.string(), z.date()]).nullish(),
});

const composeTemplateListSchema = z.array(composeTemplateSchema);

type ComposeTemplate = z.infer<typeof composeTemplateSchema>;

export const ComposeEmailForm = ({
  replyingToEmail,
  refetch,
  onSuccess,
  onDiscard,
}: {
  replyingToEmail?: ReplyingToEmail;
  refetch?: () => void;
  onSuccess?: (messageId: string, threadId: string) => void;
  onDiscard?: () => void;
}) => {
  const { emailAccountId, userEmail } = useAccount();
  const [showFullContent, setShowFullContent] = useState(false);
  const { symbol } = useModifierKey();
  const formRef = useRef<HTMLFormElement>(null);
  const [showCc, setShowCc] = useState(!!replyingToEmail?.cc);
  const [showBcc, setShowBcc] = useState(!!replyingToEmail?.bcc);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [isAiContinuing, setIsAiContinuing] = useState(false);
  const [draftHtml, setDraftHtml] = useState(replyingToEmail?.draftHtml ?? "");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isAiSuggesting, setIsAiSuggesting] = useState(false);
  const aiSuggestionAbort = useRef<AbortController | null>(null);
  const aiSuggestionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aiDraftAbort = useRef<AbortController | null>(null);
  const recipientNameRef = useRef<string | undefined>(undefined);
  const senderNameRef = useRef<string | undefined>(undefined);
  const ghostHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showGhostHint, setShowGhostHint] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isSubjectGenerating, setIsSubjectGenerating] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);
  const [hasMigratedTemplates, setHasMigratedTemplates] = useState(false);

  const {
    templates: serverTemplates,
    defaultPersona,
    mutate: mutateTemplates,
  } = useComposeTemplates();

  const { execute: executeCreateTemplate } = useAction(
    createTemplateAction.bind(null, emailAccountId),
    { onSuccess: () => mutateTemplates() },
  );

  const { execute: executeDeleteTemplate } = useAction(
    deleteTemplateAction.bind(null, emailAccountId),
    { onSuccess: () => mutateTemplates() },
  );

  const { execute: executeMigrate } = useAction(
    migrateLocalTemplatesAction.bind(null, emailAccountId),
    { onSuccess: () => mutateTemplates() },
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setValue,
    getValues,
  } = useForm<SendEmailBody>({
    defaultValues: {
      replyToEmail: replyingToEmail,
      subject: replyingToEmail?.subject,
      to: replyingToEmail?.to,
      cc: replyingToEmail?.cc,
      messageHtml: replyingToEmail?.draftHtml,
    },
  });

  const subject = watch("subject");
  const toField = watch("to");
  const templatesStorageKey = useMemo(
    () =>
      emailAccountId
        ? `compose-templates:${emailAccountId}`
        : "compose-templates:default",
    [emailAccountId],
  );

  const recipientName = useMemo(() => {
    const firstRecipient = toField?.split(",")[0]?.trim();
    if (!firstRecipient) return undefined;
    const name = extractNameFromEmail(firstRecipient);
    if (!name) return undefined;
    if (name.includes("@")) {
      const local = name.split("@")[0]?.replace(/[._]/g, " ").trim();
      return local || undefined;
    }
    return name;
  }, [toField]);

  const senderName = useMemo(() => {
    if (!userEmail) return undefined;
    const name = extractNameFromEmail(userEmail);
    if (!name) return undefined;
    if (name.includes("@")) {
      const local = name.split("@")[0]?.replace(/[._]/g, " ").trim();
      return local || undefined;
    }
    return name;
  }, [userEmail]);

  const draftPreviewText = useMemo(() => {
    if (!aiDraft) return "";
    const parsed = htmlToText(aiDraft).trim();
    if (parsed) return parsed;
    return aiDraft.replace(/<[^>]+>/g, "").trim();
  }, [aiDraft]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (hasMigratedTemplates) return;

    const raw = window.localStorage.getItem(templatesStorageKey);
    if (!raw) {
      setHasMigratedTemplates(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      const result = composeTemplateListSchema.safeParse(parsed);
      if (result.success && result.data.length > 0) {
        executeMigrate({
          templates: result.data.map((t) => ({
            name: t.name,
            subject: t.subject ?? undefined,
            bodyHtml: t.bodyHtml ?? undefined,
            to: t.to ?? undefined,
            cc: t.cc ?? undefined,
            bcc: t.bcc ?? undefined,
          })),
        });
        window.localStorage.removeItem(templatesStorageKey);
      }
      setHasMigratedTemplates(true);
    } catch (error) {
      console.error("Failed to migrate templates", error);
      setHasMigratedTemplates(true);
    }
  }, [templatesStorageKey, hasMigratedTemplates, executeMigrate]);

  useEffect(() => {
    if (defaultPersona && !selectedPersona) {
      setSelectedPersona(defaultPersona);
    }
  }, [defaultPersona, selectedPersona]);

  const templates = serverTemplates;

  useEffect(() => {
    recipientNameRef.current = recipientName;
  }, [recipientName]);

  useEffect(() => {
    senderNameRef.current = senderName;
  }, [senderName]);

  const openSaveTemplateDialog = useCallback(() => {
    setTemplateName(subject?.trim() || "");
    setIsTemplateDialogOpen(true);
  }, [subject]);

  const onSubmit: SubmitHandler<SendEmailBody> = useCallback(
    async (data) => {
      const enrichedData = {
        ...data,
        messageHtml: showFullContent
          ? data.messageHtml || ""
          : `${data.messageHtml || ""}<br>${replyingToEmail?.quotedContentHtml || ""}`,
      };

      try {
        const res = await sendEmailAction(emailAccountId, enrichedData);
        if (res?.serverError) {
          toastError({
            description: "There was an error sending the email :(",
          });
        } else if (res?.data) {
          toastSuccess({ description: "Email sent!" });
          onSuccess?.(res.data.messageId ?? "", res.data.threadId ?? "");
        }
      } catch (error) {
        console.error(error);
        toastError({ description: "There was an error sending the email :(" });
      }

      refetch?.();
    },
    [refetch, onSuccess, showFullContent, replyingToEmail, emailAccountId],
  );

  useHotkeys(
    "mod+enter",
    (e) => {
      e.preventDefault();
      if (!isSubmitting) {
        formRef.current?.requestSubmit();
      }
    },
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: true,
    },
  );

  const [searchQuery, setSearchQuery] = useState("");
  const { data } = useSWR<ContactsResponse, { error: string }>(
    env.NEXT_PUBLIC_CONTACTS_ENABLED
      ? `/api/google/contacts?query=${searchQuery}`
      : null,
    {
      keepPreviousData: true,
    },
  );

  // TODO not in love with how this was implemented
  const selectedEmailAddressses = watch("to", "").split(",").filter(Boolean);

  const onRemoveSelectedEmail = (emailAddress: string) => {
    const filteredEmailAddresses = selectedEmailAddressses.filter(
      (email) => email !== emailAddress,
    );
    setValue("to", filteredEmailAddresses.join(","));
  };

  const handleComboboxOnChange = (values: string[]) => {
    // this assumes last value given by combobox is user typed value
    const lastValue = values[values.length - 1];

    const { success } = z.string().email().safeParse(lastValue);
    if (success) {
      setValue("to", values.join(","));
      setSearchQuery("");
    }
  };

  const [editReply, setEditReply] = useState(false);

  const handleEditorChange = useCallback(
    (html: string) => {
      setValue("messageHtml", html);
      setDraftHtml(html);
      if (aiSuggestion) setAiSuggestion(null);
    },
    [aiSuggestion, setValue],
  );

  const editorRef = useRef<TiptapHandle>(null);

  const showExpandedContent = useCallback(() => {
    if (!showFullContent) {
      try {
        editorRef.current?.appendContent(
          replyingToEmail?.quotedContentHtml ?? "",
        );
      } catch (error) {
        console.error("Failed to append content:", error);
        toastError({ description: "Failed to show full content" });
        return; // Don't set showFullContent to true if append failed
      }
    }
    setShowFullContent(true);
  }, [showFullContent, replyingToEmail?.quotedContentHtml]);

  const handleAiDraft = useCallback(async () => {
    if (!aiPrompt.trim()) {
      toastError({ description: "Add a prompt to generate a draft." });
      return;
    }

    aiDraftAbort.current?.abort();
    const controller = new AbortController();
    aiDraftAbort.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    setAiSuggestion(null);
    setIsAiDrafting(true);
    try {
      const replyContext = replyingToEmail?.quotedContentHtml
        ? {
            from: replyingToEmail.to,
            content: htmlToText(replyingToEmail.quotedContentHtml),
            date: replyingToEmail.date,
          }
        : undefined;

      const res = await fetch("/api/ai/compose-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [EMAIL_ACCOUNT_HEADER]: emailAccountId,
        },
        body: JSON.stringify({
          prompt: aiPrompt.trim(),
          subject: subject?.trim() || undefined,
          existingContent: editorRef.current?.getMarkdown() || undefined,
          replyContext,
          persona: selectedPersona || undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("Too many requests. Please wait a moment.");
        }
        throw new Error(data?.error || "Failed to generate draft");
      }

      if (!data?.bodyHtml) {
        throw new Error("Draft response was empty");
      }

      setAiDraft(data.bodyHtml);
    } catch (error) {
      if (controller.signal.aborted) {
        toastError({ description: "Request timed out. Please try again." });
        return;
      }
      console.error(error);
      const message =
        error instanceof Error ? error.message : "AI draft failed";
      toastError({ description: message });
    } finally {
      clearTimeout(timeoutId);
      setIsAiDrafting(false);
    }
  }, [aiPrompt, subject, emailAccountId, replyingToEmail, selectedPersona]);

  const handleAiContinue = useCallback(async () => {
    const existing = editorRef.current?.getMarkdown() || "";
    if (!existing.trim()) {
      toastError({ description: "Start writing before continuing." });
      return;
    }

    setAiSuggestion(null);
    setIsAiContinuing(true);
    try {
      const prompt = [subject?.trim() ? `Subject: ${subject}` : "", existing]
        .filter(Boolean)
        .join("\n\n");

      const res = await fetch("/api/ai/compose-autocomplete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [EMAIL_ACCOUNT_HEADER]: emailAccountId,
        },
        body: JSON.stringify({ prompt }),
      });

      if (!res.ok) {
        throw new Error("Failed to continue draft");
      }

      const continuation = await res.text();
      if (!continuation.trim()) return;

      editorRef.current?.appendContent(wrapTextInParagraphs(continuation));
    } catch (error) {
      console.error(error);
      toastError({ description: "AI continue failed. Try again." });
    } finally {
      setIsAiContinuing(false);
    }
  }, [subject, emailAccountId]);

  const applyAiDraft = useCallback(
    (mode: "replace" | "append") => {
      if (!aiDraft) return;
      if (mode === "replace") {
        editorRef.current?.setContent(aiDraft);
      } else {
        editorRef.current?.appendContent(aiDraft);
      }
      setAiDraft(null);
      setAiSuggestion(null);
      toastSuccess({ description: "AI draft inserted." });
    },
    [aiDraft],
  );

  const applyAiSuggestion = useCallback(() => {
    if (!aiSuggestion) return;
    editorRef.current?.appendContent(wrapTextInParagraphs(aiSuggestion));
    setAiSuggestion(null);
  }, [aiSuggestion]);

  const handleSubjectGenerate = useCallback(async () => {
    const content = (editorRef.current?.getMarkdown() ?? "").trim();
    const prompt = aiPrompt.trim();
    const fallbackContent = content || prompt;
    if (!fallbackContent) {
      toastError({
        description: "Add content or a prompt before generating a subject.",
      });
      return;
    }

    setIsSubjectGenerating(true);
    try {
      const res = await fetch("/api/ai/compose-subject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: fallbackContent,
          prompt: prompt || undefined,
          to: toField?.trim() || undefined,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate subject");
      }

      const data = await res.json();
      if (!data?.subject) {
        throw new Error("No subject returned");
      }

      setValue("subject", data.subject);
      toastSuccess({ description: "Subject generated." });
    } catch (error) {
      console.error(error);
      toastError({ description: "Subject generation failed. Try again." });
    } finally {
      setIsSubjectGenerating(false);
    }
  }, [aiPrompt, setValue, toField]);

  const applyTemplate = useCallback(
    (template: ComposeTemplate) => {
      setValue("subject", template.subject || "");
      setValue("to", template.to || "");
      setValue("cc", template.cc || "");
      setValue("bcc", template.bcc || "");
      setShowCc(Boolean(template.cc));
      setShowBcc(Boolean(template.bcc));
      setSearchQuery("");

      const bodyHtml = template.bodyHtml || "";
      editorRef.current?.setContent(bodyHtml);
      setDraftHtml(bodyHtml);
      setAiDraft(null);
      setAiSuggestion(null);
      toastSuccess({ description: `Template "${template.name}" applied.` });
    },
    [setValue],
  );

  const handleSaveTemplate = useCallback(() => {
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      toastError({ description: "Add a template name first." });
      return;
    }

    const values = getValues();
    const bodyHtml = editorRef.current?.getHtml() ?? "";

    executeCreateTemplate({
      name: trimmedName,
      subject: values.subject?.trim() || undefined,
      to: values.to?.trim() || undefined,
      cc: values.cc?.trim() || undefined,
      bcc: values.bcc?.trim() || undefined,
      bodyHtml: bodyHtml || undefined,
      persona: selectedPersona || undefined,
    });

    setIsTemplateDialogOpen(false);
    setTemplateName("");
    toastSuccess({ description: "Template saved." });
  }, [getValues, templateName, executeCreateTemplate, selectedPersona]);

  const handleDeleteTemplate = useCallback(
    (templateId: string) => {
      executeDeleteTemplate({ id: templateId });
      toastSuccess({ description: "Template deleted." });
    },
    [executeDeleteTemplate],
  );

  useHotkeys(
    "tab",
    (e) => {
      if (!aiSuggestion) return;
      e.preventDefault();
      applyAiSuggestion();
    },
    {
      enableOnFormTags: true,
      enableOnContentEditable: true,
      preventDefault: false,
    },
  );

  const fetchAiSuggestion = useCallback(async () => {
    const markdown = editorRef.current?.getMarkdown() ?? "";
    const content = markdown.trim() || htmlToText(draftHtml || "").trim();
    if (!content || content.length < 40) return;

    aiSuggestionAbort.current?.abort();
    const controller = new AbortController();
    aiSuggestionAbort.current = controller;
    setIsAiSuggesting(true);
    setAiSuggestion(null);

    try {
      const prompt = [subject?.trim() ? `Subject: ${subject}` : "", content]
        .filter(Boolean)
        .join("\n\n");

      const res = await fetch("/api/ai/compose-autocomplete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
        signal: controller.signal,
      });

      if (!res.ok) return;
      const suggestion = (await res.text()).trim();
      if (!controller.signal.aborted) {
        setAiSuggestion(suggestion || null);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error(error);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsAiSuggesting(false);
      }
    }
  }, [draftHtml, subject]);

  useEffect(() => {
    const markdown = editorRef.current?.getMarkdown() ?? "";
    const content = markdown.trim() || htmlToText(draftHtml || "").trim();
    if (!content || content.length < 40) {
      setAiSuggestion(null);
      return;
    }
    if (isAiDrafting || isAiContinuing || aiDraft) return;

    if (aiSuggestionTimer.current) {
      clearTimeout(aiSuggestionTimer.current);
    }

    aiSuggestionTimer.current = setTimeout(fetchAiSuggestion, 800);

    return () => {
      if (aiSuggestionTimer.current) {
        clearTimeout(aiSuggestionTimer.current);
      }
    };
  }, [aiDraft, draftHtml, isAiContinuing, isAiDrafting, fetchAiSuggestion]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const storageKey = "compose-ghost-hint-count";
    const raw = window.localStorage.getItem(storageKey);
    const parsed = Number(raw ?? "0");
    const count = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;

    if (count < 3) {
      window.localStorage.setItem(storageKey, String(count + 1));
      setShowGhostHint(true);
      ghostHintTimer.current = setTimeout(() => {
        setShowGhostHint(false);
      }, 6000);
    }

    return () => {
      if (ghostHintTimer.current) {
        clearTimeout(ghostHintTimer.current);
      }
    };
  }, []);

  return (
    <form ref={formRef} onSubmit={handleSubmit(onSubmit)} className="space-y-2">
      {replyingToEmail?.to && !editReply ? (
        <button
          type="button"
          className="flex gap-1 text-left"
          onClick={() => setEditReply(true)}
        >
          <span className="text-green-500">Draft</span>{" "}
          <span className="max-w-md break-words text-foreground">
            to {extractNameFromEmail(replyingToEmail.to)}
          </span>
        </button>
      ) : (
        <>
          {env.NEXT_PUBLIC_CONTACTS_ENABLED ? (
            <div className="flex space-x-2">
              <div className="mt-2">
                <Label name="to" label="To" />
              </div>
              <Combobox
                value={selectedEmailAddressses}
                onChange={handleComboboxOnChange}
                multiple
              >
                <div className="flex min-h-10 w-full flex-1 flex-wrap items-center gap-1.5 rounded-md text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted-foreground">
                  {selectedEmailAddressses.map((emailAddress) => (
                    <Badge
                      key={emailAddress}
                      variant="secondary"
                      className="cursor-pointer rounded-md"
                      onClick={() => {
                        onRemoveSelectedEmail(emailAddress);
                        setSearchQuery(emailAddress);
                      }}
                    >
                      {extractNameFromEmail(emailAddress)}

                      <button
                        type="button"
                        onClick={() => onRemoveSelectedEmail(emailAddress)}
                      >
                        <XIcon className="ml-1.5 size-3" />
                      </button>
                    </Badge>
                  ))}

                  <div className="relative flex-1">
                    <ComboboxInput
                      value={searchQuery}
                      className="w-full border-none bg-background p-0 text-sm focus:border-none focus:ring-0"
                      onChange={(event) => setSearchQuery(event.target.value)}
                      onKeyUp={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          setValue(
                            "to",
                            [...selectedEmailAddressses, searchQuery].join(","),
                          );
                          setSearchQuery("");
                        }
                      }}
                    />

                    {!!data?.result?.length && (
                      <ComboboxOptions
                        className={
                          "absolute z-10 mt-1 max-h-60 overflow-auto rounded-md bg-popover py-1 text-base shadow-lg ring-1 ring-border focus:outline-none sm:text-sm"
                        }
                      >
                        <ComboboxOption
                          className="h-0 w-0 overflow-hidden"
                          value={searchQuery}
                        />
                        {data?.result.map((contact) => {
                          const person = {
                            emailAddress:
                              contact.person?.emailAddresses?.[0].value,
                            name: contact.person?.names?.[0].displayName,
                            profilePictureUrl: contact.person?.photos?.[0].url,
                          };

                          return (
                            <ComboboxOption
                              className={({ focus }) =>
                                `cursor-default select-none px-4 py-1 text-foreground ${
                                  focus && "bg-accent"
                                }`
                              }
                              key={person.emailAddress}
                              value={person.emailAddress}
                            >
                              {({ selected }) => (
                                <div className="my-2 flex items-center">
                                  {selected ? (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-full">
                                      <CheckCircleIcon className="h-6 w-6" />
                                    </div>
                                  ) : (
                                    <Avatar>
                                      <AvatarImage
                                        src={person.profilePictureUrl!}
                                        alt={
                                          person.emailAddress ||
                                          "Profile picture"
                                        }
                                      />
                                      <AvatarFallback>
                                        {person.emailAddress?.[0] || "A"}
                                      </AvatarFallback>
                                    </Avatar>
                                  )}
                                  <div className="ml-4 flex flex-col justify-center">
                                    <div className="text-foreground">
                                      {person.name}
                                    </div>
                                    <div className="text-sm font-semibold text-muted-foreground">
                                      {person.emailAddress}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </ComboboxOption>
                          );
                        })}
                      </ComboboxOptions>
                    )}
                  </div>
                </div>
              </Combobox>
            </div>
          ) : (
            <Input
              type="text"
              name="to"
              label="To"
              registerProps={register("to", { required: true })}
              error={errors.to}
            />
          )}

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {!showCc && (
              <button
                type="button"
                onClick={() => setShowCc(true)}
                className="hover:text-foreground"
              >
                Add Cc
              </button>
            )}
            {!showBcc && (
              <button
                type="button"
                onClick={() => setShowBcc(true)}
                className="hover:text-foreground"
              >
                Add Bcc
              </button>
            )}
          </div>

          {showCc && (
            <Input
              type="text"
              name="cc"
              label="Cc"
              registerProps={register("cc")}
              error={errors.cc}
            />
          )}

          {showBcc && (
            <Input
              type="text"
              name="bcc"
              label="Bcc"
              registerProps={register("bcc")}
              error={errors.bcc}
            />
          )}

          <Input
            type="text"
            name="subject"
            registerProps={register("subject", { required: true })}
            error={errors.subject}
            placeholder="Subject"
            labelComponent={
              <div className="flex items-center justify-between gap-2">
                <Label name="subject" label="Subject" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSubjectGenerate}
                  disabled={isSubjectGenerating}
                >
                  {isSubjectGenerating ? (
                    <ButtonLoader />
                  ) : (
                    <SparklesIcon className="mr-2 h-4 w-4" />
                  )}
                  Generate
                </Button>
              </div>
            }
            className="border border-input bg-background focus:border-slate-200 focus:ring-0 focus:ring-slate-200"
          />
        </>
      )}

      {replyingToEmail?.quotedContentHtml && (
        <SmartReplies
          emailAccountId={emailAccountId}
          emailContent={htmlToText(replyingToEmail.quotedContentHtml)}
          subject={replyingToEmail.subject}
          senderName={extractNameFromEmail(replyingToEmail.to)}
          onSelect={(text) => {
            editorRef.current?.setContent(`<p>${text}</p>`);
            setAiDraft(null);
            setAiSuggestion(null);
          }}
          disabled={isAiDrafting || isAiContinuing}
        />
      )}

      <div className="rounded-md border border-border bg-muted/30 p-3">
        <div className="flex items-center gap-3">
          <ComposeToolbar
            onGenerateDraft={handleAiDraft}
            onContinue={handleAiContinue}
            onSaveTemplate={openSaveTemplateDialog}
            onApplyTemplate={applyTemplate}
            onDeleteTemplate={handleDeleteTemplate}
            templates={templates}
            isGenerating={isAiDrafting}
            isContinuing={isAiContinuing}
            selectedPersona={selectedPersona}
            onPersonaChange={setSelectedPersona}
          />
          <div className="h-5 w-px bg-border" />
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SparklesIcon className="h-3.5 w-3.5 text-amber-500" />
            <span>AI</span>
          </div>
        </div>
        <Textarea
          value={aiPrompt}
          onChange={(event) => setAiPrompt(event.target.value)}
          placeholder="What do you want to say? (goal, tone, key points)"
          className="mt-2 min-h-[60px] resize-none border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground/60 focus-visible:ring-0"
        />
        {aiDraft && (
          <div className="mt-2 rounded-md border border-border bg-background p-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Preview
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => applyAiDraft("replace")}
                >
                  Replace
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={() => applyAiDraft("append")}
                >
                  Append
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => setAiDraft(null)}
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="mt-1.5 max-h-32 overflow-auto text-sm text-foreground">
              {draftPreviewText || "Draft ready."}
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={isTemplateDialogOpen}
        onOpenChange={(open) => {
          setIsTemplateDialogOpen(open);
          if (!open) setTemplateName("");
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save template</DialogTitle>
            <DialogDescription>
              Save the current recipients, subject, and draft body for reuse in
              this inbox.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label name="template-name" label="Template name" />
            <UiInput
              id="template-name"
              value={templateName}
              onChange={(event) => setTemplateName(event.target.value)}
              placeholder="Quarterly update"
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsTemplateDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveTemplate}
              disabled={!templateName.trim()}
            >
              Save template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Tiptap
        ref={editorRef}
        initialContent={replyingToEmail?.draftHtml}
        onChange={handleEditorChange}
        className="min-h-[200px]"
        ghostTextOptions={{
          senderName: () => senderNameRef.current,
          recipientName: () => recipientNameRef.current,
          disabled: () => isAiDrafting || isAiContinuing || !!aiDraft,
          aiSuggestion: () => aiSuggestion,
          onAiSuggestionAccepted: () => setAiSuggestion(null),
        }}
        onMoreClick={
          !replyingToEmail?.quotedContentHtml || showFullContent
            ? undefined
            : showExpandedContent
        }
      />
      {showGhostHint && (
        <div className="mt-2 text-xs text-muted-foreground">
          Tip: press{" "}
          <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
            Tab
          </kbd>{" "}
          to accept inline suggestions
        </div>
      )}

      {(aiSuggestion || isAiSuggesting) && (
        <AutocompleteStatusBar
          isGenerating={isAiSuggesting}
          onRegenerate={fetchAiSuggestion}
          onDismiss={() => setAiSuggestion(null)}
        />
      )}

      <div className="flex items-center justify-between">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <ButtonLoader />}
          Send
          <CommandShortcut className="ml-2">{symbol}+Enter</CommandShortcut>
        </Button>

        {onDiscard && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            disabled={isSubmitting}
            onClick={onDiscard}
          >
            <TrashIcon className="h-4 w-4" />
            <span className="sr-only">Discard</span>
          </Button>
        )}
      </div>
    </form>
  );
};
