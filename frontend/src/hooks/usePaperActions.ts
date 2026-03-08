import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "../api";

function invalidateAfterLikeChange(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["likedPapers"] });
  queryClient.invalidateQueries({ queryKey: ["readPapers"] });
}

export function usePaperActions() {
  const queryClient = useQueryClient();

  const like = useCallback(
    async (paperId: number) => {
      await api.likePaper(paperId);
      invalidateAfterLikeChange(queryClient);
    },
    [queryClient],
  );

  const unlike = useCallback(
    async (paperId: number) => {
      await api.unlikePaper(paperId);
      invalidateAfterLikeChange(queryClient);
    },
    [queryClient],
  );

  const markAsRead = useCallback(
    async (paperId: number) => {
      await api.readPaper(paperId);
      queryClient.invalidateQueries({ queryKey: ["readPapers"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
    [queryClient],
  );

  return { like, unlike, markAsRead };
}
