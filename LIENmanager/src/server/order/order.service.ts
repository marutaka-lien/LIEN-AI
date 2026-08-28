import type { CsvExportSummaryDTO, OrderDTO } from "@/types/order";
import { orderRepository, type OrderListFilters } from "./order.repository";
import { toOrderDTO } from "./order.mapper";

const ORDER_LIST_LIMIT = 200;

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
};
