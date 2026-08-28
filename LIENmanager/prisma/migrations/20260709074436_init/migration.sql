-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "ordererName" TEXT NOT NULL,
    "recipientName" TEXT,
    "postalCode" TEXT,
    "prefecture" TEXT,
    "address1" TEXT,
    "address2" TEXT,
    "phoneNumber" TEXT,
    "email" TEXT,
    "shippingMethod" TEXT,
    "orderStatus" TEXT,
    "orderedAt" DATETIME,
    "rawPayload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AutomationJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "moduleKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "progressPercentage" INTEGER NOT NULL DEFAULT 0,
    "stopRequested" BOOLEAN NOT NULL DEFAULT false,
    "currentLabel" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "AutomationJobItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "carrier" TEXT NOT NULL,
    "carrierMeta" JSONB,
    "status" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "labelPdfPath" TEXT,
    "errorMessage" TEXT,
    "processedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AutomationJobItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AutomationJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AutomationJobItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AutomationStep" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "jobItemId" TEXT,
    "stepKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "logPath" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AutomationStep_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "AutomationJob" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AutomationStep_jobItemId_fkey" FOREIGN KEY ("jobItemId") REFERENCES "AutomationJobItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_channel_orderNumber_key" ON "Order"("channel", "orderNumber");

-- CreateIndex
CREATE INDEX "AutomationJob_moduleKey_createdAt_idx" ON "AutomationJob"("moduleKey", "createdAt");

-- CreateIndex
CREATE INDEX "AutomationJobItem_jobId_status_idx" ON "AutomationJobItem"("jobId", "status");

-- CreateIndex
CREATE INDEX "AutomationJobItem_orderId_idx" ON "AutomationJobItem"("orderId");

-- CreateIndex
CREATE INDEX "AutomationStep_jobId_stepKey_idx" ON "AutomationStep"("jobId", "stepKey");

-- CreateIndex
CREATE INDEX "AutomationStep_jobItemId_stepKey_idx" ON "AutomationStep"("jobItemId", "stepKey");
