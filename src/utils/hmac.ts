import { createHmac, timingSafeEqual } from "node:crypto";
import { StatusCodes } from "http-status-codes";
import { getFallback } from "../config.ts";

const HEADER_TIMESTAMP = "X-Timestamp";
const HEADER_SIGNATURE = "X-Signature";
const TIMESTAMP_TOLERANCE_SECONDS = 300;

/**
 * Get the shared symmetric secret used to sign internal service requests.
 * @returns Secret key string.
 */
export function getInternalHmacSecret(): string {
    return getFallback("INTERNAL_HMAC_SECRET", "dunya-internal-hmac-secret");
}

/**
 * Build the canonical message covered by the internal HMAC signature.
 * @param method - Uppercase HTTP method, e.g. "GET".
 * @param path - Request path including the query string, e.g. "/x?y=1".
 * @param timestamp - Unix timestamp (seconds) of the request.
 * @returns Canonical string to sign.
 */
export function buildHmacMessage(method: string, path: string, timestamp: number): string {
    return `${timestamp}\n${method.toUpperCase()}\n${path}`;
}

/**
 * Compute the hex HMAC-SHA256 signature of an internal request.
 * @param method - Uppercase HTTP method, e.g. "GET".
 * @param path - Request path including the query string.
 * @param timestamp - Unix timestamp (seconds) of the request.
 * @param secret - Shared secret key.
 * @returns Hex-encoded signature.
 */
export function signInternalRequest(
    method: string,
    path: string,
    timestamp: number,
    secret: string = getInternalHmacSecret(),
): string {
    return createHmac("sha256", secret)
        .update(buildHmacMessage(method, path, timestamp))
        .digest("hex");
}

/**
 * Compute the hex HMAC-SHA256 signature of an outbound webhook delivery.
 * The signed message mirrors the internal request format:
 * "{timestamp}\nPOST\n{body}".
 * @param timestamp - Unix timestamp (seconds) of the delivery.
 * @param body - Raw JSON request body string.
 * @param secret - Subscription-specific secret key.
 * @returns Hex-encoded signature.
 */
export function signWebhookDelivery(
    timestamp: number,
    body: string,
    secret: string = getInternalHmacSecret(),
): string {
    return createHmac("sha256", secret)
        .update(`${timestamp}\nPOST\n${body}`)
        .digest("hex");
}

/**
 * Verify the HMAC signature headers on an internal request.
 * @param request - Incoming request carrying X-Timestamp and X-Signature.
 * @returns A rejection Response when verification fails, otherwise null.
 */
export function verifyInternalRequest(request: Request): Response | null {
    const timestampRaw = request.headers.get(HEADER_TIMESTAMP);
    const signature = request.headers.get(HEADER_SIGNATURE);

    if (!timestampRaw || !signature) {
        return new Response(JSON.stringify({ error: "Signature headers are required" }), {
            status: StatusCodes.UNAUTHORIZED,
            headers: {
                "Content-Type": "application/json",
                "WWW-Authenticate": "Signature",
            },
        });
    }

    const timestamp = Number.parseInt(timestampRaw, 10);
    if (Number.isNaN(timestamp)) {
        return new Response(JSON.stringify({ error: "Invalid timestamp" }), {
            status: StatusCodes.BAD_REQUEST,
            headers: { "Content-Type": "application/json" },
        });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSeconds - timestamp) > TIMESTAMP_TOLERANCE_SECONDS) {
        return new Response(JSON.stringify({ error: "Timestamp out of tolerance" }), {
            status: StatusCodes.UNAUTHORIZED,
            headers: { "Content-Type": "application/json" },
        });
    }

    const path = new URL(request.url);
    const signedPath = `${path.pathname}${path.search}`;
    const expected = signInternalRequest(request.method, signedPath, timestamp);
    const expectedBuffer = Buffer.from(expected, "hex");
    const providedBuffer = Buffer.from(signature, "hex");
    if (
        expectedBuffer.length !== providedBuffer.length ||
        !timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
            status: StatusCodes.UNAUTHORIZED,
            headers: { "Content-Type": "application/json" },
        });
    }

    return null;
}
