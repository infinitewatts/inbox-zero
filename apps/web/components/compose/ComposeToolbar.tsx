"use client";

import {
  CheckIcon,
  FileTextIcon,
  PlayIcon,
  RefreshCwIcon,
  SaveIcon,
  SparklesIcon,
  TrashIcon,
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

type ComposeToolbarProps = {
  onGenerateDraft: () => void;
  onContinue: () => void;
  onSaveTemplate: () => void;
  onApplyTemplate: (template: ComposeTemplate) => void;
  onDeleteTemplate: (templateId: string) => void;
  templates: ComposeTemplate[];
  isGenerating: boolean;
  isContinuing: boolean;
  selectedPersona: string | null;
  onPersonaChange: (personaId: string | null) => void;
};

function IconButton({
  onClick,
  disabled,
  loading,
  tooltip,
  icon: Icon,
  variant = "ghost",
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  tooltip: string;
  icon: typeof SparklesIcon;
  variant?: "ghost" | "outline" | "default";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size="icon"
          className="h-8 w-8"
          onClick={onClick}
          disabled={disabled}
        >
          {loading ? <ButtonLoader /> : <Icon className="h-4 w-4" />}
          <span className="sr-only">{tooltip}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  );
}

export function ComposeToolbar({
  onGenerateDraft,
  onContinue,
  onSaveTemplate,
  onApplyTemplate,
  onDeleteTemplate,
  templates,
  isGenerating,
  isContinuing,
  selectedPersona,
  onPersonaChange,
}: ComposeToolbarProps) {
  const isDisabled = isGenerating || isContinuing;
  const currentPersona = COMPOSE_PERSONAS.find((p) => p.id === selectedPersona);

  return (
    <div className="flex items-center gap-1">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="h-8 w-8"
            onClick={onGenerateDraft}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <ButtonLoader />
            ) : (
              <WandSparklesIcon className="h-4 w-4" />
            )}
            <span className="sr-only">Generate draft</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Generate draft</TooltipContent>
      </Tooltip>

      <IconButton
        onClick={onContinue}
        disabled={isDisabled}
        loading={isContinuing}
        tooltip="Continue writing"
        icon={PlayIcon}
        variant="outline"
      />

      <div className="mx-1 h-5 w-px bg-border" />

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2"
              >
                <UserIcon className="h-4 w-4" />
                <span className="text-xs">
                  {currentPersona?.name ?? "Tone"}
                </span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Writing tone</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onSelect={() => onPersonaChange(null)}
            className="flex items-center justify-between"
          >
            <span>Default</span>
            {!selectedPersona && <CheckIcon className="h-4 w-4" />}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {COMPOSE_PERSONAS.map((persona) => (
            <DropdownMenuItem
              key={persona.id}
              onSelect={() => onPersonaChange(persona.id)}
              className="flex flex-col items-start gap-0.5"
            >
              <div className="flex w-full items-center justify-between">
                <span>{persona.name}</span>
                {selectedPersona === persona.id && (
                  <CheckIcon className="h-4 w-4" />
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {persona.description}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

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
                <span className="sr-only">Templates</span>
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Templates</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onSelect={(event) => {
              event.preventDefault();
              onSaveTemplate();
            }}
          >
            <SaveIcon className="mr-2 h-4 w-4" />
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
                  <span className="truncate">{template.name}</span>
                  <button
                    type="button"
                    className="ml-2 rounded p-1 text-muted-foreground hover:text-destructive"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onDeleteTemplate(template.id);
                    }}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuItem>
              ))}
            </>
          )}
          {templates.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No templates yet
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function AutocompleteStatusBar({
  isGenerating,
  onRegenerate,
  onDismiss,
}: {
  isGenerating: boolean;
  onRegenerate: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-blue-200 bg-blue-50/50 px-3 py-1.5 text-sm dark:border-blue-800 dark:bg-blue-950/30">
      <div className="flex items-center gap-2">
        {isGenerating ? (
          <>
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-300 border-t-blue-600" />
            <span className="text-xs text-muted-foreground">Generating...</span>
          </>
        ) : (
          <>
            <SparklesIcon className="h-3.5 w-3.5 text-blue-500" />
            <span className="text-xs text-muted-foreground">
              <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">
                Tab
              </kbd>{" "}
              to accept
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onRegenerate}
              disabled={isGenerating}
            >
              <RefreshCwIcon
                className={`h-3 w-3 ${isGenerating ? "animate-spin" : ""}`}
              />
              <span className="sr-only">Regenerate</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Regenerate</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onDismiss}
            >
              <XIcon className="h-3 w-3" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Dismiss</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
