-- CreateEnum
CREATE TYPE "OrderStage" AS ENUM ('NEW', 'EDITING', 'PRINTING', 'READY', 'DONE', 'CANCELLED');

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "clientName" TEXT NOT NULL,
    "phone" TEXT,
    "service" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "priceSom" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "dueOn" DATE,
    "stage" "OrderStage" NOT NULL DEFAULT 'NEW',
    "ledgerEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_ledgerEntryId_key" ON "Order"("ledgerEntryId");

-- CreateIndex
CREATE INDEX "Order_userId_stage_idx" ON "Order"("userId", "stage");

-- CreateIndex
CREATE INDEX "Order_userId_dueOn_idx" ON "Order"("userId", "dueOn");

-- CreateIndex
CREATE UNIQUE INDEX "Order_userId_number_key" ON "Order"("userId", "number");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LedgerEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

