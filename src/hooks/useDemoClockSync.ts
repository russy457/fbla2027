/**
 * useDemoClockSync.ts
 * In demo mode, listens to demoClock/global and applies its offset to the
 * client clock (SPEC#clock: "The client reads demoClock/global when
 * VITE_DEMO_MODE is true and applies the same offset to countdowns and
 * opens-at text"). Mounted once in App. Any signed-in session may read the
 * doc, including a kiosk token; signed-out visitors keep offset 0.
 */
import { useEffect } from "react";
import { listenToDemoClock } from "@/lib/data/people";
import { isDemoMode } from "@/lib/demoMode";
import { useAuthStore } from "@/store/authStore";
import { useClockStore } from "./useNow";

export const useDemoClockSync = (): void => {
  const status = useAuthStore((state) => state.session.status);
  const setOffset = useClockStore((state) => state.setOffset);
  const canRead = isDemoMode() && (status === "user" || status === "kiosk");

  useEffect(() => {
    if (!canRead) {
      setOffset(0);
      return undefined;
    }
    return listenToDemoClock(
      (demoClock) => setOffset(demoClock?.offsetMs ?? 0),
      // A failed read leaves real time in place; the server stays the authority on windows.
      () => setOffset(0)
    );
  }, [canRead, setOffset]);
};
