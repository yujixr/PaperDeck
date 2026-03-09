import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyFontSize, loadFontSize, saveFontSize } from "../fontsize";

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

describe("fontsize", () => {
  let storageMock: ReturnType<typeof createLocalStorageMock>;

  beforeEach(() => {
    storageMock = createLocalStorageMock();
    vi.stubGlobal("localStorage", storageMock);
    delete document.documentElement.dataset.fontsize;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.fontsize;
  });

  describe("loadFontSize", () => {
    it("returns 'medium' when nothing is stored", () => {
      expect(loadFontSize()).toBe("medium");
    });

    it("returns the stored value when valid", () => {
      storageMock.setItem("font_size", "large");
      expect(loadFontSize()).toBe("large");
    });

    it("returns 'medium' for invalid stored values", () => {
      storageMock.setItem("font_size", "huge");
      expect(loadFontSize()).toBe("medium");
    });
  });

  describe("saveFontSize", () => {
    it("persists the value to localStorage", () => {
      saveFontSize("small");
      expect(storageMock.getItem("font_size")).toBe("small");
    });
  });

  describe("applyFontSize", () => {
    it("sets data-fontsize on document element", () => {
      applyFontSize("large");
      expect(document.documentElement.dataset.fontsize).toBe("large");
    });
  });
});
