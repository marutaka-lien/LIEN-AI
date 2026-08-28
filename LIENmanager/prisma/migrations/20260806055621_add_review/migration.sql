-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "productName" TEXT,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "orderNumber" TEXT,
    "reviewedAt" DATETIME NOT NULL,
    "rawPayload" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "Review_reviewType_reviewedAt_idx" ON "Review"("reviewType", "reviewedAt");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE INDEX "Review_orderNumber_idx" ON "Review"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Review_channel_sourceUrl_key" ON "Review"("channel", "sourceUrl");
