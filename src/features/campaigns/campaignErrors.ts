export function campaignSaveError(cause: unknown): string {
  const message = cause instanceof Error ? cause.message : "";
  if (/required|date must|date range/i.test(message)) return message;
  if (/storage|quota|persist|database/i.test(message)) {
    return "The campaign could not be saved. Your browser storage may be unavailable or full. Please try again or contact support.";
  }
  if (/network|fetch|offline/i.test(message)) {
    return "The campaign could not be saved because the network is unavailable. Check your connection and try again.";
  }
  return "The campaign could not be saved. Please try again. If the problem continues, contact support.";
}

