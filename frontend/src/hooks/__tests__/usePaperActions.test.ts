import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { MockInstance } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../api";
import { usePaperActions } from "../usePaperActions";

vi.mock("../../api", () => ({
  api: {
    likePaper: vi.fn(() => Promise.resolve()),
    unlikePaper: vi.fn(() => Promise.resolve()),
    readPaper: vi.fn(() => Promise.resolve()),
  },
}));

const mockedApi = vi.mocked(api);

describe("usePaperActions", () => {
  let queryClient: QueryClient;
  let wrapper: ({ children }: { children: ReactNode }) => ReactNode;
  let invalidateSpy: MockInstance;

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    wrapper = ({ children }: { children: ReactNode }) =>
      QueryClientProvider({ client: queryClient, children });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("like() calls api.likePaper and invalidates likedPapers + readPapers", async () => {
    const { result } = renderHook(() => usePaperActions(), { wrapper });

    await act(() => result.current.like(42));

    expect(mockedApi.likePaper).toHaveBeenCalledWith(42);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["likedPapers"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["readPapers"] });
  });

  it("unlike() calls api.unlikePaper and invalidates likedPapers + readPapers", async () => {
    const { result } = renderHook(() => usePaperActions(), { wrapper });

    await act(() => result.current.unlike(7));

    expect(mockedApi.unlikePaper).toHaveBeenCalledWith(7);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["likedPapers"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["readPapers"] });
  });

  it("markAsRead() calls api.readPaper and invalidates readPapers + stats", async () => {
    const { result } = renderHook(() => usePaperActions(), { wrapper });

    await act(() => result.current.markAsRead(99));

    expect(mockedApi.readPaper).toHaveBeenCalledWith(99);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["readPapers"] });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["stats"] });
  });
});
