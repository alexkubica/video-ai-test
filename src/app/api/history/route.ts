import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { getSessionEmail, isAllowedEmail, unauthorizedJson } from "@/lib/auth-helpers";
import { listJobs } from "@/lib/job-store";

export const GET = auth(async (request) => {
  if (!isAllowedEmail(getSessionEmail(request.auth))) {
    return unauthorizedJson();
  }

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
});
