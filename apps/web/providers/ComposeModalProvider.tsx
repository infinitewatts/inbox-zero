"use client";

import { createContext, useContext, useState } from "react";
import { useModal } from "@/hooks/useModal";
import { ComposeEmailFormLazy } from "@/app/(app)/[emailAccountId]/compose/ComposeEmailFormLazy";
import { Button } from "@/components/ui/button";
import { MinusIcon, XIcon, MaximizeIcon, MinimizeIcon } from "lucide-react";
import { cn } from "@/utils";

type Context = {
  onOpen: () => void;
};

const ComposeModalContext = createContext<Context>({
  onOpen: async () => {},
});

export const useComposeModal = () => useContext(ComposeModalContext);

export function ComposeModalProvider(props: { children: React.ReactNode }) {
  const { isModalOpen, openModal, closeModal } = useModal();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const handleClose = () => {
    setIsMinimized(false);
    setIsMaximized(false);
    closeModal();
  };

  return (
    <ComposeModalContext.Provider value={{ onOpen: openModal }}>
      {props.children}

      {/* Gmail-style floating compose window */}
      {isModalOpen && (
        <div
          className={cn(
            "fixed z-50 flex flex-col overflow-hidden rounded-t-lg border border-border bg-background shadow-2xl transition-all duration-200",
            isMaximized
              ? "bottom-0 left-[10%] right-[10%] top-16 rounded-lg"
              : isMinimized
                ? "bottom-0 right-4 h-10 w-72"
                : "bottom-0 right-4 h-[520px] w-[500px]",
          )}
        >
          {/* Header bar */}
          <div
            className={cn(
              "flex shrink-0 cursor-pointer items-center justify-between bg-slate-800 px-3 py-2 dark:bg-slate-900",
              isMinimized && "rounded-t-lg",
            )}
            onClick={() => isMinimized && setIsMinimized(false)}
          >
            <span className="text-sm font-medium text-white">New Message</span>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-slate-300 hover:bg-slate-700 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(!isMinimized);
                }}
              >
                <MinusIcon className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-slate-300 hover:bg-slate-700 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMaximized(!isMaximized);
                  setIsMinimized(false);
                }}
              >
                {isMaximized ? (
                  <MinimizeIcon className="h-3.5 w-3.5" />
                ) : (
                  <MaximizeIcon className="h-3.5 w-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-slate-300 hover:bg-red-600 hover:text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
              >
                <XIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          {!isMinimized && (
            <div className="flex-1 overflow-y-auto p-4">
              <ComposeEmailFormLazy onSuccess={handleClose} />
            </div>
          )}
        </div>
      )}
    </ComposeModalContext.Provider>
  );
}
