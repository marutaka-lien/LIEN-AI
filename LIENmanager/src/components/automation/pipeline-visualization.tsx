import { buildPipelineStages } from "@/lib/pipeline-status";
import type { AutomationJobDetailDTO } from "@/types/automation";
import { PipelineStage } from "./pipeline-stage";

export function PipelineVisualization({ job }: { job: AutomationJobDetailDTO | null }) {
  const stages = job
    ? buildPipelineStages(job)
    : buildPipelineStages({
        id: "",
        moduleKey: "",
        status: "pending",
        totalCount: 0,
        successCount: 0,
        failureCount: 0,
        progressPercentage: 0,
        currentLabel: null,
        startedAt: null,
        finishedAt: null,
        createdAt: new Date().toISOString(),
        jobSteps: [],
        items: [],
      });

  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface p-5">
      <div className="flex min-w-[640px] items-start">
        {stages.map((stage, index) => (
          <PipelineStage key={stage.key} stage={stage} isLast={index === stages.length - 1} />
        ))}
      </div>
    </div>
  );
}
