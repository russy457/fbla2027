/** The Spark Hosting build serves a browsing preview without deployed callable Functions. */
export const isHostingPreview = (): boolean =>
  import.meta.env.PROD && import.meta.env.VITE_HOSTING_PREVIEW === "true";
