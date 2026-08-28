// 「RMS自動注文確認」用のAutomationJob.moduleKey / AutomationStep.stepKey / carrier定数。
// rms-clickpost/automation-module.tsと同じ命名パターンだが、このモジュールは
// 配送会社(ClickPost等)に一切関知しないため、carrierは「該当なし」を意味する
// 専用の値を持つ。

export const RMS_AUTO_CONFIRM_MODULE_KEY = "rms_auto_confirm";

export const STEP_KEY = {
  RMS_ORDER_CONFIRM: "rms_order_confirm",
} as const;

// AutomationJobItem.carrierは必須項目(配送会社)だが、このモジュールは注文確認のみを
// 行い配送会社を扱わないため、意味のある値がないことを明示する専用の値を使う。
export const CARRIER_NONE = "none";
