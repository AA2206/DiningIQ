import { google } from '@ai-sdk/google';
import { generateObject } from 'ai';
import { z } from 'zod';
import { toInputJson } from '../lib/json';
import {
  buildUnavailableDayPlan,
  buildUnavailableMealSlot,
  isQuotaOrRateLimitError,
} from '../lib/mealPlanUnavailable';
import { prisma } from '../lib/prisma';
import { getMealFilter } from '../lib/mealFilter';

const diningHallSchema = (withMacros: boolean) =>
  z.array(
    z.object({
      Meal_Option: z.string(),
      Description: z.string(),
      Entrees: z.array(z.object({ id: z.number(), entree: z.string() })),
      ...(withMacros ? { Calories: z.number(), Protein: z.number() } : {}),
    })
  );

const mealPlanSchema = z.object({
  Yahentamitisi_Dining_Hall: diningHallSchema(true),
  South_Campus_Dining_Hall: diningHallSchema(true),
  North_251_Dining_Hall: diningHallSchema(true),
});

const modifyMealPlanSchema = z.object({
  Yahentamitisi_Dining_Hall: diningHallSchema(false),
  South_Campus_Dining_Hall: diningHallSchema(false),
  North_251_Dining_Hall: diningHallSchema(false),
});

export async function modifyMealPlan(user_query: string, meal_plan: any) {
  const allMenuData = await prisma.uMD_Dining.findMany({
    select: {
      id: true,
      entree: true,
      diningHall: true,
      meal: true,
      dietaryInformation: true,
      category: true,
    },
  });

  const { object: modified } = await generateObject({
    model: google('gemini-2.5-pro'),
    schema: modifyMealPlanSchema,
    system: 'You are an expert dietitian that modifies existing meal plans based on user feedback and preferences.',
    prompt:
      'You are modifying an EXISTING meal plan based on the user\'s request. ' +
      'Here is the user\'s modification request: ' + user_query + '\n\n' +
      'CURRENT MEAL PLAN (modify this based on the user\'s request):\n' + JSON.stringify(meal_plan) + '\n\n' +
      'AVAILABLE MENU DATABASE (use only items from this database):\n' + JSON.stringify(allMenuData) + '\n\n' +
      'INSTRUCTIONS:\n' +
      '1. Review the current meal plan above\n' +
      '2. Modify it according to the user\'s request while maintaining the same structure\n' +
      '3. You can replace, add, or remove meal options based on the user\'s feedback\n' +
      '4. Use ONLY entrees from the provided database - do not invent new items\n' +
      '5. For each Meal_Option, the \'Entrees\' array must contain the exact \'id\' and \'entree\' name from the database - use them exactly as written, do not modify\n' +
      '6. Maintain meal options for all 3 dining halls (South Campus, Yahentamitisi Dining Hall, and 251 North)\n' +
      '7. Return the complete modified meal plan in the same format as the original',
  });

  return modified;
}

export async function generateMealPlanForUser(username: string) {
  const user = await prisma.user.findUnique({
    where: { username },
    select: { gender: true, height: true, weight: true, age: true, goal: true, frequency: true, diet: true, other: true },
  });

  if (!user) throw new Error('User not found');

  const user_query =
    `${username} is a ${user.gender || 'person'} who is ${user.height || 'unknown'} inches tall, ` +
    `${user.weight || 'unknown'} pounds, and ${user.age || 'unknown'} years old. ` +
    `Their goal is to ${user.goal || 'maintain health'} and they workout ${user.frequency || '0'} times a week. ` +
    `They have a ${user.diet || 'standard'} diet and '${user.other || 'no'} allergies/dietary restrictions.`;

  const today = new Date();
  const dayOfWeek = today.getDay();
  const tomorrowDayOfWeek = (dayOfWeek + 1) % 7;

  const meals = dayOfWeek === 0 || dayOfWeek === 6 ? ['Brunch', 'Dinner'] : ['Breakfast', 'Lunch', 'Dinner'];
  const meals2 = tomorrowDayOfWeek === 0 || tomorrowDayOfWeek === 6 ? ['Brunch', 'Dinner'] : ['Breakfast', 'Lunch', 'Dinner'];

  const [mealPlans, mealPlans2] = await Promise.all([
    generateDayMealPlans(user_query, meals, true, 'today'),
    generateDayMealPlans(user_query, meals2, false, 'tomorrow'),
  ]);

  await prisma.user.update({
    where: { username },
    data: {
      mealPlan: toInputJson(mealPlans),
      nextMealPlan: toInputJson(mealPlans2),
      mealPlanPopulated: false,
    },
  });

  return mealPlans;
}

