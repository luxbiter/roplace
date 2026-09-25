"use client";
import { useState, type FormEvent } from "react";
export default function Home() {
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [marketId, setMarketId] = useState("");
  const [checking, setChecking] = useState(false);
  const [inspectMessage, setInspectMessage] = useState("");
  const [found, setFound] = useState<{ meshIds: string[]; textureIds: string[] } | null>(null);
  async function inspect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFound(null);
    if (!/^[1-9]\d{0,18}$/.test(marketId.trim())) { setInspectMessage("Enter a numeric Marketplace asset ID."); return; }
    setChecking(true); setInspectMessage("Looking up IDs…");
    try {
      const response = await fetch(`/api/inspect/${marketId.trim()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not find asset IDs.");
      setFound(data); setInspectMessage("");
    } catch (error) { setInspectMessage(error instanceof Error ? error.message : "Could not find asset IDs."); }
    finally { setChecking(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^[1-9]\d{0,18}$/.test(id.trim())) { setMessage("Enter a numeric asset ID."); return; }
    setBusy(true); setMessage("Fetching file…");
    try {
      const response = await fetch(`/api/asset/${id.trim()}`);
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Download failed."); }
      const blob = await response.blob();
      const extension = response.headers.get("X-Asset-Extension") || "bin";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `${id.trim()}.${extension}`;
      document.body.appendChild(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setMessage(`${id.trim()}.${extension} Download started.`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Download failed."); }
    finally { setBusy(false); }
  }
  return <main className="page"><section className="panel">
    <h1>roplace</h1>
    <div className="tool">
      <h2>Find mesh and texture IDs</h2>
      <form onSubmit={inspect}><label htmlFor="market-id">Marketplace asset ID</label><div className="row">
        <input id="market-id" value={marketId} onChange={e => setMarketId(e.target.value)} inputMode="numeric" placeholder="Item asset ID" autoComplete="off" />
        <button disabled={checking} type="submit">{checking ? "Searching…" : "Find IDs"}</button>
      </div></form>
      <p className="status" role="status" aria-live="polite">{inspectMessage}</p>
      {found && <div className="results">
        <div><strong>Mesh IDs</strong>{found.meshIds.length ? found.meshIds.map(value => <code key={value}>{value}</code>) : <span>None</span>}</div>
        <div><strong>Texture IDs</strong>{found.textureIds.length ? found.textureIds.map(value => <code key={value}>{value}</code>) : <span>None</span>}</div>
      </div>}
      <p className="note">Shows IDs found in public model files. Some items may be unavailable.</p>
    </div>
    <div className="tool lower"><h2>Download original file</h2>
    <p>Enter a mesh or texture ID to download its original file.</p>
    <form onSubmit={submit}><label htmlFor="asset-id">Asset ID</label><div className="row">
      <input id="asset-id" value={id} onChange={e => setId(e.target.value)} inputMode="numeric" placeholder="e.g. 7229442422" autoComplete="off" />
      <button disabled={busy} type="submit">{busy ? "Downloading…" : "Download"}</button>
    </div></form>
    <p className="status" role="status" aria-live="polite">{message}</p>
    <p className="note">Public assets only. Meshes are saved in Roblox format.</p></div>
  </section></main>;
}
