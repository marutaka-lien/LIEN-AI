"use client";

import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";
import { ProductList } from "./product-list";
import { ProductRegistrationWizard } from "./product-registration-wizard";
import { ReservationStatus } from "./reservation-status";

export function ProductsWorkspace() {
  return (
    <Tabs defaultValue="list" className="gap-6">
      <TabsList>
        <TabsTab value="list">商品一覧</TabsTab>
        <TabsTab value="register">新商品登録</TabsTab>
        <TabsTab value="schedule">予約状況</TabsTab>
      </TabsList>

      <TabsPanel value="list">
        <ProductList />
      </TabsPanel>

      <TabsPanel value="register">
        <ProductRegistrationWizard />
      </TabsPanel>

      <TabsPanel value="schedule">
        <ReservationStatus />
      </TabsPanel>
    </Tabs>
  );
}
