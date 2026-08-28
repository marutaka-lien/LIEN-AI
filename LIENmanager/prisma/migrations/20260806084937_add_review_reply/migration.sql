-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Review" (
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
    "replyStatus" TEXT NOT NULL DEFAULT 'unreplied',
    "replyText" TEXT,
    "replyGeneratedAt" DATETIME,
    "repliedAt" DATETIME,
    "replyError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Review" ("body", "channel", "createdAt", "id", "orderNumber", "productName", "rating", "rawPayload", "reviewType", "reviewedAt", "sourceUrl", "title", "updatedAt") SELECT "body", "channel", "createdAt", "id", "orderNumber", "productName", "rating", "rawPayload", "reviewType", "reviewedAt", "sourceUrl", "title", "updatedAt" FROM "Review";
DROP TABLE "Review";
ALTER TABLE "new_Review" RENAME TO "Review";
CREATE INDEX "Review_reviewType_reviewedAt_idx" ON "Review"("reviewType", "reviewedAt");
CREATE INDEX "Review_rating_idx" ON "Review"("rating");
CREATE INDEX "Review_orderNumber_idx" ON "Review"("orderNumber");
CREATE INDEX "Review_replyStatus_idx" ON "Review"("replyStatus");
CREATE UNIQUE INDEX "Review_channel_sourceUrl_key" ON "Review"("channel", "sourceUrl");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
