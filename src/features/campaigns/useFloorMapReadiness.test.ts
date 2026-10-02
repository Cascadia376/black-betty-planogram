import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFloorMapReadiness } from "./useFloorMapReadiness";

class ImageStub {
  static instances: ImageStub[] = [];
  static cached = false;
  complete = ImageStub.cached;
  naturalWidth = 1000;
  src = "";
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decode = vi.fn<() => Promise<void>>().mockResolvedValue();
  constructor() { ImageStub.instances.push(this); }
}

beforeEach(() => {
  ImageStub.instances = [];
  ImageStub.cached = false;
  vi.stubGlobal("Image", ImageStub);
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("floor-map print readiness", () => {
  it("accepts an already cached image without relying on SVG load events", async () => {
    ImageStub.cached = true;
    const { result } = renderHook(() => useFloorMapReadiness("/map-a.png"));
    expect(result.current.status).toBe("loading");
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(ImageStub.instances[0].decode).toHaveBeenCalledOnce();
  });

  it("does not allow printing until decoding finishes", async () => {
    const { result } = renderHook(() => useFloorMapReadiness("/map-a.png"));
    let decoded!: () => void;
    ImageStub.instances[0].decode.mockReturnValue(new Promise<void>((resolve) => { decoded = resolve; }));
    act(() => ImageStub.instances[0].onload?.());
    expect(result.current.status).toBe("loading");
    await act(async () => { decoded(); });
    expect(result.current.status).toBe("ready");
  });

  it("ignores a previous store's delayed image and disables readiness immediately on store changes", async () => {
    const { result, rerender } = renderHook(({ url }) => useFloorMapReadiness(url), { initialProps: { url: "/map-a.png" } });
    let oldDecoded!: () => void;
    ImageStub.instances[0].decode.mockReturnValue(new Promise<void>((resolve) => { oldDecoded = resolve; }));
    act(() => ImageStub.instances[0].onload?.());
    rerender({ url: "/map-b.png" });
    await act(async () => { oldDecoded(); });
    expect(result.current.status).toBe("loading");
    await act(async () => ImageStub.instances[1].onload?.());
    expect(result.current.status).toBe("ready");
    rerender({ url: "/map-c.png" });
    expect(result.current.status).toBe("loading");
  });

  it("keeps failed images unprintable and supports an explicit safe retry", async () => {
    const { result } = renderHook(() => useFloorMapReadiness("/map-a.png"));
    act(() => ImageStub.instances[0].onerror?.());
    expect(result.current.status).toBe("error");
    act(() => result.current.retry());
    expect(result.current.status).toBe("loading");
    expect(ImageStub.instances).toHaveLength(2);
    await act(async () => ImageStub.instances[1].onload?.());
    expect(result.current.status).toBe("ready");
    act(() => result.current.failed());
    expect(result.current.status).toBe("error");
  });

  it("does not enable a broken cached image or decode failure", async () => {
    ImageStub.cached = true;
    const { result } = renderHook(() => useFloorMapReadiness("/map-a.png"));
    ImageStub.instances[0].naturalWidth = 0;
    await waitFor(() => expect(result.current.status).toBe("error"));
    act(() => result.current.retry());
    ImageStub.instances[1].decode.mockRejectedValue(new Error("Invalid image"));
    await waitFor(() => expect(result.current.status).toBe("error"));
  });

  it("turns a stalled request into recoverable feedback instead of an indefinitely disabled button", () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useFloorMapReadiness("/map-a.png"));
    act(() => vi.advanceTimersByTime(15_000));
    expect(result.current.status).toBe("error");
  });

  it("does not request a missing map and cancels callbacks on unmount", () => {
    const { result, rerender, unmount } = renderHook(({ url }) => useFloorMapReadiness(url), { initialProps: { url: undefined as string | undefined } });
    expect(result.current.status).toBe("missing");
    expect(ImageStub.instances).toHaveLength(0);
    rerender({ url: "/map-a.png" });
    unmount();
    expect(ImageStub.instances[0].onload).toBeNull();
    expect(ImageStub.instances[0].onerror).toBeNull();
  });
});
