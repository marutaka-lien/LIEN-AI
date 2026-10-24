import { ProductsWorkspace } from "@/components/products/products-workspace";

export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-2 sm:px-6 lg:px-8">
      <ProductsWorkspace />
    </div>
  );
}
