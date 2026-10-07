/**
 * apiErrors.ts
 * Test helper: builds the ApiError a screen would receive for a catalog code,
 * by running a fake callable error (details {code, params, requestId})
 * through the real toUserError mapping, exactly like production.
 */
import { toUserError, type ErrorCode, type ErrorParams } from "@fbla/shared";
import { ApiError } from "@/lib/api";

export const apiErrorFor = (code: ErrorCode, params: ErrorParams = {}, requestId = "req-123"): ApiError =>
  new ApiError(toUserError({ code: "functions/failed-precondition", details: { code, params, requestId } }));
