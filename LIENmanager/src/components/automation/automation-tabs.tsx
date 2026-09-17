"use client";

import { OrderDirectoryTab } from "@/components/automation/order-directory-tab";
import { ShippingEntryWorkspace } from "@/components/automation/shipping-entry-workspace";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@/components/ui/tabs";

// 発送エントリー画面の上部2タブ(2026-09-10 発送ページ集約)。
// タブ1「作業メニュー」= Claude Design v2そのまま(セグメント切替)。
// タブ2「注文者情報一覧」= 旧/orders画面相当(全ステータス表・検索・並べ替え・ページ送り)。
export function AutomationTabs() {
  return (
    <Tabs defaultValue="workspace">
      <TabsList>
        <TabsTab value="workspace">作業メニュー</TabsTab>
        <TabsTab value="directory">注文者情報一覧</TabsTab>
      </TabsList>
      <TabsPanel value="workspace">
        <ShippingEntryWorkspace />
      </TabsPanel>
      <TabsPanel value="directory">
        <OrderDirectoryTab />
      </TabsPanel>
    </Tabs>
  );
}
