import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { buildStoreExecutionPack, executionMonths, type ExecutionMonth, type ExecutionProduct, type MonthlyOrderProduct } from "../../domain/storeExecutionPack";
import { snapshotForRelease } from "../../domain/campaignReleaseSnapshot";
import type { DisplayArea, PlatformSnapshot, StoreLayout } from "../../domain/types";
import { usePlatform } from "../../services/PlatformProvider";
import "./executionPack.css";

export function StoreExecutionPackPage() {
  const { campaignId = "", storeId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { data, loading, error } = usePlatform();
  const [loadedMap, setLoadedMap] = useState("");
  const releaseId = searchParams.get("release");
  const release = data?.campaignReleases.find((item) => item.id === releaseId && item.campaignId === campaignId);
  const packData = data && (releaseId ? release && snapshotForRelease(data, release) : data);
  const month = parseExecutionMonth(searchParams.get("month"));
  const pack = packData && buildStoreExecutionPack(packData, campaignId, storeId, month);
  const packUrl = (month?: ExecutionMonth) => {
    const params = new URLSearchParams();
    if (releaseId) params.set("release", releaseId);
    if (month) params.set("month", month);
    return `/campaigns/${campaignId}/stores/${storeId}/pack${params.size ? `?${params}` : ""}`;
  };
  if (loading) return <p>Loading store execution pack...</p>;
  if (releaseId && (!release || !packData)) return <main className="execution-pack"><h1>Release copy unavailable</h1><p role="alert">This release does not contain a complete saved manager pack. Current, unpublished changes have not been substituted.</p><Link to={`/campaigns/${campaignId}/review`}>Return to Campaign Review</Link></main>;
  if (!pack || !packData) return <p role="alert">{error || "Campaign or participating store not found."}</p>;
  const ond = pack.campaign.type === "OND";
  const versionLabel = release ? `Release ${release.version}${release.status === "superseded" ? " - SUPERSEDED" : ""}` : "DRAFT - buyer review required";
  return <main className="execution-pack">
    <nav className="pack-controls"><Link to={`/campaigns/${campaignId}/review`}>Campaign Review</Link><div>{ond && executionMonths.map((item) => <Link key={item} to={packUrl(item)}>{monthLabel(item)} order plan</Link>)}<Link to={packUrl()}>Display plan only</Link></div><button disabled={!loadedMap || loadedMap !== pack.layout?.backgroundImageUrl} onClick={() => window.print()}>Print / Save letter-size PDF</button></nav>
    <header><p>Black Betty - {ond ? "OND " : ""}display plan - <strong>{versionLabel}</strong></p><h1>{pack.campaign.name}</h1><h2>{pack.store.name}</h2><p><strong>Campaign dates:</strong> {pack.campaign.startDate} to {pack.campaign.endDate}</p>
      {release ? <p>Saved by {release.publishedBy} on {release.publishedAt}. Instructions, product details and display positions are from this release. Floor map images remain linked to the recorded source URL.</p> : <p>This is a current planning copy, not evidence of approval. Confirm it with the buyer before setup. Unpublished edits can change this copy.</p>}
      {release?.status === "superseded" && <p role="alert">A newer release exists. Do not set up from this superseded copy without buyer confirmation.</p>}
      {ond && <p>This is the store's one stable display plan for the full OND period. Month selection changes the promotional order plan only.</p>}
      <p>Source: {pack.sources.join(", ") || "Manual campaign"}</p><p><strong>{pack.exceptions.length} unresolved exception(s).</strong> Do not guess a missing SKU, location or quantity. Return unresolved instructions to merchandising.</p>
    </header>
    <section className="pack-map-page"><h2>{ond ? "OND " : ""}display floor map</h2><ExecutionMap key={`${releaseId ?? "draft"}:${pack.layout?.backgroundImageUrl}`} data={packData} layout={pack.layout} storeName={pack.store.name} areas={pack.builds.map((item) => item.area)} onLoaded={setLoadedMap} /></section>
    <section className="pack-group"><h2>Display setup instructions</h2>{!pack.builds.length && <p>No confirmed display builds are available for this store.</p>}{pack.builds.map((build) => <article className="pack-build" key={build.id}>
      <p className="pack-page-identity">{pack.store.name} - {pack.campaign.name} - {versionLabel}</p><h3>{build.code} - {build.displayName}</h3><p><strong>Location:</strong> {build.name} ({build.code})</p><p><strong>Set up:</strong> {build.startDate} <strong>End / remove:</strong> {build.endDate}</p><p><strong>Signage:</strong> {build.signage}</p><p><strong>Store instructions:</strong> {build.notes}</p>
      {build.rotatingFlyerSlot && <p className="pack-exception"><strong>Rotating flyer display:</strong> obtain the current approved flyer SKU list for each changeover. This is a display slot, not a product.</p>}
      {build.products.length ? <ProductTable products={build.products} /> : <p role="alert">Products are not confirmed. Do not substitute products without buyer approval.</p>}
      <p>Case quantities are merchandising guidance, not a purchase order. Use minimum facings only where explicitly supplied; a unit-level shelf arrangement has not been assumed.</p>
      <div className="pack-checklist"><strong>Successful setup - check on the printed copy:</strong><p>___ Correct display location and dates &nbsp; ___ Exact SKUs confirmed</p><p>___ Specified facings arranged &nbsp; ___ Signage and prices checked</p><p>___ Display clean and accessible &nbsp; ___ Exceptions reported to merchandising</p><p>Completed by: ____________________ Date: __________</p></div>
      <div className="pack-location"><p>Highlighted location: {build.code}</p><ExecutionMap data={packData} layout={pack.layout} storeName={pack.store.name} areas={[build.area]} /></div>
    </article>)}</section>
    <section className="pack-group"><p className="pack-page-identity">{pack.store.name} - {pack.campaign.name} - {versionLabel}</p><h2>Shelf-supported products</h2><p>Use the product's regular category location; no promotional floor area is assigned.</p>{pack.shelf.length ? <ProductTable products={pack.shelf} /> : <p>No shelf-support items.</p>}</section>
    {ond && month && pack.orderPlan && <section className="pack-group pack-continuation monthly-order-plan"><h2>{monthLabel(month)} OND order plan</h2><p>Promotional case intent is limited to products whose LTO Month includes {monthLabel(month)}. Display placement above remains unchanged. This is not an order submitted to a supplier.</p>{pack.orderPlan.products.length ? <OrderProductTable products={pack.orderPlan.products} /> : <p>No products are campaign-order eligible for {monthLabel(month)}.</p>}</section>}
    <section className="pack-group pack-continuation"><h2>Unresolved exceptions ({pack.exceptions.length})</h2>{pack.exceptions.length ? <><p>Do not execute unresolved instructions. Return these items to merchandising for approval.</p>{pack.exceptions.map((item) => <article className="pack-exception" key={item.id}><h3>{item.kind}</h3><p>{item.message}</p><p><strong>Next action:</strong> {item.action}</p></article>)}</> : <p>No unresolved exceptions in this store plan. This does not record an execution or verification in Black Betty.</p>}</section>
  </main>;
}

function ProductTable({ products }: { products: ExecutionProduct[] }) {
  return <table><thead><tr><th>SKU</th><th>Product / status</th><th>Cases</th><th>Build guidance</th><th>Product execution notes</th></tr></thead><tbody>{products.map((item) => <tr key={item.id}><td>{item.sku}</td><td>{item.name}{item.productResolution !== "MATCHED_ACTIVE" && <p><strong>{item.productResolution === "PENDING" ? "PENDING PRODUCT" : item.productResolution === "MATCHED_INACTIVE" ? "INACTIVE PRODUCT" : "PRODUCT NOT CONFIRMED"}</strong></p>}</td><td><strong>{item.cases ?? "UNRESOLVED"}</strong></td><td>{item.role && <div>{item.role}</div>}<div>Min. facings: {item.minimumFacings ?? "Not specified"}</div></td><td>{item.notes || "None supplied"}</td></tr>)}</tbody></table>;
}

function OrderProductTable({ products }: { products: MonthlyOrderProduct[] }) {
  return <table><thead><tr><th>SKU</th><th>Product</th><th>Cases</th><th>Display context</th><th>Order notes</th></tr></thead><tbody>{products.map((item) => <tr key={item.id}><td>{item.sku}</td><td>{item.name}</td><td><strong>{item.cases ?? "UNRESOLVED"}</strong></td><td>{item.displayContext}</td><td>{item.notes || "None supplied"}</td></tr>)}</tbody></table>;
}

function parseExecutionMonth(value: string | null): ExecutionMonth | undefined {
  return executionMonths.find((month) => month === value?.toUpperCase());
}

function monthLabel(month: ExecutionMonth) {
  return { OCT: "October", NOV: "November", DEC: "December" }[month];
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
