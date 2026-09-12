import { PageHeader } from "@/components/layout/page-header";
import { ProductsWorkspace } from "@/components/products/products-workspace";

export default function ProductsPage() {
  return (
    <>
      <PageHeader description="商品を見渡し、登録・更新・公開予約まで一つの場所で。（見た目のみのUI先行公開・データはすべてダミーです）" />

      <div className="flex flex-col gap-6 px-8 py-6">
        <ProductsWorkspace />
      </div>
    </>
  );
}
