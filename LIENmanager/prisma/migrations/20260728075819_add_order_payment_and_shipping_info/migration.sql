-- AlterTable
ALTER TABLE "Order" ADD COLUMN "paymentMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN "rmsShippingReflectedAt" DATETIME;
ALTER TABLE "Order" ADD COLUMN "totalPrice" INTEGER;
ALTER TABLE "Order" ADD COLUMN "trackingNumber" TEXT;
