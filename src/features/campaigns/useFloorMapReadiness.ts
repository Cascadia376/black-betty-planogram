import { useEffect, useState } from "react";

type MapStatus = "missing" | "loading" | "ready" | "error";
interface ImageResult { url: string; attempt: number; status: "ready" | "error" }

/** Verify the actual image bytes independently of cached SVG load events. */
export function useFloorMapReadiness(url: string | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ImageResult>();
  useEffect(() => {
    if (!url) return;
    let active = true;
    let decoding = false;
    const image = new Image();
    const finish = (status: ImageResult["status"]) => {
      if (!active) return;
      active = false;
      window.clearTimeout(timeout);
      setResult({ url, attempt, status });
    };
    const timeout = window.setTimeout(() => finish("error"), 15_000);
    const loaded = () => {
      if (!active || decoding) return;
      if (image.naturalWidth <= 0) { finish("error"); return; }
      decoding = true;
      if (typeof image.decode === "function") {
        void image.decode().then(() => finish("ready"), () => finish("error"));
      } else finish("ready");
    };
    image.onload = loaded;
    image.onerror = () => finish("error");
    image.src = url;
    // Cached images may already be complete before an SVG listener is attached.
    if (image.complete) queueMicrotask(loaded);
    return () => {
      active = false;
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
    };
  }, [url, attempt]);
  const status: MapStatus = !url ? "missing"
    : result?.url === url && result.attempt === attempt ? result.status : "loading";
  return {
    status,
    attempt,
    retry: () => setAttempt((value) => value + 1),
    failed: () => { if (url) setResult({ url, attempt, status: "error" }); },
  };
}
