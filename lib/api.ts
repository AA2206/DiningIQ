import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:3000";

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await AsyncStorage.getItem("token");
  return fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

export const api = {
  // ── Auth (no token required) ─────────────────────────────────────────────

  googleAuth: (idToken: string) =>
    apiFetch("/google-auth", { method: "POST", body: JSON.stringify({ idToken }) }),

  appleAuth: (identityToken: string) =>
    apiFetch("/apple-auth", { method: "POST", body: JSON.stringify({ identityToken }) }),

  // ── User ─────────────────────────────────────────────────────────────────

  getUserProfile: () =>
    apiFetch("/user-profile"),

  addMetrics: (height: string | number, weight: string | number, age: string | number) =>
    apiFetch("/add-metrics", { method: "POST", body: JSON.stringify({ height, weight, age }) }),

  updateField: (field: string, selectedValue: unknown) =>
    apiFetch("/update-field", { method: "POST", body: JSON.stringify({ field, selectedValue }) }),

  updateOther: (other: string) =>
    apiFetch("/other", { method: "POST", body: JSON.stringify({ other }) }),

  deleteAccount: () =>
    apiFetch("/delete-account", { method: "DELETE" }),

  // ── Meal Plan ─────────────────────────────────────────────────────────────

  getMealPlan: () =>
    apiFetch("/get-meal-plan"),

  generateMealPlan: () =>
    apiFetch("/generate-meal-plan", { method: "POST" }),

  getGenerationStatus: () =>
    apiFetch("/generation-status"),

  modifyMealPlan: (user_query: string) =>
    apiFetch("/modify-meal-plan", { method: "POST", body: JSON.stringify({ user_query }) }),

  // ── Meal Logging ──────────────────────────────────────────────────────────

  fetchMeals: (dateISO: string) =>
    apiFetch(`/fetch-meals?date=${encodeURIComponent(dateISO)}`),

  fetchMealStats: (dateISO: string, meal: string) =>
    apiFetch(`/fetch-meal-stats?date=${encodeURIComponent(dateISO)}&meal=${encodeURIComponent(meal)}`),

  addMeal: (body: {
    mealName: string;
    mealDescription?: string;
    mealType: string;
    date: string;
    diningHall: string;
    entrees: { id: number; servingSize: number }[];
    servingSize: number;
  }) => apiFetch("/add-meal", { method: "POST", body: JSON.stringify(body) }),

  removeMeal: (mealId: number) =>
    apiFetch("/remove-meal", { method: "DELETE", body: JSON.stringify({ mealId }) }),

  updateMeal: (body: {
    mealId: number;
    mealName?: string;
    mealDescription?: string;
    entrees: { id: number; servingSize: number }[];
  }) => apiFetch("/update-meal", { method: "PUT", body: JSON.stringify(body) }),

  increaseServing: (mealId: number) =>
    apiFetch("/increase-serving", { method: "PUT", body: JSON.stringify({ mealId }) }),

  decreaseServing: (mealId: number) =>
    apiFetch("/decrease-serving", { method: "PUT", body: JSON.stringify({ mealId }) }),

  // ── Entrees ───────────────────────────────────────────────────────────────

  fetchAllEntrees: (diningHall: string, mealType: string) =>
    apiFetch(`/fetchAllEntrees?diningHall=${encodeURIComponent(diningHall)}&mealType=${encodeURIComponent(mealType)}`),

  verifyEntrees: (entreeNames: string[], mealType: string, diningHall: string) =>
    apiFetch("/verify-entrees", { method: "POST", body: JSON.stringify({ entreeNames, mealType, diningHall }) }),

  getEntreesByNames: (entreeNames: string[], mealType: string, diningHall: string) =>
    apiFetch("/get-entrees-by-names", { method: "POST", body: JSON.stringify({ entreeNames, mealType, diningHall }) }),

  // ── Analytics ─────────────────────────────────────────────────────────────

  getWeeklyMacros: (dateISO: string) =>
    apiFetch(`/weekly-macros?date=${encodeURIComponent(dateISO)}`),
};
