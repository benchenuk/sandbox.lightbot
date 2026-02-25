import { useCallback } from "react";

interface UseClipOptions {
  apiPort: number | null;
}

export function useClip({ apiPort }: UseClipOptions) {
  const clipMessage = useCallback(
    async (title: string, tags: string[], content: string) => {
      if (!apiPort) {
        return { success: false, error: "Sidecar not connected" };
      }

      try {
        const response = await fetch(`http://127.0.0.1:${apiPort}/clip`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, tags, content }),
        });

        const data = await response.json();

        if (data.status === "success") {
          return { success: true, path: data.path };
        } else {
          return { success: false, error: data.error || "Unknown error" };
        }
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : "Network error" };
      }
    },
    [apiPort]
  );

  return { clipMessage };
}
