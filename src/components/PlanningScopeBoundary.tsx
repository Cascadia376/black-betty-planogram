import type { ReactNode } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { usePlatform } from "../services/PlatformProvider";
import { Card } from "./ui";

/** Prototype routes are available only in isolated demo mode, never as live operations. */
export function PlanningScopeBoundary({ children }: { children: ReactNode }) {
  const { authEnabled } = usePlatform();
  if (!authEnabled) return children;
  return <Card><h1 className="text-xl font-semibold">This workflow is not live</h1><p className="my-3">Shared Black Betty supports campaign planning, store placement, floorplan editing and printable store instructions. Ordering, store execution tracking, supplier proposals and performance measurement are not connected yet. No action was taken.</p><Link className="font-semibold text-primary" to="/campaigns">Return to campaigns</Link></Card>;
}

export function PlanningHome({ children }: { children: ReactNode }) {
  const { authEnabled } = usePlatform();
  return authEnabled ? <Navigate to="/campaigns" replace /> : children;
}

export function StorePlanningHome({ children }: { children: ReactNode }) {
  const { authEnabled } = usePlatform();
  const { storeId } = useParams();
  return authEnabled ? <Navigate to={`/stores/${storeId}/floorplan`} replace /> : children;
}
