import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Paper } from "../../api";
import { PAPER_QUEUE_CACHE_KEY } from "../../lib/storageKeys";

vi.mock("../../api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
  api: {
    getNextPaper: vi.fn(),
  },
}));

function createLocalStorageMock() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key);
    }),
    clear: vi.fn(() => {
      store.clear();
    }),
    get length() {
      return store.size;
    },
    key: vi.fn((index: number) => {
      const keys = [...store.keys()];
      return keys[index] ?? null;
    }),
  };
}

let storageMock: ReturnType<typeof createLocalStorageMock>;

function makePaper(overrides: Partial<Paper> = {}): Paper {
  return {
    id: 1,
    conference_name: "NeurIPS",
    year: 2025,
    title: "Test Paper",
    url: "https://example.com",
    authors: "Author A",
    abstract_text: "Abstract",
    ...overrides,
  };
}

let usePaperQueue: typeof import("../usePaperQueue").usePaperQueue;
let getNextPaper: ReturnType<typeof vi.fn>;

async function loadModule() {
  const hookModule = await import("../usePaperQueue");
  const apiModule = await import("../../api");
  usePaperQueue = hookModule.usePaperQueue;
  getNextPaper = vi.mocked(apiModule.api.getNextPaper);
}

async function flushAsync() {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
}

