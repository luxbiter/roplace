import { decompress as zstdDecompress } from "fzstd";

const LIMIT = 25 * 1024 * 1024;
const MESH = new Set(["MeshId", "MeshID", "CageMeshId", "ReferenceMeshId"]);
const TEXTURE = new Set(["TextureId", "TextureID", "Texture", "ColorMap", "ColorMapContent", "NormalMap", "MetalnessMap", "RoughnessMap", "ShirtTemplate", "PantsTemplate", "Graphic"]);
const URI = /(?:rbxassetid:\/\/|(?:[?&]|&amp;)id=)(\d{1,19})/gi;

function idValues(value: string) {
  const ids: string[] = [];
  for (const match of value.matchAll(URI)) ids.push(match[1]);
  return ids;
}
function add(result: { meshIds: Set<string>; textureIds: Set<string> }, name: string, text: string) {
  const target = MESH.has(name) ? result.meshIds : TEXTURE.has(name) ? result.textureIds : null;
  if (target) for (const id of idValues(text)) target.add(id);
}
function uint32(bytes: Uint8Array, index: number) {
  if (index + 4 > bytes.length) throw new Error("Model file is damaged.");
  return new DataView(bytes.buffer, bytes.byteOffset + index, 4).getUint32(0, true);
}
function readString(bytes: Uint8Array, index: number): [string, number] {
  const length = uint32(bytes, index);
  if (length > bytes.length - index - 4) throw new Error("Model file is damaged.");
  return [new TextDecoder().decode(bytes.subarray(index + 4, index + 4 + length)), index + 4 + length];
}
function lz4(source: Uint8Array, size: number) {
  const output = new Uint8Array(size);
  let p = 0, q = 0;
  while (p < source.length) {
    const token = source[p++];
    let literals = token >> 4;
    if (literals === 15) { let n; do { if (p >= source.length) throw Error("Invalid LZ4 data"); n = source[p++]; literals += n; } while (n === 255); }
    if (p + literals > source.length || q + literals > size) throw Error("Invalid LZ4 data");
    output.set(source.subarray(p, p + literals), q); p += literals; q += literals;
    if (p === source.length) break;
    if (p + 2 > source.length) throw Error("Invalid LZ4 data");
    const offset = source[p] | (source[p + 1] << 8); p += 2;
    if (offset < 1 || offset > q) throw Error("Invalid LZ4 data");
    let count = (token & 15) + 4;
    if ((token & 15) === 15) { let n; do { if (p >= source.length) throw Error("Invalid LZ4 data"); n = source[p++]; count += n; } while (n === 255); }
    if (q + count > size) throw Error("Invalid LZ4 data");
    for (let i = 0; i < count; i++) output[q + i] = output[q + i - offset];
    q += count;
  }
  if (q !== size) throw Error("Invalid LZ4 length");
  return output;
}
function binaryIds(bytes: Uint8Array, result: { meshIds: Set<string>; textureIds: Set<string> }) {
  if (bytes.length < 32) throw Error("Model file is damaged.");
  let position = 32, total = 0;
  while (position + 16 <= bytes.length) {
    const name = new TextDecoder().decode(bytes.subarray(position, position + 4));
    const compressed = uint32(bytes, position + 4);
    const expanded = uint32(bytes, position + 8);
    const length = compressed || expanded;
    position += 16;
    if (length > bytes.length - position || expanded > LIMIT || total + expanded > LIMIT) throw Error("Model file is too large or damaged.");
    if (name === "END\0") break;
    if (name === "PROP") {
      const raw = bytes.subarray(position, position + length);
      const chunk = compressed ? (raw[0] === 0x28 && raw[1] === 0xb5 && raw[2] === 0x2f && raw[3] === 0xfd ? zstdDecompress(raw) : lz4(raw, expanded)) : raw;
      if (chunk.length !== expanded) throw Error("Invalid model data length.");
      const [property, cursor] = readString(chunk, 4);
      if (MESH.has(property) || TEXTURE.has(property)) {
        const type = chunk[cursor];
        if (type === 1) {
          let i = cursor + 1;
          while (i < chunk.length) { const [value, next] = readString(chunk, i); add(result, property, value); i = next; }
        } else if (type === 0x22) {
          // Content URI values live inside this property chunk; avoid scanning unrelated properties.
          add(result, property, new TextDecoder().decode(chunk.subarray(cursor + 1)));
        }
      }
    }
    total += expanded;
    position += length;
  }
}
export function extractAssetIds(bytes: Uint8Array) {
  const result = { meshIds: new Set<string>(), textureIds: new Set<string>() };
  const header = new TextDecoder().decode(bytes.subarray(0, 8));
  if (header === "<roblox!") {
    binaryIds(bytes, result);
  } else if (header.startsWith("<roblox") || header.startsWith("<?xml")) {
    const xml = new TextDecoder().decode(bytes);
    const properties = /<(\w+)\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/\1>/gi;
    for (const match of xml.matchAll(properties)) add(result, match[2], match[3]);
  } else throw Error("This asset is not a supported model.");
  return { meshIds: [...result.meshIds], textureIds: [...result.textureIds] };
}
