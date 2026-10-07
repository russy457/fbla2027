/**
 * signedPdfUrl.ts
 * Short-lived read links for private PDFs (letters and reports, SPEC 3.22,
 * Appendix B 48). This replaces client-side getDownloadURL, whose token is a
 * permanent bearer credential: anyone who ever saw the link could read the
 * PDF forever. Callers check ownership first (getPdfUrl, getOrgReportUrl);
 * this module only makes the link.
 *
 * Deployed: a V4 signed URL that expires PDF_URL_TTL_MS (5 minutes) after
 * now. Cloud Functions has no private key file, so the Admin SDK signs
 * through IAM signBlob: the Functions service account needs the "Service
 * Account Token Creator" role on itself.
 *
 * Emulator: the Admin SDK has no credentials to sign with and the Storage
 * emulator does not verify signed URLs, so the link is the emulator's
 * GCS-style download path (/download/storage/v1/b/{bucket}/o/{path}?alt=media),
 * which the emulator serves without rules. The ownership check before this
 * call is identical in both modes; only the link format differs, and the
 * emulator link does not expire (the emulator only ever holds demo data).
 *
 * The expiry is measured on deps.nowMs, the injected real-time source, not
 * the demo clock: Google checks signed URLs against real time, so a demo
 * offset would make the link expire early, or even be refused as already
 * expired.
 */
import { PDF_URL_TTL_MS, type PdfUrlOutput } from "@fbla/shared";
import type { ServerDeps } from "./deps";

const emulatorUrl = (host: string, bucket: string, path: string): string =>
  `http://${host}/download/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media`;

export const signedPdfUrl = async (deps: ServerDeps, path: string): Promise<PdfUrlOutput> => {
  const { env } = deps;
  const expiresMs = deps.nowMs() + PDF_URL_TTL_MS;
  const expiresAt = new Date(expiresMs).toISOString();
  // storageEmulatorHost is set only on the emulator (lib/env.ts).
  if (env.storageEmulatorHost !== null) {
    return { url: emulatorUrl(env.storageEmulatorHost, env.storageBucket, path), expiresAt };
  }
  const [url] = await deps.storage
    .bucket(env.storageBucket)
    .file(path)
    .getSignedUrl({ version: "v4", action: "read", expires: expiresMs, responseType: "application/pdf" });
  return { url, expiresAt };
};
