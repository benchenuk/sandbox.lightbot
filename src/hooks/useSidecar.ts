import { useState, useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";

interface SidecarState {
  isReady: boolean;
  error: string | null;
  port: number | null;
}

export function useSidecar(): SidecarState {
  const [state, setState] = useState<SidecarState>({
    isReady: false,
    error: null,
    port: null,
  });

  useEffect(() => {
    let unlistenReady: (() => void) | null = null;
    let unlistenError: (() => void) | null = null;

    const setupListeners = async () => {
      // First, try to get current status in case it's already ready
      try {
        const port = await invoke<number>("get_sidecar_status");
        setState({
          isReady: true,
          error: null,
          port: port,
        });
      } catch (e) {
        // Not ready yet or error, that's fine, we'll wait for events
        if (typeof e === "string" && e !== "Sidecar not started yet") {
          setState((s) => ({ ...s, error: e }));
        }
      }

      unlistenReady = await listen("sidecar-ready", (event) => {
        setState({
          isReady: true,
          error: null,
          port: event.payload as number,
        });
      });

      unlistenError = await listen("sidecar-error", (event) => {
        setState({
          isReady: false,
          error: event.payload as string,
          port: null,
        });
      });
    };

    setupListeners();

    return () => {
      if (unlistenReady) unlistenReady();
      if (unlistenError) unlistenError();
    };
  }, []);

  return state;
}
