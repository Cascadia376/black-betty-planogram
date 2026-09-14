import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { buildStoreExecutionPack, executionGroup, executionGroups, type ExecutionProduct } from "../../domain/storeExecutionPack";
import type { DisplayArea, PlatformSnapshot, StoreLayout } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";
import "./executionPack.css";

export function StoreExecutionPackPage() {
  const { campaignId = "", storeId = "" } = useParams();
  const { data, loading, error } = usePlatform();
  const [loadedMap, setLoadedMap] = useState("");
  const pack = data && buildStoreExecutionPack(data, campaignId, storeId);
  if (loading) return <p>Loading store execution pack…</p>;
  if (!pack || !data) return <p role="alert">{error || "Campaign or participating store not found."}</p>;
  return <main className="execution-pack">
    <nav className="pack-controls"><Link to={`/campaigns/${campaignId}/review`}>← Campaign Review</Link><button disabled={!loadedMap || loadedMap !== pack.layout?.backgroundImageUrl} onClick={() => window.print()}>Print / Save letter-size PDF</button></nav>
    <header><p>Black Betty · Store execution pack · {pack.exceptions.length ? "DRAFT — unresolved exceptions" : "Reviewed planning copy"}</p><h1>{pack.campaign.name}</h1><h2>{pack.store.name}</h2><p>{pack.campaign.startDate} to {pack.campaign.endDate}</p><p>Planning copy, not a published release. Do not substitute products or locations.</p><p>Source: {pack.sources.join(", ") || "Manual campaign"}</p></header>
    <section className="pack-map-page"><h2>Full floor map</h2><p>Outlined markers identify approved campaign display areas. Suggested areas are not highlighted.</p><ExecutionMap key={pack.layout?.id} data={data} layout={pack.layout} storeName={pack.store.name} areas={pack.builds.map((item) => item.area)} onLoaded={setLoadedMap} /></section>
    {executionGroups.map((group) => {
      const builds = pack.builds.filter((build) => build.products.some((item) => executionGroup(item.category) === group) || (!build.products.length && group === "Category requires review")).map((build) => ({ ...build, products: build.products.filter((item) => executionGroup(item.category) === group) }));
      if (!builds.length) return null;
      return <section key={group} className="pack-group"><h2>{group}</h2>{!builds.length ? <p>No assigned products in this group.</p> : builds.map((build) => <article className="pack-build" key={build.id}>
        <h3>{build.code} · {build.name}</h3><p><strong>Signage:</strong> {build.signage}</p><p><strong>Execution notes:</strong> {build.notes}</p>
        {build.products.length ? <ProductTable products={build.products} /> : <p>No assigned products — do not set up until merchandising confirms the product list.</p>}
        <div className="pack-location"><ExecutionMap data={data} layout={pack.layout} storeName={pack.store.name} areas={[build.area]} /><p>Location reference: {build.code} · {build.name}</p></div>
      </article>)}</section>;
    })}
    <section className="pack-group"><h2>No-display / shelf-support items</h2><p>Keep these products in their regular shelf location; no promotional floor area is assigned.</p>{pack.shelf.length ? <ProductTable products={pack.shelf} /> : <p>No shelf-support items.</p>}</section>
    <section className="pack-group"><h2>Unresolved exceptions ({pack.exceptions.length})</h2>{pack.exceptions.length ? <><p>Do not execute unresolved instructions. Return these items to merchandising for approval.</p>{pack.exceptions.map((item) => <article className="pack-exception" key={item.id}><h3>{item.kind}</h3><p>{item.message}</p><p><strong>Next action:</strong> {item.action}</p></article>)}</> : <p>No unresolved exceptions in this store plan.</p>}</section>
  </main>;
}

function ProductTable({ products }: { products: ExecutionProduct[] }) {
  return <table><thead><tr><th>SKU</th><th>Product</th><th>Cases</th><th>Product execution notes</th></tr></thead><tbody>{products.map((item) => <tr key={item.id}><td>{item.sku}</td><td>{item.name}</td><td><strong>{item.cases ?? "UNRESOLVED"}</strong></td><td>{item.notes || "None supplied"}</td></tr>)}</tbody></table>;
}

/** Uses the original full map and normalized source geometry, including split areas. */
function ExecutionMap({ data, layout, storeName, areas, onLoaded }: { data: PlatformSnapshot; layout?: StoreLayout; storeName: string; areas: DisplayArea[]; onLoaded?(url: string): void }) {
  const [failed, setFailed] = useState(false);
  if (!layout?.backgroundImageUrl || failed) return <p role="alert">Floor map unavailable — do not use this pack for location instructions.</p>;
  const height = 1000 / (layout.backgroundAspectRatio ?? 4 / 3);
  const markers = areas.flatMap((area) => [{ key: area.id, area, geometry: area.geometry }, ...data.displayAreaSections.filter((item) => item.displayAreaId === area.id).map((item) => ({ key: item.id, area, geometry: item.geometry }))]);
  return <svg role="img" aria-label={`${storeName} full floor map with ${areas.length} campaign displays highlighted`} viewBox={`0 0 1000 ${height}`}>
    <image href={layout.backgroundImageUrl} width="1000" height={height} onLoad={() => onLoaded?.(layout.backgroundImageUrl!)} onError={() => { setFailed(true); onLoaded?.(""); }} />
    {markers.map(({ key, area, geometry: g }) => <g key={key} transform={g.rotation ? `rotate(${g.rotation} ${(g.x + g.width / 2) * 1000} ${(g.y + g.height / 2) * height})` : undefined}>
      <rect x={g.x * 1000} y={g.y * height} width={g.width * 1000} height={g.height * height} fill="#6f1d36" fillOpacity="0.16" stroke="#6f1d36" strokeWidth="4" />
      <text x={(g.x + g.width / 2) * 1000} y={(g.y + g.height / 2) * height} textAnchor="middle" dominantBaseline="middle" fontSize="16" fontWeight="bold" fill="#111" stroke="white" strokeWidth="4" paintOrder="stroke">{area.localCode ?? area.displayNumber}</text>
    </g>)}
  </svg>;
}
