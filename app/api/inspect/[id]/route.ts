import { NextRequest, NextResponse } from "next/server";
import { extractAssetIds } from "@/lib/asset-ids";
export const runtime = "edge";
const MAX = 25 * 1024 * 1024;
const fail = (error: string, status = 502) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
function allowed(url: string) {
  try { const u = new URL(url); return u.protocol === "https:" && !u.username && !u.password &&
    (u.hostname === "rbxcdn.com" || u.hostname.endsWith(".rbxcdn.com") || u.hostname === "roblox.com" || u.hostname.endsWith(".roblox.com")); }
  catch { return false; }
}
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[1-9]\d{0,18}$/.test(id)) return fail("Enter a valid Marketplace asset ID.", 400);
  try {
    const metadata = await fetch(`https://assetdelivery.roblox.com/v2/assetId/${id}`, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!metadata.ok) return fail(`Roblox rejected the request (HTTP ${metadata.status}).`, metadata.status === 404 ? 404 : 502);
    const json = await metadata.json() as { locations?: Array<{ location?: string }> };
    const url = json.locations?.map(x => x.location).find((x): x is string => typeof x === "string" && allowed(x));
    if (!url) return fail("Public asset unavailable.", 404);
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!response.ok || !allowed(response.url)) return fail("Could not fetch the model file.");
    if (Number(response.headers.get("content-length")) > MAX) return fail("Assets over 25 MB cannot be inspected.", 413);
    const data = await response.arrayBuffer();
    if (data.byteLength > MAX) return fail("Assets over 25 MB cannot be inspected.", 413);
    try { return NextResponse.json(extractAssetIds(new Uint8Array(data)), { headers: { "Cache-Control": "no-store" } }); }
    catch (e) { return fail(e instanceof Error ? e.message : "Could not inspect this asset.", 422); }
  } catch { return fail("Could not reach Roblox. Please try again later."); }
}
