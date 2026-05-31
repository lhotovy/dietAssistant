/** Removes JSON blocks (complete and in-progress) from assistant message text. */
export function stripHiddenJsonBlocks(text: string): string {
  let result = text.replace(/```json\s*[\s\S]*?```/gi, "");
  result = result.replace(/```json\s*[\s\S]*$/i, "");
  result = result.replace(/```\s*$/i, "");
  result = result.replace(/\{[\s\S]*"type"\s*:\s*"mealPlan"[\s\S]*$/i, "");
  result = result
    .replace(/^.*připravím\s+json.*$/gim, "")
    .replace(/^.*json\s+blok.*$/gim, "")
    .replace(/^.*uložení\s+plánu.*$/gim, "")
    .replace(/^.*nyní\s+.*ulož.*$/gim, "")
    .replace(/^.*připravuji\s+plán.*$/gim, "");
  return result.trim();
}
