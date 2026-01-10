export type ComposePersona = {
  id: string;
  name: string;
  description: string;
  promptInstruction: string;
};

export const COMPOSE_PERSONAS: ComposePersona[] = [
  {
    id: "professional",
    name: "Professional",
    description: "Clear, business-appropriate tone",
    promptInstruction:
      "Write in a professional, business-appropriate tone. Be clear, concise, and respectful. Use proper grammar and avoid casual language.",
  },
  {
    id: "friendly",
    name: "Friendly",
    description: "Warm and approachable",
    promptInstruction:
      "Write in a warm, friendly, and approachable tone. Be personable while remaining professional. Feel free to use a conversational style.",
  },
  {
    id: "formal",
    name: "Formal",
    description: "Highly formal and structured",
    promptInstruction:
      "Write in a highly formal tone appropriate for executive communication or official correspondence. Use formal greetings, proper titles, and structured paragraphs.",
  },
  {
    id: "concise",
    name: "Concise",
    description: "Brief and to the point",
    promptInstruction:
      "Write in an extremely concise style. Get straight to the point. Use short sentences and avoid unnecessary words. Every sentence should add value.",
  },
  {
    id: "detailed",
    name: "Detailed",
    description: "Thorough and comprehensive",
    promptInstruction:
      "Write in a thorough and detailed style. Provide comprehensive information, context, and explanation. Use clear structure with paragraphs for different points.",
  },
  {
    id: "casual",
    name: "Casual",
    description: "Relaxed and informal",
    promptInstruction:
      "Write in a casual, relaxed tone as if writing to a friend or close colleague. Feel free to use contractions and informal expressions while remaining appropriate.",
  },
];

export function getPersonaById(id: string): ComposePersona | undefined {
  return COMPOSE_PERSONAS.find((p) => p.id === id);
}

export function getPersonaPromptInstruction(
  personaId: string | null | undefined,
): string | null {
  if (!personaId) return null;
  const persona = getPersonaById(personaId);
  return persona?.promptInstruction ?? null;
}
