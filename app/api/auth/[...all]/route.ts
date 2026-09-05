import { handleAdminAuth } from "@/lib/admin-auth-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleAdminAuth(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleAdminAuth(request);
}