async function isDayMenuTableEmpty(today: boolean): Promise<boolean> {
  const count = today ? await prisma.uMD_Dining.count() : await prisma.uMD_Dining2.count();
  return count === 0;
}

/** Generate all meals for one day (UMD_Dining or UMD_Dining2). Falls back to placeholders per meal or whole day. */
async function generateDayMealPlans(
  user_query: string,
  meals: string[],
  today: boolean,
  dayLabel: string
): Promise<Record<string, unknown>> {
  if (await isDayMenuTableEmpty(today)) {
    console.warn(`[meal-plan] ${dayLabel}: menu table is empty — using unavailable placeholders for all meals.`);
    return buildUnavailableDayPlan(meals);
  }

  const plan: Record<string, unknown> = {};

  for (const meal of meals) {
    try {
      plan[meal] = await generateMealPlanResponse(user_query, meal, today);
    } catch (error) {
      console.error(`[meal-plan] ${dayLabel} ${meal} generation failed:`, error);

      if (isQuotaOrRateLimitError(error)) {
        console.warn(`[meal-plan] ${dayLabel}: quota/rate limit — using unavailable placeholders for all meals.`);
        return buildUnavailableDayPlan(meals);
      }

      plan[meal] = buildUnavailableMealSlot();
    }
  }

  return plan;
}

async function generateMealPlanResponse(user_query: string, meal_type: string, today: boolean) {
  const mealFilter = getMealFilter(meal_type);

  const select = {
    id: true,
    entree: true,
    diningHall: true,
    meal: true,
    dietaryInformation: true,
    category: true,
    totalCalories: true,
    protein: true,
  };
  const where = { meal: mealFilter };

  const allMenuData = today
    ? await prisma.uMD_Dining.findMany({ select, where })
    : await prisma.uMD_Dining2.findMany({ select, where });

  if (allMenuData.length === 0) {
    console.warn(
      `[meal-plan] No menu items for ${meal_type} (${today ? 'UMD_Dining' : 'UMD_Dining2'}) — using unavailable placeholder.`
    );
    return buildUnavailableMealSlot();
  }

  const { object: mealPlan } = await generateObject({
    model: google('gemini-2.5-flash'),
    schema: mealPlanSchema,
    system: 'You are an expert dietitian that gives users meal recommendations based on their dietary preferences and goals.',
    prompt:
      'Using the attached dining hall nutrition database, generate meal options for the user at all 3 dining halls (South Campus, Yahentamitisi Dining Hall, and 251 North). ' +
      'You can either use entrees directly from the database or combine entrees with the same category in the database to create a meal option. ' +
      'Include the name of the meal option and a relatively concise description of the meal option. ' +
      'For each Meal_Option, the \'Entrees\' array must contain the exact \'id\' and \'entree\' name from the database - use them exactly as written, do not modify. ' +
      'For each Meal_Option, calculate the Calories and Protein by summing up the individual \'totalCalories\' and \'protein\' values of each entree in the \'Entrees\' array. You can find these individual \'totalCalories\' and \'protein\' values in the database included below. ' +
      'This is the user\'s query: ' + user_query + ' ' +
      'Here is the dining hall menu and nutrition database: ' + JSON.stringify(allMenuData),
  });

  return mealPlan;
}
