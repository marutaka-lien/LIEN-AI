import { NextResponse } from "next/server";

import { automationJobService } from "@/server/automation/automation-job.service";

export async function GET() {
  const jobs = await automationJobService.listRecentJobs(20);
  return NextResponse.json({ jobs });
}
