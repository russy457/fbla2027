/**
 * QrScanner.tsx
 * In-app QR scanner for check-in and check-out (SPEC#kiosk 8.1 step 3,
 * SPEC#screen-kiosk-states "Scanner (Tier 1)", G20). Rendered only in a
 * secure context (the caller checks isQrAvailable). It:
 *   - opens the rear camera; if the camera is blocked or missing it calls
 *     onFallback("Camera blocked. Type the code instead.") right away,
 *   - reads frames with the browser's BarcodeDetector when present, or jsQR,
 *   - accepts only this app's /checkin?i=&c= links for THIS shift
 *     (parseCheckinPayload) and hands the code to onCode,
 *   - gives up after 10 seconds without a usable code with the same kind of
 *     fallback, so the typed code (the primary path) is always one step away,
 *   - stops the camera on unmount.
 */
import { useEffect, useRef, useState, type ReactElement } from "react";
import jsQR from "jsqr";
import { buttonClassName } from "@/components/ui/buttonStyles";
import { parseCheckinPayload } from "@/lib/qr";

export const CAMERA_BLOCKED_MESSAGE = "Camera blocked. Type the code instead.";
export const QR_UNREADABLE_MESSAGE = "We couldn't read the QR code. Type the code instead.";
/** SPEC 9.3: fall back to typing after 10 s without a readable code. */
export const SCAN_TIMEOUT_MS = 10_000;
const FRAME_INTERVAL_MS = 250;

interface QrScannerProps {
  readonly instanceId: string;
  readonly onCode: (code: string) => void;
  readonly onFallback: (message: string) => void;
}

interface DetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
type DetectorConstructor = new (options: { formats: string[] }) => DetectorLike;

/** The native detector where the browser has one (Chromium, Android); jsQR elsewhere (iOS Safari). */
const nativeDetector = (): DetectorLike | null => {
  const Detector = (window as unknown as { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
  return Detector ? new Detector({ formats: ["qr_code"] }) : null;
};

const readFrame = async (video: HTMLVideoElement, canvas: HTMLCanvasElement, detector: DetectorLike | null): Promise<string | null> => {
  if (detector) {
    const found = await detector.detect(video);
    return found[0]?.rawValue ?? null;
  }
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context || video.videoWidth === 0) return null;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  context.drawImage(video, 0, 0);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(image.data, image.width, image.height)?.data ?? null;
};

export const QrScanner = ({ instanceId, onCode, onFallback }: QrScannerProps): ReactElement => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hint, setHint] = useState("Point the camera at the QR code on the kiosk.");
  // Callbacks are read through refs so a parent re-render does not restart the camera.
  const handlers = useRef({ onCode, onFallback });
  handlers.current = { onCode, onFallback };

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let finished = false;
    const finish = (run: () => void): void => {
      if (finished) return;
      finished = true;
      run();
    };

    const scan = async (detector: DetectorLike | null): Promise<void> => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (finished || !video || !canvas) return;
      const text = await readFrame(video, canvas, detector).catch(() => null);
      if (text !== null) {
        const payload = parseCheckinPayload(text, window.location.origin);
        if (payload !== null && payload.instanceId === instanceId) {
          finish(() => handlers.current.onCode(payload.code));
          return;
        }
        setHint("That QR code isn't the check-in code for this shift.");
      }
      timer = window.setTimeout(() => void scan(detector), FRAME_INTERVAL_MS);
    };

    const start = async (): Promise<void> => {
      if (!navigator.mediaDevices?.getUserMedia) {
        finish(() => handlers.current.onFallback(CAMERA_BLOCKED_MESSAGE));
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        finish(() => handlers.current.onFallback(CAMERA_BLOCKED_MESSAGE));
        return;
      }
      if (finished) return;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
      void scan(nativeDetector());
    };

    const giveUp = window.setTimeout(() => finish(() => handlers.current.onFallback(QR_UNREADABLE_MESSAGE)), SCAN_TIMEOUT_MS);
    void start();
    return () => {
      finished = true;
      window.clearTimeout(giveUp);
      if (timer !== null) window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [instanceId]);

  return (
    <div className="flex w-full max-w-sm flex-col gap-3">
      <video ref={videoRef} muted playsInline aria-label="Camera view for scanning the kiosk QR code" className="aspect-square w-full rounded-lg bg-surface-sunken object-cover" />
      <canvas ref={canvasRef} hidden />
      <p aria-live="polite" className="text-sm text-fg-muted">
        {hint}
      </p>
      <button type="button" onClick={() => onFallback("")} className={buttonClassName("secondary", "w-fit")}>
        Type the code instead
      </button>
    </div>
  );
};
