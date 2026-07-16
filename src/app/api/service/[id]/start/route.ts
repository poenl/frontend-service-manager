import { NextResponse } from "next/server";
import { startService } from "@/lib/service-process";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json(startService(id));
}
