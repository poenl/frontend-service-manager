import { NextRequest, NextResponse } from "next/server";
import { getServices, addService } from "@/lib/config";

export async function GET() {
  return NextResponse.json(getServices());
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const svc = addService(body);
  return NextResponse.json(svc, { status: 201 });
}
