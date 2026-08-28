import { PageHeader } from "@/components/layout/page-header";
import { OrderListTable } from "@/components/orders/order-list-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrdersPage() {
  return (
    <>
      <PageHeader description="同期された注文の一覧です。RMSとの相違確認にご利用いただけます(10分ごとに自動更新)。" />

      <div className="flex flex-col gap-6 px-8 py-6">
        <Card>
          <CardHeader>
            <CardTitle>注文一覧</CardTitle>
            <CardDescription>
              「処理対象」バッジが付いている注文は、発送待ち(orderProgress=300)のため自動化の対象です。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border-subtle">
              <OrderListTable />
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
