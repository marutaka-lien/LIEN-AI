import { NextResponse } from "next/server";

import { automationJobService } from "@/server/automation/automation-job.service";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const jobId = body?.jobId;

  if (typeof jobId !== "string" || jobId.length === 0) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  await automationJobService.requestStop(jobId);

  return NextResponse.json({ ok: true });
}
