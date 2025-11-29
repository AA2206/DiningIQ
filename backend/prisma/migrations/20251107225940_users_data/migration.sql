-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK');

-- CreateEnum
CREATE TYPE "Goal" AS ENUM ('LOSE_WEIGHT', 'GAIN_WEIGHT', 'MAINTAIN', 'BUILD_MUSCLE');

-- CreateEnum
CREATE TYPE "DietType" AS ENUM ('VEGETARIAN', 'VEGAN', 'OMNIVORE', 'KETO');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passcode" TEXT NOT NULL,
    "gender" "Gender",
    "frequency" TEXT,
    "height" DOUBLE PRECISION,
    "weight" DOUBLE PRECISION,
    "age" INTEGER,
    "goal" "Goal",
    "diet" "DietType",
    "other" TEXT,
    "mealPlan" JSONB,
    "mealPlanPopulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "entreeId" INTEGER,
    "meal" "MealType" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "diningHall" TEXT NOT NULL,
    "servings" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UMD_Dining" (
    "id" SERIAL NOT NULL,
    "entree" TEXT NOT NULL,
    "diningHall" TEXT NOT NULL,
    "meal" "MealType" NOT NULL,
    "dietaryInformation" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "totalCalories" INTEGER NOT NULL,
    "totalFat" INTEGER NOT NULL,
    "totalCarbohydrate" INTEGER NOT NULL,
    "saturatedFat" INTEGER NOT NULL,
    "dietaryFiber" INTEGER NOT NULL,
    "transFat" INTEGER NOT NULL,
    "totalSugars" INTEGER NOT NULL,
    "cholesterol" INTEGER NOT NULL,
    "sodium" INTEGER NOT NULL,
    "protein" INTEGER NOT NULL,

    CONSTRAINT "UMD_Dining_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealStats" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "meal" "MealType" NOT NULL,
    "diningHall" TEXT NOT NULL,
    "calories" INTEGER NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "fats" INTEGER NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Meal_userId_date_idx" ON "Meal"("userId", "date");

-- CreateIndex
CREATE INDEX "Meal_date_idx" ON "Meal"("date");

-- CreateIndex
CREATE INDEX "UMD_Dining_diningHall_meal_idx" ON "UMD_Dining"("diningHall", "meal");

-- CreateIndex
CREATE INDEX "MealStats_userId_date_idx" ON "MealStats"("userId", "date");

-- CreateIndex
CREATE INDEX "MealStats_date_idx" ON "MealStats"("date");

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_entreeId_fkey" FOREIGN KEY ("entreeId") REFERENCES "UMD_Dining"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealStats" ADD CONSTRAINT "MealStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
