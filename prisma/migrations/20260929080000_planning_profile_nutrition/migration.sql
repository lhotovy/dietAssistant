ALTER TABLE "Recipe"
ADD COLUMN "sugarsPerServing" DOUBLE PRECISION,
ADD COLUMN "proteinPerServing" DOUBLE PRECISION,
ADD COLUMN "nutritionSource" TEXT;

CREATE TABLE "UserPlanningProfile" (
    "userId" TEXT NOT NULL,
    "instructions" TEXT NOT NULL DEFAULT '',
    "maxSugarsPerDay" DOUBLE PRECISION,
    "minProteinPerDay" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserPlanningProfile_pkey" PRIMARY KEY ("userId")
);
