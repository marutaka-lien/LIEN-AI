import { ReviewsWorkspace } from "@/components/reviews/reviews-workspace";

export default function ReviewsPage() {
  return (
    <div className="flex flex-col gap-6 px-4 pb-8 pt-2 sm:px-6 lg:px-8">
      <ReviewsWorkspace />
    </div>
  );
}
