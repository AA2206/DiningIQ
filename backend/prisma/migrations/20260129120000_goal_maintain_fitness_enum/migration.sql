/*
  Goal enum update:
  - Rename enum value MAINTAIN -> MAINTAIN_FITNESS
  - Remove GAIN_WEIGHT from the enum (and null out any existing rows that used it)

  NOTE: This assumes only the "User"."goal" column uses the "Goal" enum.
*/

BEGIN;

-- Create a new enum type with the desired values
ALTER TYPE "Goal" RENAME TO "Goal_old";

CREATE TYPE "Goal" AS ENUM ('LOSE_WEIGHT', 'MAINTAIN_FITNESS', 'BUILD_MUSCLE');

-- Convert existing rows:
-- - MAINTAIN -> MAINTAIN_FITNESS
-- - GAIN_WEIGHT -> NULL (since this option is no longer supported)
ALTER TABLE "User"
  ALTER COLUMN "goal" TYPE "Goal"
  USING (
    CASE
      WHEN "goal"::text = 'MAINTAIN' THEN 'MAINTAIN_FITNESS'::"Goal"
      WHEN "goal"::text = 'GAIN_WEIGHT' THEN NULL
      ELSE "goal"::text::"Goal"
    END
  );

DROP TYPE "Goal_old";

COMMIT;

