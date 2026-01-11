"use client";

import { createContext, useContext, useState } from "react";
import { useModal } from "@/hooks/useModal";
import { ComposeEmailFormLazy } from "@/app/(app)/[emailAccountId]/compose/ComposeEmailFormLazy";
import {
  Maximize2Icon,
  Minimize2Icon,
  ChevronDownIcon,
  XIcon,
  Trash2Icon,
} from "lucide-react";
import { cn } from "@/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Context = {
  onOpen: () => void;
};

const ComposeModalContext = createContext<Context>({
  onOpen: async () => {},
});

export const useComposeModal = () => useContext(ComposeModalContext);

function HeaderButton({
  onClick,
  tooltip,
  children,
  variant = "default",
}: {
  onClick: (e: React.MouseEvent) => void;
  tooltip: string;
  children: React.ReactNode;
  variant?: "default" | "danger";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-md transition-colors",
            variant === "danger"
              ? "text-muted-foreground hover:bg-red-500/10 hover:text-red-500"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          onClick={onClick}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}

export function ComposeModalProvider(props: { children: React.ReactNode }) {
  const { isModalOpen, openModal, closeModal } = useModal();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleClose = () => {
    setIsMinimized(false);
    setIsMaximized(false);
    closeModal();
  };

  const handleDiscard = () => {
    handleClose();
  };

  return (
    <ComposeModalContext.Provider value={{ onOpen: openModal }}>
      {props.children}

      {isModalOpen && (
        <div
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl transition-all duration-200",
            isMaximized
              ? "bottom-4 left-[10%] right-[10%] top-16"
              : isMinimized
                ? "bottom-0 right-4 h-11 w-80 rounded-b-none"
                : "bottom-0 right-4 h-[560px] w-[640px] rounded-b-none",
          )}
        >
          {/* Header */}
          <div
            className={cn(
              "flex shrink-0 items-center justify-between border-b border-border px-2 py-1.5",
              isMinimized && "cursor-pointer hover:bg-accent/50",
            )}
            onClick={() => isMinimized && setIsMinimized(false)}
          >
            {/* Left controls */}
            <div className="flex items-center gap-0.5">
              <HeaderButton
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                tooltip="Close"
              >
                <XIcon className="h-4 w-4" />
              </HeaderButton>
              <HeaderButton
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMaximized(!isMaximized);
                  setIsMinimized(false);
                }}
                tooltip={isMaximized ? "Exit fullscreen" : "Fullscreen"}
              >
                {isMaximized ? (
                  <Minimize2Icon className="h-4 w-4" />
                ) : (
                  <Maximize2Icon className="h-4 w-4" />
                )}
              </HeaderButton>
              <HeaderButton
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(!isMinimized);
                }}
                tooltip={isMinimized ? "Expand" : "Minimize"}
              >
                <ChevronDownIcon
                  className={cn(
                    "h-4 w-4 transition-transform",
                    isMinimized && "rotate-180",
                  )}
                />
              </HeaderButton>
            </div>

            {/* Title */}
            <span className="text-sm font-medium">New Message</span>

            {/* Right controls */}
            <div className="flex items-center gap-0.5">
              <HeaderButton
                onClick={(e) => {
                  e.stopPropagation();
                  handleDiscard();
                }}
                tooltip="Discard"
                variant="danger"
              >
                <Trash2Icon className="h-4 w-4" />
              </HeaderButton>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <div className="flex flex-1 flex-col overflow-hidden">
              <ComposeEmailFormLazy onSuccess={handleClose} />
            </div>
          )}
        </div>
      )}
    </ComposeModalContext.Provider>
  );
}
