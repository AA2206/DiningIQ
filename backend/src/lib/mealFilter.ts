// Returns the Prisma `meal` filter for a given meal type.
// Brunch-period meals overlap: Breakfast shows Breakfast+Brunch,
// Lunch shows Lunch+Brunch, Brunch shows all three.
export function getMealFilter(mealType: string): any {
  if (mealType === 'Brunch') {
    return { in: ['Brunch', 'Breakfast', 'Lunch'] as any[] };
  } else if (mealType === 'Breakfast') {
    return { in: ['Breakfast', 'Brunch'] as any[] };
  } else if (mealType === 'Lunch') {
    return { in: ['Lunch', 'Brunch'] as any[] };
  } else {
    return mealType as any;
  }
}
