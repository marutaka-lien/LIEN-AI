"use client";

import { useState } from "react";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { JobHistory } from "./job-history";

// 実行履歴は常に画面に出しておく必要がないため、ボタンで開閉できるようにする。
export function JobHistoryToggle() {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Button size="sm" variant="outline" onClick={() => setVisible((prev) => !prev)}>
        <History />
        {visible ? "実行履歴を隠す" : "実行履歴を見る"}
      </Button>

      {visible && <JobHistory />}
    </div>
  );
}
