-- CreateTable
CREATE TABLE "ProcessedWebhook" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paymongoEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "processingResult" TEXT,
    "httpStatus" INTEGER NOT NULL DEFAULT 200,
    "processedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessTin" TEXT NOT NULL DEFAULT '000-000-000-000',
    "businessName" TEXT NOT NULL DEFAULT 'AMPH Academy',
    "businessAddress" TEXT NOT NULL DEFAULT 'Philippines',
    "grossAmountCentavos" INTEGER NOT NULL,
    "vatAmountCentavos" INTEGER NOT NULL,
    "netAmountCentavos" INTEGER NOT NULL,
    "pdfUrl" TEXT,
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedWebhook_paymongoEventId_key" ON "ProcessedWebhook"("paymongoEventId");

-- CreateIndex
CREATE INDEX "ProcessedWebhook_eventType_processedAt_idx" ON "ProcessedWebhook"("eventType", "processedAt");

-- CreateIndex
CREATE INDEX "ProcessedWebhook_resourceType_resourceId_idx" ON "ProcessedWebhook"("resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "ProcessedWebhook_processedAt_idx" ON "ProcessedWebhook"("processedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_paymentId_key" ON "Invoice"("paymentId");

-- CreateIndex
CREATE INDEX "Invoice_userId_issuedAt_idx" ON "Invoice"("userId", "issuedAt");

-- CreateIndex
CREATE INDEX "Invoice_deletedAt_idx" ON "Invoice"("deletedAt");
