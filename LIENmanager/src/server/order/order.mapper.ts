import type { Order } from "@/generated/prisma/client";
import type { OrderDTO } from "@/types/order";

export function toOrderDTO(order: Order): OrderDTO {
  return {
    id: order.id,
    channel: order.channel,
    orderNumber: order.orderNumber,
    ordererName: order.ordererName,
    recipientName: order.recipientName,
    postalCode: order.postalCode,
    prefecture: order.prefecture,
    address1: order.address1,
    address2: order.address2,
    phoneNumber: order.phoneNumber,
    email: order.email,
    shippingMethod: order.shippingMethod,
    orderStatus: order.orderStatus,
    orderedAt: order.orderedAt ? order.orderedAt.toISOString() : null,
    totalPrice: order.totalPrice,
    paymentMethod: order.paymentMethod,
    trackingNumber: order.trackingNumber,
    rmsShippingReflectedAt: order.rmsShippingReflectedAt
      ? order.rmsShippingReflectedAt.toISOString()
      : null,
    clickPostRegisteredAt: order.clickPostRegisteredAt
      ? order.clickPostRegisteredAt.toISOString()
      : null,
    csvExportedAt: order.csvExportedAt ? order.csvExportedAt.toISOString() : null,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}
