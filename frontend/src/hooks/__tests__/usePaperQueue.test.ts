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

// Create a simple in-memory localStorage mock
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

/** Flush all pending microtasks so async state updates land. */
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

    it("fetches current + next paper on mount, transitions loading -> ready", async () => {
      const paper1 = makePaper({ id: 1 });
      const paper2 = makePaper({ id: 2, title: "Paper 2" });
      getNextPaper.mockResolvedValueOnce(paper1).mockResolvedValueOnce(paper2);

      const { result } = renderHook(() => usePaperQueue(null));

      // Initially loading
      expect(result.current.isLoading).toBe(true);
      expect(result.current.paper).toBeNull();

      // Wait for async fetches to complete and state to update
      await waitFor(() => {
        expect(result.current.paper).toEqual(paper1);
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.allDone).toBe(false);
      expect(getNextPaper).toHaveBeenCalledTimes(2);
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
      const cacheData = { current: paper, next: null, allDone: false };
      storageMock.setItem(PAPER_QUEUE_CACHE_KEY, JSON.stringify(cacheData));

      // Re-import so module-level loadCache() reads the localStorage
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

    it("promotes prefetched paper and starts background prefetch", async () => {
      const paper1 = makePaper({ id: 1 });
      const paper2 = makePaper({ id: 2, title: "Paper 2" });
      const paper3 = makePaper({ id: 3, title: "Paper 3" });

      getNextPaper
        .mockResolvedValueOnce(paper1)
        .mockResolvedValueOnce(paper2)
        .mockResolvedValueOnce(paper3);

      const { result } = renderHook(() => usePaperQueue(null));

      // Wait for initial load (both current + next)
      await waitFor(() => {
        expect(getNextPaper).toHaveBeenCalledTimes(2);
      });

      expect(result.current.paper).toEqual(paper1);

      // Advance to paper2
      act(() => {
        result.current.advance();
      });

      expect(result.current.paper).toEqual(paper2);

      // Wait for background prefetch
      await waitFor(() => {
        expect(getNextPaper).toHaveBeenCalledTimes(3);
      });
    });

    it("surfaces allDone when no prefetch and allDone is true", async () => {
      const paper = makePaper({ id: 1 });
      const cacheData = { current: paper, next: null, allDone: true };
      storageMock.setItem(PAPER_QUEUE_CACHE_KEY, JSON.stringify(cacheData));

      vi.resetModules();
      await loadModule();

      const { result } = renderHook(() => usePaperQueue(null));

      expect(result.current.paper).toEqual(paper);
      expect(result.current.allDone).toBe(false);

      act(() => {
        result.current.advance();
      });

      expect(result.current.paper).toBeNull();
      expect(result.current.allDone).toBe(true);
      expect(getNextPaper).not.toHaveBeenCalled();
    });

    it("reloads pair when no prefetch and not allDone", async () => {
      const paper1 = makePaper({ id: 1 });
      const cacheData = { current: paper1, next: null, allDone: false };
      storageMock.setItem(PAPER_QUEUE_CACHE_KEY, JSON.stringify(cacheData));

      vi.resetModules();
      await loadModule();

      const paper2 = makePaper({ id: 2, title: "Reloaded" });
      const paper3 = makePaper({ id: 3, title: "Next reloaded" });
      getNextPaper.mockResolvedValueOnce(paper2).mockResolvedValueOnce(paper3);

      const { result } = renderHook(() => usePaperQueue(null));

      expect(result.current.paper).toEqual(paper1);

      act(() => {
        result.current.advance();
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.paper).toEqual(paper2);
      });

      expect(result.current.isLoading).toBe(false);
      expect(getNextPaper).toHaveBeenCalledTimes(2);
    });
  });

  describe("filter changes", () => {
    beforeEach(async () => {
      vi.resetModules();
      await loadModule();
    });

    it("reloads when filter changes and cached papers don't match", async () => {
      const paper1 = makePaper({ id: 1, conference_name: "NeurIPS", year: 2025 });
      const paper2 = makePaper({ id: 2, conference_name: "NeurIPS", year: 2025 });
      const paper3 = makePaper({ id: 3, conference_name: "ICML", year: 2024 });
      const paper4 = makePaper({ id: 4, conference_name: "ICML", year: 2024 });

      getNextPaper
        .mockResolvedValueOnce(paper1)
        .mockResolvedValueOnce(paper2)
        .mockResolvedValueOnce(paper3)
        .mockResolvedValueOnce(paper4);

      type CF = import("../../context/ConferenceFilterContext").ConferenceFilter | null;
      const { result, rerender } = renderHook(
        ({ filter }: { filter: CF }) => usePaperQueue(filter),
        { initialProps: { filter: null as CF } },
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.paper).toEqual(paper1);
      });

      // Change filter to ICML — papers don't match, should reload
      rerender({ filter: { conference: "ICML", year: "2024" } });

      await waitFor(() => {
        expect(result.current.paper).toEqual(paper3);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it("skips reload when cached papers match the new filter", async () => {
      const paper1 = makePaper({ id: 1, conference_name: "NeurIPS", year: 2025 });
      const paper2 = makePaper({ id: 2, conference_name: "NeurIPS", year: 2025 });

      getNextPaper.mockResolvedValueOnce(paper1).mockResolvedValueOnce(paper2);

      type CF = import("../../context/ConferenceFilterContext").ConferenceFilter | null;
      const { result, rerender } = renderHook(
        ({ filter }: { filter: CF }) => usePaperQueue(filter),
        { initialProps: { filter: null as CF } },
      );

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.paper).toEqual(paper1);
      });

      const callCountBefore = getNextPaper.mock.calls.length;

      // Change filter to NeurIPS 2025 — papers already match, should skip reload
      rerender({ filter: { conference: "NeurIPS", year: "2025" } });

      // Give it a tick to ensure no new calls are made
      await flushAsync();

      expect(result.current.paper).toEqual(paper1);
      expect(getNextPaper.mock.calls.length).toBe(callCountBefore);
    });
  });

  describe("dedup retry logic", () => {
    beforeEach(async () => {
      vi.resetModules();
      await loadModule();
    });

    it("retries up to MAX_DEDUP_RETRIES when same ID is returned, then returns null for next", async () => {
      const paper1 = makePaper({ id: 1 });

      // Initial fetch returns paper1, then dedup fetches keep returning paper1 (same ID)
      // fetchDedupedPaper calls fetchPaper 3 times (i=0,1,2 since loop is i < MAX_DEDUP_RETRIES)
      getNextPaper
        .mockResolvedValueOnce(paper1) // loadPair: first (current)
        .mockResolvedValueOnce(paper1) // fetchDedupedPaper attempt 0
        .mockResolvedValueOnce(paper1) // fetchDedupedPaper attempt 1
        .mockResolvedValueOnce(paper1); // fetchDedupedPaper attempt 2

      const { result } = renderHook(() => usePaperQueue(null));

      await waitFor(() => {
        expect(result.current.paper).toEqual(paper1);
      });

      // 1 (initial) + 3 (dedup attempts: i=0,1,2 since loop is i < MAX_DEDUP_RETRIES)
      await waitFor(() => {
        expect(getNextPaper).toHaveBeenCalledTimes(4);
      });

      // next was null (all retries returned same ID), so noMorePapers is true internally
      // but allDone only surfaces when current is also null
      expect(result.current.allDone).toBe(false); // current still shown
      expect(result.current.paper).toEqual(paper1);
    });

    it("returns different paper when dedup succeeds on retry", async () => {
      const paper1 = makePaper({ id: 1 });
      const paper2 = makePaper({ id: 2, title: "Different" });

      getNextPaper
        .mockResolvedValueOnce(paper1) // loadPair: first (current)
        .mockResolvedValueOnce(paper1) // fetchDedupedPaper retry 0: same ID
        .mockResolvedValueOnce(paper2); // fetchDedupedPaper retry 1: different ID — success

      const { result } = renderHook(() => usePaperQueue(null));

      await waitFor(() => {
        expect(getNextPaper).toHaveBeenCalledTimes(3);
      });

      expect(result.current.paper).toEqual(paper1);
      expect(result.current.allDone).toBe(false);

      // Advance should promote paper2
      act(() => {
        result.current.advance();
      });

      expect(result.current.paper).toEqual(paper2);
    });
  });

  describe("stale request discarding", () => {
    beforeEach(async () => {
      vi.resetModules();
      await loadModule();
    });

    it("discards stale fetch when advance() is called during in-flight loadPair", async () => {
      const paper1 = makePaper({ id: 1 });
      const cacheData = { current: paper1, next: null, allDone: false };
      storageMock.setItem(PAPER_QUEUE_CACHE_KEY, JSON.stringify(cacheData));

      vi.resetModules();
      await loadModule();

      // advance() with no prefetch and not allDone triggers loadPair
      // Then a second advance() triggers another loadPair, invalidating the first
      const stalePaper = makePaper({ id: 90, title: "Stale" });
      const freshPaper = makePaper({ id: 91, title: "Fresh" });

      let resolveFirst: (v: Paper) => void = () => {};
      const firstPromise = new Promise<Paper>((r) => {
        resolveFirst = r;
      });

      getNextPaper
        .mockReturnValueOnce(firstPromise) // first loadPair (will become stale)
        .mockResolvedValueOnce(freshPaper) // second loadPair: current
        .mockResolvedValueOnce(freshPaper); // second loadPair: next (dedup)

      const { result } = renderHook(() => usePaperQueue(null));

      // First advance triggers loadPair
      act(() => {
        result.current.advance();
      });

      // Second advance triggers another loadPair, bumping generation
      act(() => {
        result.current.advance();
      });

      // Resolve the stale first promise — should be ignored
      await act(async () => {
        resolveFirst(stalePaper);
      });

      await waitFor(() => {
        expect(result.current.paper).toEqual(freshPaper);
      });

      // Stale paper should never appear
      expect(result.current.paper).not.toEqual(stalePaper);
    });
  });

  describe("cache persistence", () => {
    beforeEach(async () => {
      vi.resetModules();
      await loadModule();
    });

    it("saves state to localStorage after fetching papers", async () => {
      const paper1 = makePaper({ id: 1 });
      const paper2 = makePaper({ id: 2, title: "Paper 2" });
      getNextPaper.mockResolvedValueOnce(paper1).mockResolvedValueOnce(paper2);

      renderHook(() => usePaperQueue(null));

      await waitFor(() => {
        const raw = storageMock.getItem(PAPER_QUEUE_CACHE_KEY);
        expect(raw).not.toBeNull();
        const cached = JSON.parse(raw as string);
        expect(cached.next).toEqual(paper2);
      });

      const raw = storageMock.getItem(PAPER_QUEUE_CACHE_KEY);
      expect(raw).not.toBeNull();
      const cached = JSON.parse(raw as string);
      expect(cached.current).toEqual(paper1);
      expect(cached.next).toEqual(paper2);
      expect(cached.allDone).toBe(false);
    });
  });
});
