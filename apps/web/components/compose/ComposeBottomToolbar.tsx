"use client";

import { useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  FileTextIcon,
  PaperclipIcon,
  PlayIcon,
  SaveIcon,
  SparklesIcon,
  TrashIcon,
  TypeIcon,
  UserIcon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonLoader } from "@/components/Loading";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { COMPOSE_PERSONAS } from "@/utils/compose/personas";
import { useModifierKey } from "@/hooks/useModifierKey";

type ComposeTemplate = {
  id: string;
  name: string;
  subject?: string | null;
  to?: string | null;
  cc?: string | null;
  bcc?: string | null;
  bodyHtml?: string | null;
  updatedAt?: string | Date | null;
};

export type ComposeAttachment = {
  id: string;
  filename: string;
  content: string;
  contentType: string;
  size: number;
};

type ComposeBottomToolbarProps = {
  aiPrompt: string;
  onAiPromptChange: (prompt: string) => void;
  onGenerateDraft: () => void;
  onContinue: () => void;
  onGenerateSubject: () => void;
  onSaveTemplate: () => void;
  onApplyTemplate: (template: ComposeTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  templates: ComposeTemplate[];
  isGenerating: boolean;
  isContinuing: boolean;
  isSubjectGenerating: boolean;
  isSubmitting: boolean;
  selectedPersona: string | null;
  onPersonaChange: (personaId: string | null) => void;
  aiDraft: string | null;
  aiDraftPreview: string;
  onApplyDraft: (mode: "replace" | "append") => void;
  onDiscardDraft: () => void;
  onDiscard?: () => void;
  isReplyMode?: boolean;
  attachments: ComposeAttachment[];
  onAttachFiles: (files: FileList) => void;
  onRemoveAttachment: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
};

function ToolbarButton({
  onClick,
  disabled,
  loading,
  tooltip,
  children,
  className = "",
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tooltip: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={`h-8 w-8 ${className}`}
          onClick={onClick}
          disabled={disabled || loading}
        >
          {loading ? <ButtonLoader /> : children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ComposeBottomToolbar({
  aiPrompt,
  onAiPromptChange,
  onGenerateDraft,
  onContinue,
  onGenerateSubject,
  onSaveTemplate,
  onApplyTemplate,
  onDeleteTemplate,
  templates,
  isGenerating,
  isContinuing,
  isSubjectGenerating,
  isSubmitting,
  selectedPersona,
  onPersonaChange,
  aiDraft,
  aiDraftPreview,
  onApplyDraft,
  onDiscardDraft,
  onDiscard,
  isReplyMode,
  attachments,
  onAttachFiles,
  onRemoveAttachment,
  fileInputRef,
}: ComposeBottomToolbarProps) {
  const [isAiMode, setIsAiMode] = useState(false);
  const { symbol } = useModifierKey();
  const isDisabled = isGenerating || isContinuing || isSubmitting;
  const currentPersona = COMPOSE_PERSONAS.find((p) => p.id === selectedPersona);

  const handleGenerate = () => {
    if (aiPrompt.trim()) {
      onGenerateDraft();
      setIsAiMode(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey && aiPrompt.trim()) {
      e.preventDefault();
      handleGenerate();
    }
    if (e.key === "Escape") {
      setIsAiMode(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAttachFiles(e.target.files);
      e.target.value = "";
    }
  };

  return (
    <div className="border-t border-border bg-muted/30">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Attachments Preview */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-border px-3 py-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-1.5 rounded-md bg-muted px-2 py-1"
            >
              <PaperclipIcon className="h-3 w-3 text-muted-foreground" />
              <span className="max-w-[150px] truncate text-xs">
                {attachment.filename}
              </span>
              <span className="text-[10px] text-muted-foreground">
                ({formatFileSize(attachment.size)})
              </span>
              <button
                type="button"
                className="ml-0.5 rounded p-0.5 text-muted-foreground hover:bg-background hover:text-destructive"
                onClick={() => onRemoveAttachment(attachment.id)}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* AI Draft Preview */}
      {aiDraft && (
        <div className="border-b border-border bg-blue-50/50 px-3 py-2 dark:bg-blue-950/20">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
                AI Draft Ready
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => onApplyDraft("replace")}
              >
                Replace
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() => onApplyDraft("append")}
              >
                Append
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                onClick={onDiscardDraft}
              >
                <XIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {aiDraftPreview || "Draft ready to insert."}
          </p>
        </div>
      )}

      {/* AI Input Mode - Inline in toolbar area */}
      {isAiMode && (
        <div className="flex items-center gap-2 border-b border-border bg-background px-3 py-2">
          <SparklesIcon className="h-4 w-4 shrink-0 text-amber-500" />
          <input
            type="text"
            value={aiPrompt}
            onChange={(e) => onAiPromptChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="What should I write?"
            className="h-7 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
              >
                <UserIcon className="h-3 w-3" />
                {currentPersona?.name ?? "Tone"}
                <ChevronDownIcon className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onSelect={() => onPersonaChange(null)}
                className="flex items-center justify-between text-xs"
              >
                <span>Default</span>
                {!selectedPersona && <CheckIcon className="h-3 w-3" />}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {COMPOSE_PERSONAS.map((persona) => (
                <DropdownMenuItem
                  key={persona.id}
                  onSelect={() => onPersonaChange(persona.id)}
                  className="flex items-center justify-between text-xs"
                >
                  <span>{persona.name}</span>
                  {selectedPersona === persona.id && (
                    <CheckIcon className="h-3 w-3" />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            type="button"
            size="sm"
            className="h-7"
            onClick={handleGenerate}
            disabled={!aiPrompt.trim() || isGenerating}
          >
            {isGenerating ? <ButtonLoader /> : "Generate"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => setIsAiMode(false)}
          >
            <XIcon className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Main Toolbar */}
      <div className="flex items-center justify-between px-2 py-1.5">
        {/* Left side - Tools */}
        <div className="flex items-center gap-0.5">
          {/* AI Write Button */}
          <ToolbarButton
            onClick={() => setIsAiMode(true)}
            disabled={isDisabled || isAiMode}
            tooltip="AI Write"
            className={isAiMode ? "bg-accent" : ""}
          >
            <WandSparklesIcon className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={onContinue}
            disabled={isDisabled}
            loading={isContinuing}
            tooltip="Continue writing"
          >
            <PlayIcon className="h-4 w-4" />
          </ToolbarButton>

          <ToolbarButton
            onClick={onGenerateSubject}
            disabled={isDisabled}
            loading={isSubjectGenerating}
            tooltip="Generate subject"
          >
            <TypeIcon className="h-4 w-4" />
          </ToolbarButton>

          <div className="mx-1 h-5 w-px bg-border" />

          {/* Templates */}
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <FileTextIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Templates
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuItem
                onSelect={(e) => {
                  e.preventDefault();
                  onSaveTemplate();
                }}
              >
                <SaveIcon className="mr-2 h-3.5 w-3.5" />
                Save as template
              </DropdownMenuItem>
              {templates.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {templates.map((template) => (
                    <DropdownMenuItem
                      key={template.id}
                      className="flex items-center justify-between"
                      onSelect={() => onApplyTemplate(template)}
                    >
                      <span className="truncate text-sm">{template.name}</span>
                      <button
                        type="button"
                        className="ml-2 rounded p-0.5 text-muted-foreground hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          onDeleteTemplate(template.id);
                        }}
                      >
                        <TrashIcon className="h-3 w-3" />
                      </button>
                    </DropdownMenuItem>
                  ))}
                </>
              )}
              {templates.length === 0 && (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  No templates yet
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <ToolbarButton
            onClick={() => fileInputRef.current?.click()}
            disabled={isDisabled}
            tooltip="Attach file"
          >
            <PaperclipIcon className="h-4 w-4" />
          </ToolbarButton>
        </div>

        {/* Right side - Discard & Send */}
        <div className="flex items-center gap-2">
          {isReplyMode && onDiscard && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-muted-foreground hover:text-destructive"
              onClick={onDiscard}
            >
              Discard
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            className="h-8 gap-2 pl-3 pr-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ButtonLoader />
            ) : (
              <>
                <span>Send</span>
                <span className="flex items-center gap-0.5 rounded bg-primary-foreground/20 px-1.5 py-0.5 text-[10px] font-normal">
                  {symbol}↵
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
