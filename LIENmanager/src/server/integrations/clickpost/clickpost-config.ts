import path from "node:path";

import { z } from "zod";

import { ClickPostConfigError } from "./clickpost-errors";

// ClickPostBrowserClient用の設定。
//
// 2026-07-23 実画面調査で判明: ClickPostにはメール/パスワード形式の独自ログイン画面が
// 存在しない。Yahoo! JAPAN IDまたはAmazonアカウントによるOAuthログインのみで、
// ログインフォーム自体はClickPost管理下にないため、当初想定していた
// CLICKPOST_LOGIN_URL(専用ログイン画面)という設計は誤りだった。
// ログイン状態は「マイページURLへアクセスできるか」で判定する。
const ClickPostBrowserEnvSchema = z.object({
  CLICKPOST_TOP_URL: z.url().default("https://clickpost.jp/"),
  CLICKPOST_MYPAGE_URL: z.url().default("https://clickpost.jp/mypage/index"),
  CLICKPOST_BROWSER_PROFILE_DIR: z.string().min(1).default("playwright/.auth/clickpost-profile"),
});

export interface ClickPostBrowserConfig {
  topUrl: string;
  mypageUrl: string;
  profileDir: string;
}

export function loadClickPostBrowserConfig(
  env: NodeJS.ProcessEnv = process.env
): ClickPostBrowserConfig {
  const parsed = ClickPostBrowserEnvSchema.safeParse(env);

  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new ClickPostConfigError(`ClickPostブラウザ設定が不足または不正です: ${missing}`);
  }

  return {
    topUrl: parsed.data.CLICKPOST_TOP_URL,
    mypageUrl: parsed.data.CLICKPOST_MYPAGE_URL,
    profileDir: path.resolve(process.cwd(), parsed.data.CLICKPOST_BROWSER_PROFILE_DIR),
  };
}
