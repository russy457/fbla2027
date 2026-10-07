import { describe, expect, it, vi } from "vitest";
import { EMULATOR_PORTS, probeEmulators } from "./emulatorProbe";

describe("probeEmulators", () => {
  it("reports reachable when every port answers", async () => {
    const fetchImpl = vi.fn(async () => new Response(null)) as unknown as typeof fetch;
    const result = await probeEmulators({ host: "127.0.0.1", fetchImpl });
    expect(result).toEqual({ reachable: true, unreachable: [] });
    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:8080/", expect.objectContaining({ mode: "no-cors" }));
  });

  it("lists each port that refuses the connection", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.includes(`:${EMULATOR_PORTS.firestore}/`)) throw new TypeError("Failed to fetch");
      return new Response(null);
    }) as unknown as typeof fetch;
    const result = await probeEmulators({ host: "localhost", fetchImpl });
    expect(result.reachable).toBe(false);
    expect(result.unreachable).toEqual([{ service: "firestore", port: 8080 }]);
  });

  it("treats a hung port as unreachable after the timeout", async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        })
    ) as unknown as typeof fetch;
    const result = await probeEmulators({ host: "localhost", fetchImpl, timeoutMs: 5 });
    expect(result.unreachable).toHaveLength(Object.keys(EMULATOR_PORTS).length);
  });

  it("checks only the local services used by the cloud presentation", async () => {
    const fetchImpl = vi.fn(async () => new Response(null)) as unknown as typeof fetch;
    await probeEmulators({ host: "127.0.0.1", services: ["functions", "storage"], fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:5001/", expect.anything());
    expect(fetchImpl).toHaveBeenCalledWith("http://127.0.0.1:9199/", expect.anything());
  });
});
