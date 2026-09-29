CREATE TABLE "RohlikConnection" (
    "id" TEXT NOT NULL,
    "credentials" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RohlikConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RohlikProductPreference" (
    "connectionId" TEXT NOT NULL,
    "ingredientKey" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "chosenCount" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RohlikProductPreference_pkey" PRIMARY KEY ("connectionId","ingredientKey")
);
