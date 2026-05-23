/** Placeholder meal plan content when menu data or AI generation is unavailable. */

export const UNAVAILABLE_MEAL_CARD = {
  Meal_Option: 'No Recommendations Available',
  Description: 'Meal recommendations are currently unavailable. Please try again later.',
  Entrees: [] as { id: number; entree: string }[],
};

export const DINING_HALL_KEYS = [
  'Yahentamitisi_Dining_Hall',
  'South_Campus_Dining_Hall',
  'North_251_Dining_Hall',
] as const;

export function buildUnavailableMealSlot() {
  return Object.fromEntries(
    DINING_HALL_KEYS.map((hall) => [hall, [{ ...UNAVAILABLE_MEAL_CARD }]])
  );
}

export function buildUnavailableDayPlan(meals: string[]) {
  const plan: Record<string, ReturnType<typeof buildUnavailableMealSlot>> = {};
  for (const meal of meals) {
    plan[meal] = buildUnavailableMealSlot();
  }
  return plan;
}

export function isQuotaOrRateLimitError(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  return (
    message.includes('quota') ||
    message.includes('rate limit') ||
    message.includes('resource exhausted') ||
    message.includes('too many requests') ||
    message.includes('429') ||
    message.includes('billing') ||
    message.includes('exceeded')
  );
}
