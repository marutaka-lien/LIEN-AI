// 「楽天RMS + クリックポスト」自動化モジュールの定義。
// AutomationJob.moduleKey / AutomationStep.stepKeyの値をここに一元管理し、
// 他ファイルに直接文字列をハードコードしない。

export const RAKUTEN_CLICKPOST_MODULE_KEY = "rakuten_clickpost";

export const STEP_KEY = {
  // Job全体に紐づくステップ(jobItemId=null)。
  RMS_FETCH: "rms_fetch",
  // 注文単位のステップ(jobItemIdあり)。
  RMS_ORDER_CONFIRM: "rms_order_confirm",
  CLICKPOST_REGISTER: "clickpost_register",
} as const;

export const CARRIER = {
  CLICKPOST: "clickpost",
} as const;
