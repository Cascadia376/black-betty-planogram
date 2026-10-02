export function campaignSaveError(cause: unknown): string {
  // Preserve the actionable inner conflict/quota message when a repository adds context.
  let error = cause;
  for (let depth = 0; depth < 4 && error instanceof Error && error.cause instanceof Error; depth += 1) {
    if (!/campaign storage failed/i.test(error.message)) break;
    error = error.cause;
  }
  const message = error instanceof Error ? error.message : "";
  if (/previous saved work is safe|no data was changed|saved merchandising work|another tab|original browser data/i.test(message)) return message;
  if (/required|date must|date range/i.test(message)) return message;
  if (/changed after you opened|stale.*save|conflict/i.test(message)) return message;
  if (/storage|quota|persist|database/i.test(message)) {
    return "The campaign could not be saved. Your browser storage may be unavailable or full. Please try again or contact support.";
  }
  if (/network|fetch|offline/i.test(message)) {
    return "The campaign could not be saved because the network is unavailable. Check your connection and try again.";
  }
  return "The campaign could not be saved. Please try again. If the problem continues, contact support.";
}