describe("usePaperQueue", () => {
  beforeEach(() => {
    storageMock = createLocalStorageMock();
    vi.stubGlobal("localStorage", storageMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe("initialization", () => {
    beforeEach(async () => {
      vi.resetModules();
      await loadModule();
    });

    it("fetches one paper on mount, transitions loading -> ready", async () => {
      const paper1 = makePaper({ id: 1 });
      getNextPaper.mockResolvedValueOnce(paper1);

      const { result } = renderHook(() => usePaperQueue(null));

      expect(result.current.isLoading).toBe(true);
      expect(result.current.paper).toBeNull();

      await waitFor(() => {
        expect(result.current.paper).toEqual(paper1);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.allDone).toBe(false);
      expect(getNextPaper).toHaveBeenCalledTimes(1);
    });

    it("shows allDone when API returns 404 on first fetch", async () => {
      const { ApiError } = await import("../../api");
      getNextPaper.mockRejectedValueOnce(new ApiError(404, "Not found"));

      const { result } = renderHook(() => usePaperQueue(null));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.paper).toBeNull();
      expect(result.current.allDone).toBe(true);
      expect(result.current.error).toBeNull();
    });

    it("sets error state on non-404 API error", async () => {
      getNextPaper.mockRejectedValueOnce(new Error("Network error"));

      const { result } = renderHook(() => usePaperQueue(null));

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.error?.message).toBe("Network error");
    });

    it("restores from localStorage cache on mount without API call", async () => {
      const paper = makePaper({ id: 10 });
      const cacheData = { current: paper, allDone: false };
      storageMock.setItem(PAPER_QUEUE_CACHE_KEY, JSON.stringify(cacheData));

      vi.resetModules();
      await loadModule();

      const { result } = renderHook(() => usePaperQueue(null));

      expect(result.current.paper).toEqual(paper);
      expect(result.current.isLoading).toBe(false);
      expect(getNextPaper).not.toHaveBeenCalled();
    });

    it("ignores legacy `next` field in cache payload", async () => {
      const paper = makePaper({ id: 10 });
      const legacyCache = { current: paper, next: makePaper({ id: 11 }), allDone: false };
      storageMock.setItem(PAPER_QUEUE_CACHE_KEY, JSON.stringify(legacyCache));

      vi.resetModules();
      await loadModule();

      const { result } = renderHook(() => usePaperQueue(null));

      expect(result.current.paper).toEqual(paper);
      expect(result.current.isLoading).toBe(false);
      expect(getNextPaper).not.toHaveBeenCalled();
    });
  });

  describe("advance()", () => {
    beforeEach(async () => {
      vi.resetModules();
      await loadModule();
    });

    it("passes [dismissedId] as exclude_ids when fetching after advance", async () => {
      const paper1 = makePaper({ id: 1 });
      const paper2 = makePaper({ id: 2, title: "Paper 2" });
      getNextPaper.mockResolvedValueOnce(paper1).mockResolvedValueOnce(paper2);

      const { result } = renderHook(() => usePaperQueue(null));

      await waitFor(() => {
        expect(result.current.paper).toEqual(paper1);
      });

      act(() => {
        result.current.advance(paper1.id);
      });

      await waitFor(() => {
        expect(result.current.paper).toEqual(paper2);
      });

      expect(getNextPaper).toHaveBeenNthCalledWith(2, { exclude_ids: [paper1.id] });
    });

    it("clears current, fetches next paper, and applies result", async () => {
      const paper1 = makePaper({ id: 1 });
      const paper2 = makePaper({ id: 2, title: "Paper 2" });
      getNextPaper.mockResolvedValueOnce(paper1).mockResolvedValueOnce(paper2);

      const { result } = renderHook(() => usePaperQueue(null));

      await waitFor(() => {
        expect(result.current.paper).toEqual(paper1);
      });

      act(() => {
        result.current.advance(paper1.id);
      });

      expect(result.current.paper).toBeNull();
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.paper).toEqual(paper2);
      });

      expect(result.current.isLoading).toBe(false);
      expect(getNextPaper).toHaveBeenCalledTimes(2);
    });

    it("marks allDone when fetch returns 404 after advance", async () => {
      const paper1 = makePaper({ id: 1 });
      const { ApiError } = await import("../../api");
      getNextPaper
        .mockResolvedValueOnce(paper1)
        .mockRejectedValueOnce(new ApiError(404, "Not found"));

      const { result } = renderHook(() => usePaperQueue(null));

      await waitFor(() => {
        expect(result.current.paper).toEqual(paper1);
      });

      act(() => {
        result.current.advance(paper1.id);
      });

      await waitFor(() => {
        expect(result.current.allDone).toBe(true);
      });

      expect(result.current.paper).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe("filter changes", () => {
    beforeEach(async () => {
      vi.resetModules();
      await loadModule();
    });

    it("reloads when filter changes and cached paper doesn't match", async () => {
      const paper1 = makePaper({ id: 1, conference_name: "NeurIPS", year: 2025 });
      const paper2 = makePaper({ id: 2, conference_name: "ICML", year: 2024 });

      getNextPaper.mockResolvedValueOnce(paper1).mockResolvedValueOnce(paper2);

      type CF = import("../../context/ConferenceFilterContext").ConferenceFilter | null;
      const { result, rerender } = renderHook(
        ({ filter }: { filter: CF }) => usePaperQueue(filter),
        { initialProps: { filter: null as CF } },
      );

      await waitFor(() => {
        expect(result.current.paper).toEqual(paper1);
      });

      rerender({ filter: { conference: "ICML", year: "2024" } });

      await waitFor(() => {
        expect(result.current.paper).toEqual(paper2);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("skips reload when cached paper matches the new filter", async () => {
      const paper1 = makePaper({ id: 1, conference_name: "NeurIPS", year: 2025 });
      getNextPaper.mockResolvedValueOnce(paper1);

      type CF = import("../../context/ConferenceFilterContext").ConferenceFilter | null;
      const { result, rerender } = renderHook(
        ({ filter }: { filter: CF }) => usePaperQueue(filter),
        { initialProps: { filter: null as CF } },
      );

      await waitFor(() => {
        expect(result.current.paper).toEqual(paper1);
      });

      const callCountBefore = getNextPaper.mock.calls.length;

      rerender({ filter: { conference: "NeurIPS", year: "2025" } });

      await flushAsync();

      expect(result.current.paper).toEqual(paper1);
      expect(getNextPaper.mock.calls.length).toBe(callCountBefore);
    });
  });

  describe("stale request discarding", () => {
    beforeEach(async () => {
      vi.resetModules();
      await loadModule();
    });

    it("discards stale fetch when filter changes during in-flight fetch", async () => {
      const stalePaper = makePaper({ id: 90, conference_name: "NeurIPS", year: 2025 });
      const freshPaper = makePaper({ id: 91, conference_name: "ICML", year: 2024 });

      let resolveFirst: (v: Paper) => void = () => {};
      const firstPromise = new Promise<Paper>((r) => {
        resolveFirst = r;
      });

      getNextPaper.mockReturnValueOnce(firstPromise).mockResolvedValueOnce(freshPaper);

      type CF = import("../../context/ConferenceFilterContext").ConferenceFilter | null;
      const { result, rerender } = renderHook(
        ({ filter }: { filter: CF }) => usePaperQueue(filter),
        { initialProps: { filter: null as CF } },
      );

      rerender({ filter: { conference: "ICML", year: "2024" } });

      await act(async () => {
        resolveFirst(stalePaper);
      });

      await waitFor(() => {
        expect(result.current.paper).toEqual(freshPaper);
      });

      expect(result.current.paper).not.toEqual(stalePaper);
    });
  });

  describe("cache persistence", () => {
    beforeEach(async () => {
      vi.resetModules();
      await loadModule();
    });

    it("saves { current, allDone } after fetching", async () => {
      const paper1 = makePaper({ id: 1 });
      getNextPaper.mockResolvedValueOnce(paper1);

      renderHook(() => usePaperQueue(null));

      await waitFor(() => {
        const raw = storageMock.getItem(PAPER_QUEUE_CACHE_KEY);
        expect(raw).not.toBeNull();
        const cached = JSON.parse(raw as string);
        expect(cached.current).toEqual(paper1);
      });

      const raw = storageMock.getItem(PAPER_QUEUE_CACHE_KEY);
      const cached = JSON.parse(raw as string);
      expect(cached.current).toEqual(paper1);
      expect(cached.allDone).toBe(false);
      expect(cached.next).toBeUndefined();
    });

    it("saves { current: null, allDone: true } after all papers consumed", async () => {
      const paper1 = makePaper({ id: 1 });
      const { ApiError } = await import("../../api");
      getNextPaper
        .mockResolvedValueOnce(paper1)
        .mockRejectedValueOnce(new ApiError(404, "Not found"));

      const { result } = renderHook(() => usePaperQueue(null));

      await waitFor(() => {
        expect(result.current.paper).toEqual(paper1);
      });

      act(() => {
        result.current.advance(paper1.id);
      });

      await waitFor(() => {
        expect(result.current.allDone).toBe(true);
      });

      const raw = storageMock.getItem(PAPER_QUEUE_CACHE_KEY);
      const cached = JSON.parse(raw as string);
      expect(cached.current).toBeNull();
      expect(cached.allDone).toBe(true);
    });
  });
});
