/** Assistant text claims the meal plan was persisted. */
export function messageClaimsPlanSaved(text: string): boolean {
  return (
    /úspěšně\s+uložen/i.test(text) ||
    /byl\s+(?:úspěšně\s+)?uložen/i.test(text) ||
    /byla\s+(?:úspěšně\s+)?uložena/i.test(text) ||
    /jídelní\s+plán[^.]{0,80}\bulozen\b/i.test(text) ||
    /plán\s+na\s+týden[^.]{0,120}\buložen\b/i.test(text) ||
    /uložení\s+proběhlo\s+úspěšně/i.test(text)
  );
}

const MISLEADING_SAVE_LINE =
  /^.*(?:\buložím\b|\buložíme\b).*(?:\bplán\b|\bjídelní\s+plán\b).*$|^.*(?:\bplán\b|\bjídelní\s+plán\b).*(?:\buložím\b|\buložíme\b).*$|^.*\b(?:tvůj|váš|ti|vám)\s+plán\s+ulož.*$/gim;

const FALSE_SAVE_CLAIM_LINE =
  /^.*(?:úspěšně\s+uložen|byl\s+úspěšně\s+uložen|byla\s+úspěšně\s+uložena|byl\s+uložen|byla\s+uložena|uložení\s+proběhlo|jídelní\s+plán[^\n]{0,100}\buložen\b|plán\s+na\s+týden[^\n]{0,120}\buložen\b).*$/gim;

const SAVE_BOILERPLATE_LINES =
  /^.*(?:připravím\s+json|json\s+blok|uložení\s+plánu|nyní\s+.*ulož|připravuji\s+plán|aktualizuji\s+plán|provedu\s+uložení|právě\s+ulož).*$/gim;

/** Apology / retry / phantom plan text when UI shows tool result or error. */
const PHANTOM_PLAN_CONTENT =
  /(?:^|\n)\s*(?:Při přípravě[\s\S]*?Pojďme to upravit\.\s*)?(?:#{0,3}\s*)?Jídelní plán na[\s\S]*?(?=\n\s*(?:Nyní\s+(?:zkontroluji|připravím)|$)|$)/i;

const PHANTOM_PLAN_TAIL =
  /^.*(?:nyní\s+zkontroluji|nyní\s+připravím|zkontroluji\s+a\s+připravím).*$/gim;

/** Removes JSON blocks and lines that falsely imply the plan was saved. */
export function stripAssistantPlanDisplayText(
  text: string,
  options: {
    planWasSavedByTool: boolean;
    hasPreparedPlanFromTool?: boolean;
    hidePhantomWeeklyPlan?: boolean;
  }
): string {
  let result = text.replace(/```json\s*[\s\S]*?```/gi, "");
  result = result.replace(/```json\s*[\s\S]*$/i, "");
  result = result.replace(/```\s*$/i, "");
  result = result.replace(/\{[\s\S]*"type"\s*:\s*"mealPlan"[\s\S]*$/i, "");
  result = result
    .replace(MISLEADING_SAVE_LINE, "")
    .replace(SAVE_BOILERPLATE_LINES, "")
    .replace(PHANTOM_PLAN_TAIL, "")
    .replace(
      /\s*(?:tvůj plán uložím|váš plán uložím|plán\s+(?:ti\s+|vám\s+)?uložím)[.!…]*\s*$/i,
      ""
    );

  if (options.hasPreparedPlanFromTool || options.hidePhantomWeeklyPlan) {
    result = result.replace(PHANTOM_PLAN_CONTENT, "");
    result = result.replace(
      /^.*(?:při\s+přípravě\s+(?:jídelního\s+)?plánu|neplatným\s+identifikátor|pojďme\s+to\s+upravit|nový\s+návrh\s+jídelního\s+plánu).*$/gim,
      ""
    );
  }

  if (!options.planWasSavedByTool) {
    result = result.replace(FALSE_SAVE_CLAIM_LINE, "");
  }

  return result.trim();
}

/** @deprecated Use stripAssistantPlanDisplayText */
export function stripHiddenJsonBlocks(text: string): string {
  return stripAssistantPlanDisplayText(text, { planWasSavedByTool: false });
}
