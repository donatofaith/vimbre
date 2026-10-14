import { NextResponse } from "next/server";

// Contract placeholder only. Never expose handover data before Supabase Auth + RLS are configured.
export async function GET() { return NextResponse.json({ error: "Handover API not connected yet" }, { status: 501 }); }
export async function POST() { return NextResponse.json({ error: "Handover API not connected yet" }, { status: 501 }); }
