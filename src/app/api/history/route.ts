import { NextResponse } from "next/server";

import { listJobs } from "@/lib/job-store";

export async function GET() {
  try {
    const jobs = await listJobs();
    return NextResponse.json({ jobs });
  } catch (error) {
    console.error("Unable to load job history", error);

    return NextResponse.json(
      { error: "Unable to load job history." },
      { status: 500 },
    );
  }
}
