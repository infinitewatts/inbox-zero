// Helper functions for checking Outlook API errors

/**
 * Check if an error indicates that a resource already exists
 * (e.g., filter, category, etc.)
 */
export function isAlreadyExistsError(error: unknown): boolean {
  const errorMessage =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return (
    errorMessage.includes("already exists") ||
    errorMessage.includes("duplicate") ||
    errorMessage.includes("conflict")
  );
}
