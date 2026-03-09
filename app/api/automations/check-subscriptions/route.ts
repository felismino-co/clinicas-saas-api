import { NextResponse } from "next/server";
import { supabase } from "../../../../lib/supabase";

const OVERDUE_TOLERANCE_DAYS = 3;

export async function GET() {
  return postHandler();
}

export async function POST() {
  return postHandler();
}

async function postHandler() {
  try {
    const now = new Date().toISOString();
    const overdueLimit = new Date(Date.now() - OVERDUE_TOLERANCE_DAYS * 24 * 60 * 60 * 1000).toISOString();
    let blockedCount = 0;

    const { data: overdueClinics } = await supabase
      .from("clinics")
      .select("id, overdue_since")
      .eq("subscription_status", "overdue");

    for (const row of overdueClinics ?? []) {
      const r = row as { id: string; overdue_since: string | null };
      if (r.overdue_since && r.overdue_since <= overdueLimit) {
        await supabase
          .from("clinics")
          .update({ active: false, subscription_status: "blocked" } as Record<string, unknown>)
          .eq("id", r.id);
        blockedCount += 1;
      }
    }

    const { data: expiredTrials } = await supabase
      .from("clinics")
      .select("id")
      .eq("plan", "trial")
      .lt("plan_expires_at", now);

    for (const row of expiredTrials ?? []) {
      const id = (row as { id: string }).id;
      await supabase
        .from("clinics")
        .update({ active: false, subscription_status: "blocked" } as Record<string, unknown>)
        .eq("id", id);
      blockedCount += 1;
    }

    const checkedCount = (overdueClinics?.length ?? 0) + (expiredTrials?.length ?? 0);
    return NextResponse.json({ blocked_count: blockedCount, checked_count: checkedCount });
  } catch (err) {
    console.error("check-subscriptions error:", err);
    return NextResponse.json({ error: "processing_error" }, { status: 500 });
  }
}
