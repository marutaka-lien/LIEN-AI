import { PageHeader } from "@/components/layout/page-header";
import { ReviewsWorkspace } from "@/components/reviews/reviews-workspace";

export default function ReviewsPage() {
  return (
    <>
      <PageHeader description="楽天RMSのレビューを同期し、返信文の生成・投稿を一元管理します。" />

      <div className="flex flex-col gap-6 px-8 py-6">
        <ReviewsWorkspace />
      </div>
    </>
  );
}
