import { ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge, Card, DataState, EmptyState, PageHeader } from "../../components/ui";
import { usePlatform } from "../../services/PlatformProvider";
import { storePhysicalCoverage } from "./storeCoverage";

export function StoreDirectoryPage() {
  const { data, loading, error } = usePlatform();
  const coverage = data ? storePhysicalCoverage(data) : [];

  return (
    <DataState loading={loading} error={error}>
      {!data ? <EmptyState title="Stores unavailable" message="Store coverage could not be loaded." /> : (
        <div className="space-y-5">
          <PageHeader
            eyebrow="Stores"
            title="Physical store network"
            description="Browse current store floorplans and source-backed promotional display coverage."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {coverage.map((item) => (
              <Card key={item.store.id} className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{item.store.name}</h2>
                    <p className="mt-1 text-xs text-text-muted">{item.store.code} · {item.store.address}</p>
                  </div>
                  <Badge tone={item.hasCurrentLayout ? "success" : "warning"}>
                    {item.hasCurrentLayout ? "Current layout" : "No current layout"}
                  </Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div><dt className="text-xs text-text-muted">Category spaces</dt><dd className="mt-1 font-semibold">{item.mappedCategorySpaceCount} mapped / {item.categorySpaceCount}</dd></div>
                  <div><dt className="text-xs text-text-muted">Display areas</dt><dd className="mt-1 font-semibold">{item.activeDisplayAreaCount} active</dd></div>
                  <div><dt className="text-xs text-text-muted">Verified</dt><dd className="mt-1 font-semibold text-success">{item.verifiedDisplayAreaCount}</dd></div>
                  <div><dt className="text-xs text-text-muted">Needs verification</dt><dd className="mt-1 font-semibold">{item.unverifiedDisplayAreaCount}</dd></div>
                </dl>
                {item.activeDisplayAreaCount === 0 && (
                  <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-text-secondary">
                    No promotional display areas have been verified for this store yet.
                  </p>
                )}
                {item.unverifiedDisplayAreaCount > 0 && (
                  <p className="mt-3 text-xs text-text-muted">Unverified records are inactive historical locations and are not available for new campaign placement.</p>
                )}
                <div className="mt-auto flex gap-2 pt-5">
                  {item.hasCurrentLayout ? (
                    <Link className="inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" to={`/stores/${item.store.id}/floorplan`}>
                      <MapPin className="h-4 w-4" />View floorplan
                    </Link>
                  ) : <span className="inline-flex min-h-9 flex-1 items-center justify-center rounded-md border border-border px-3 text-sm text-text-muted">Floorplan unavailable</span>}
                  <Link className="inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-border px-3 text-sm font-semibold hover:bg-subtle" to={`/stores/${item.store.id}/workspace`}>
                    Workspace <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </DataState>
  );
}
