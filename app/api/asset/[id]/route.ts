import { NextRequest, NextResponse } from "next/server";
export const runtime = "edge";
const MAX = 25 * 1024 * 1024;
function error(message: string, status: number) { return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } }); }
function allowed(url: string) {
  try { const u = new URL(url); return u.protocol === "https:" && !u.username && !u.password &&
    (u.hostname === "rbxcdn.com" || u.hostname.endsWith(".rbxcdn.com") || u.hostname === "roblox.com" || u.hostname.endsWith(".roblox.com")); }
  catch { return false; }
}
function extension(bytes: Uint8Array) {
  const prefix = new TextDecoder().decode(bytes.slice(0, 80));
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return "png";
  if (bytes[0] === 255 && bytes[1] === 216) return "jpg";
  if (prefix.startsWith("RIFF") && prefix.slice(8, 12) === "WEBP") return "webp";
  if (prefix.startsWith("GIF8")) return "gif";
  if (prefix.startsWith("<roblox!")) return "rbxm";
  if (prefix.startsWith("<roblox") || prefix.startsWith("<?xml")) return "rbxmx";
  if (prefix.startsWith("version ") && prefix.slice(0, 64).toLowerCase().includes("mesh")) return "mesh";
  if (prefix.startsWith("OggS")) return "ogg";
  if (prefix.startsWith("ID3")) return "mp3";
  return "bin";
}
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[1-9]\d{0,18}$/.test(id)) return error("Enter a valid asset ID.", 400);
  try {
    const metadata = await fetch(`https://assetdelivery.roblox.com/v2/assetId/${id}`, { cache: "no-store", signal: AbortSignal.timeout(12000) });
    if (!metadata.ok) return error(`Roblox rejected the asset request (HTTP ${metadata.status}).`, metadata.status === 404 ? 404 : 502);
    const json = await metadata.json() as { locations?: Array<{ location?: string }> };
    const url = json.locations?.map(x => x.location).find((x): x is string => typeof x === "string" && allowed(x));
    if (!url) return error("No download location. Check the asset ID and access.", 404);
    const asset = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(20000) });
    if (!asset.ok || !allowed(asset.url)) return error("Could not fetch the file.", 502);
    if (Number(asset.headers.get("content-length")) > MAX) return error("Files over 25 MB are not supported.", 413);
    const data = await asset.arrayBuffer();
    if (data.byteLength > MAX) return error("Files over 25 MB are not supported.", 413);
    const ext = extension(new Uint8Array(data));
    return new Response(data, { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${id}.${ext}"`, "X-Asset-Extension": ext, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return error("Could not reach Roblox. Please try again later.", 502); }
}
