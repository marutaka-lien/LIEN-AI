import type {
  CsvExportSummaryDTO,
  OrderDTO,
  ShippingSegment,
  ShippingSegmentsDTO,
} from "@/types/order";
import { orderRepository, type OrderListFilters } from "./order.repository";
import { toOrderDTO } from "./order.mapper";

const ORDER_LIST_LIMIT = 200;
const SHIPPING_SEGMENT_ROW_LIMIT = 200;
const ORDER_DIRECTORY_PAGE_SIZE = 50;

export const orderService = {
  async listOrders(limit = ORDER_LIST_LIMIT, filters: OrderListFilters = {}): Promise<OrderDTO[]> {
    const orders = await orderRepository.findMany(limit, filters);
    return orders.map(toOrderDTO);
  },

  // 発送エントリー画面の「本日のCSV出力実績」表示用。
  async getTodayCsvExportSummary(): Promise<CsvExportSummaryDTO> {
    const { count, lastExportedAt } = await orderRepository.getTodayCsvExportSummary();
    return {
      count,
      lastExportedAt: lastExportedAt ? lastExportedAt.toISOString() : null,
    };
  },

  // 発送エントリー「作業メニュー」タブ用: 5セグメントの件数＋選択中セグメントの
  // 一覧を1回で返す。
  async getShippingSegments(active: ShippingSegment): Promise<ShippingSegmentsDTO> {
    const [counts, rows] = await Promise.all([
      orderRepository.countShippingSegments(),
      orderRepository.findSegmentOrders(active, SHIPPING_SEGMENT_ROW_LIMIT),
    ]);
    return {
      counts,
      active,
      rows: rows.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        ordererName: order.ordererName,
        postalCode: order.postalCode,
        prefecture: order.prefecture,
        address1: order.address1,
        address2: order.address2,
        orderedAt: order.orderedAt ? order.orderedAt.toISOString() : null,
        csvExportedAt: order.csvExportedAt ? order.csvExportedAt.toISOString() : null,
        shippingReportedAt: order.shippingReportedAt
          ? order.shippingReportedAt.toISOString()
          : null,
        heldAt: order.heldAt ? order.heldAt.toISOString() : null,
      })),
    };
  },

  // 「一時保存にする」/「未処理へ戻す」「一時保存から外す」。
  async setHeld(id: string, held: boolean): Promise<OrderDTO> {
    const order = await orderRepository.setHeld(id, held ? new Date() : null);
    return toOrderDTO(order);
  },

  async setHeldMany(ids: string[], held: boolean): Promise<{ count: number }> {
    return orderRepository.setHeldMany(ids, held ? new Date() : null);
  },

  // 発送エントリー「注文者情報一覧」タブ用。
  async listOrderDirectory(params: {
    search?: string;
    status?: string;
    sort?: "orderedAtDesc" | "orderedAtAsc";
    page?: number;
    pageSize?: number;
  }): Promise<{ orders: OrderDTO[]; total: number; page: number; pageSize: number }> {
    const page = params.page ?? 1;
    const pageSize = params.pageSize ?? ORDER_DIRECTORY_PAGE_SIZE;
    const { orders, total } = await orderRepository.findOrderDirectory({
      ...params,
      page,
      pageSize,
    });
    return { orders: orders.map(toOrderDTO), total, page, pageSize };
  },
};
