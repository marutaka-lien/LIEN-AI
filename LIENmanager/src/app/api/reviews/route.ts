import { NextResponse } from "next/server";

import { reviewService } from "@/server/review/review.service";

// orders/route.tsと異なり、リクエストのたびにバックグラウンド同期はfire-and-forgetしない
// (Playwrightブラウザ起動を毎回誘発しないため)。同期は/api/automation/review-sync/run
// への明示的なボタン操作でのみ行う。
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reviewType = searchParams.get("reviewType");
  const rating = searchParams.get("rating");
  const sinceDays = searchParams.get("sinceDays");

  const reviews = await reviewService.listReviews(undefined, {
    reviewType: reviewType || undefined,
    rating: rating ? Number(rating) : undefined,
    sinceDays: sinceDays ? Number(sinceDays) : undefined,
  });

  return NextResponse.json({ reviews });
}
