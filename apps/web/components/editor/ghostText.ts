import { Extension } from "@tiptap/react";
import {
  type EditorState,
  Plugin,
  PluginKey,
  TextSelection,
} from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export type GhostTextSuggestions = {
  openers?: string[];
  closers?: string[];
  custom?: string[];
  common?: string[];
};

type NameResolver = string | undefined | (() => string | undefined);

export type GhostTextOptions = {
  senderName?: NameResolver;
  recipientName?: NameResolver;
  suggestions?: GhostTextSuggestions;
  disabled?: () => boolean;
  minPrefixLength?: number;
};

const fallbackSuggestions: Required<GhostTextSuggestions> = {
  openers: [
    "Hi {name},",
    "Hey {name},",
    "Hello {name},",
    "Thanks for the update, {name},",
    "Thanks for the quick reply, {name},",
    "Good morning {name},",
    "Good afternoon {name},",
    "Good evening {name},",
    "Hi there,",
    "Hello,",
    "Quick question,",
    "Quick update,",
    "Following up on ",
    "Circling back on ",
  ],
  closers: [
    "Best regards,\n{name}",
    "Kind regards,\n{name}",
    "Thanks,\n{name}",
    "Thank you,\n{name}",
    "Best,\n{name}",
    "Best regards,",
    "Best,",
    "Thanks,",
    "Thank you,",
  ],
  custom: [
    "Thanks for getting back to me.",
    "I wanted to follow up on ",
    "Here is a quick update on ",
    "Sharing a quick summary below.",
    "Here is what I found:",
    "Let me know if you want me to adjust this.",
    "Happy to jump on a quick call.",
    "Please let me know if you have any questions.",
    "Looking forward to your response.",
  ],
  common: [
    "I am writing to ",
    "Just checking in on ",
    "Top line: ",
    "Here is a quick update on ",
    "Next steps:",
    "As discussed, ",
  ],
};

const getTimeOfDay = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
};

const resolveName = (value?: NameResolver) => {
  if (!value) return undefined;
  const raw = typeof value === "function" ? value() : value;
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  return trimmed;
};

const buildSuggestions = (
  currentText: string,
  fullText: string,
  options: GhostTextOptions,
) => {
  const senderName = resolveName(options.senderName);
  const recipientName = resolveName(options.recipientName);
  const base = {
    ...fallbackSuggestions,
    ...options.suggestions,
  };

  const timeOfDay = getTimeOfDay();
  const openers = [...base.openers];
  if (recipientName) {
    openers.push(
      `Good ${timeOfDay} ${recipientName},`,
      `I hope you're doing well ${recipientName},`,
    );
  } else {
    openers.push(`Good ${timeOfDay},`);
  }

  const closers = senderName
    ? base.closers.map((line) => line.replace("{name}", senderName))
    : base.closers.filter((line) => !line.includes("{name}"));

  const openersResolved = recipientName
    ? openers.map((line) => line.replace("{name}", recipientName))
    : openers.filter((line) => !line.includes("{name}"));

  const allSuggestions = [
    ...openersResolved,
    ...closers,
    ...base.custom,
    ...base.common,
  ].filter(Boolean);

  const trimmedText = currentText.trim();
  if (!trimmedText) return [];

  const inMiddleOfEmail = fullText.trim().length > 120;
  const seenGreeting = fullText
    .split("\n")
    .slice(0, 3)
    .join("\n")
    .toLowerCase();

  return allSuggestions
    .filter((suggestion) => {
      const suggestionLower = suggestion.toLowerCase();
      const matches = suggestionLower.startsWith(trimmedText.toLowerCase());
      const extendsText = suggestion.length > trimmedText.length;
      if (!matches || !extendsText) return false;

      if (inMiddleOfEmail) {
        const isGreeting =
          suggestionLower.startsWith("hi ") ||
          suggestionLower.startsWith("hello") ||
          suggestionLower.startsWith("dear") ||
          suggestionLower.startsWith("good ");
        if (isGreeting) return false;
      }

      if (
        suggestion.includes(",") &&
        seenGreeting.includes(suggestion.split(",")[0]?.toLowerCase() ?? "")
      ) {
        return false;
      }

      return true;
    })
    .sort((a, b) => a.length - b.length);
};

export const GhostText = Extension.create<GhostTextOptions>({
  name: "ghostText",
  addOptions() {
    return {
      senderName: undefined,
      recipientName: undefined,
      suggestions: undefined,
      disabled: undefined,
      minPrefixLength: 2,
    };
  },
  addProseMirrorPlugins() {
    const key = new PluginKey("ghostText");
    const options = this.options;
    const usedSuggestions = new Set<string>();

    const isCursorAtEnd = (state: EditorState) => {
      const { selection } = state;
      if (!(selection instanceof TextSelection) || !selection.$cursor) {
        return false;
      }
      const { $cursor } = selection;
      const remainingText = $cursor.parent.textBetween(
        $cursor.parentOffset,
        $cursor.parent.content.size,
        "\n",
        "\0",
      );
      return remainingText.length === 0;
    };

    const getSuggestion = (state: EditorState, currentLine: string) => {
      if (options.disabled?.()) return null;
      if (!isCursorAtEnd(state)) return null;
      if (currentLine.trim().length < (options.minPrefixLength ?? 2)) {
        return null;
      }

      const fullText = state.doc.textContent;
      if (!fullText.trim()) {
        usedSuggestions.clear();
      }

      const suggestions = buildSuggestions(currentLine, fullText, options).filter(
        (suggestion) => !usedSuggestions.has(suggestion),
      );

      return suggestions[0] ?? null;
    };

    return [
      new Plugin({
        key,
        props: {
          handleKeyDown(view, event) {
            if (event.key !== "Tab") return false;
            if (options.disabled?.()) return false;

            const { state } = view;
            const { selection } = state;
            if (!(selection instanceof TextSelection) || !selection.$cursor) {
              return false;
            }

            const pos = selection.$cursor.pos;
            const lineStart = state.doc.resolve(pos).start();
            const currentLine = state.doc.textBetween(lineStart, pos, "\n", "\0");
            if (!currentLine) return false;

            const suggestion = getSuggestion(state, currentLine);
            if (!suggestion) return false;

            const remainingText = suggestion.slice(currentLine.length);
            if (!remainingText) return false;

            event.preventDefault();

            const tr = state.tr;
            tr.insertText(remainingText, pos);
            view.dispatch(tr);
            usedSuggestions.add(suggestion);
            return true;
          },
          decorations: (state) => {
            if (options.disabled?.()) return DecorationSet.empty;
            const { doc, selection } = state;
            if (!(selection instanceof TextSelection) || !selection.$cursor) {
              return DecorationSet.empty;
            }

            const pos = selection.$cursor.pos;
            const lineStart = doc.resolve(pos).start();
            const currentLine = doc.textBetween(lineStart, pos, "\n", "\0");
            if (!currentLine) return DecorationSet.empty;

            const suggestion = getSuggestion(state, currentLine);
            if (!suggestion) return DecorationSet.empty;

            const remainingText = suggestion.slice(currentLine.length);
            if (!remainingText) return DecorationSet.empty;

            const decoration = Decoration.widget(pos, () => {
              const span = document.createElement("span");
              span.textContent = remainingText;
              span.className = "ghost-text-suggestion";
              return span;
            });

            return DecorationSet.create(doc, [decoration]);
          },
        },
      }),
    ];
  },
});
