/** "Shore Touch Massage" -> "ST" */
export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase());
  return letters.slice(0, 2).join("") || "?";
}

/** Swap "{name}" in mock copy for the owner's name. */
export function withName(text: string, name: string): string {
  return text.replaceAll("{name}", name);
}
