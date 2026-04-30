import { NextResponse } from "next/server";
import { buildUserscript } from "@/lib/armory-gear-client-scripts";

export async function GET(): Promise<NextResponse> {
  return new NextResponse(buildUserscript(), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
