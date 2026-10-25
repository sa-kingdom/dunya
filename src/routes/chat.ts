// Asuna - A blazing-fast, progressive microservice framework.
// SPDX-License-Identifier: BSD-3-Clause (https://ncurl.xyz/s/mI23sevHR)

import {Router} from "itty-router";
import {StatusCodes} from "http-status-codes";
import {nanoid} from "nanoid";
import jwt from "jsonwebtoken";

import {
    type AsunaRegister,
    rootRouter,
} from "../init/router.ts";
import {getMust} from "../config.ts";
import {
    chatWithAI,
    type ChatContext,
} from "../agents/chat.ts";

const channelType = "chat";
const channelName = "Web Chat";
const JWT_ALGORITHM = "HS256";

/**
 * Get the symmetric secret key used for HS256 JWT tokens.
 * Reads the dedicated JWT_SECRET key and fails fast when it is unset,
 * never falling back to other published configuration values.
 * @returns Secret key string.
 */
function getJwtSecret(): string {
    return getMust("JWT_SECRET");
}

// Create router instance
const router = Router({
    base: "/chat",
});

// --- Fixed-window rate limiting for the unauthenticated chat endpoints ---
const RATE_WINDOW_MS = 60_000;
const SESSION_MINTS_PER_MINUTE = 5;
const MESSAGES_PER_MINUTE = 20;
const RATE_BUCKETS_MAX_SIZE = 10_000;
const rateBuckets = new Map<string, {count: number, resetAt: number}>();

/**
 * Consume one request slot from the fixed-window bucket for the given key.
 * @param key - Bucket key (bucket name + client identity).
 * @param limit - Maximum requests allowed inside the window.
 * @returns Whether the request is within the limit.
 */
function takeRateToken(key: string, limit: number): boolean {
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
        if (rateBuckets.size >= RATE_BUCKETS_MAX_SIZE) {
            for (const [existingKey, existingBucket] of rateBuckets) {
                if (existingBucket.resetAt <= now) {
                    rateBuckets.delete(existingKey);
                }
            }
        }
        rateBuckets.set(key, {count: 1, resetAt: now + RATE_WINDOW_MS});
        return true;
    }
    if (bucket.count >= limit) {
        return false;
    }
    bucket.count += 1;
    return true;
}

/**
 * Resolve the client identity from proxy headers (Cloudflare first).
 * @param request - Incoming request.
 * @returns Client key string.
 */
function getClientKey(request: Request): string {
    return request.headers.get("CF-Connecting-IP")
        || request.headers.get("X-Forwarded-For")?.split(",")[0].trim()
        || "global";
}

/**
 * Check whether the request exceeds the per-client fixed-window limit.
 * @param request - Incoming request.
 * @param bucket - Bucket name for the endpoint.
 * @param perClientLimit - Maximum requests per client inside the window.
 * @returns Whether the request is rate limited.
 */
function isRateLimited(request: Request, bucket: string, perClientLimit: number): boolean {
    const clientKey = getClientKey(request);
    const limit = clientKey === "global" ? perClientLimit * 12 : perClientLimit;
    return !takeRateToken(`${bucket}:${clientKey}`, limit);
}

/**
 * Build a 429 response telling the client to retry after the window.
 * @returns HTTP 429 response with Retry-After header.
 */
function tooManyRequests(): Response {
    return new Response(
        JSON.stringify({error: "Too many requests"}),
        {
            status: StatusCodes.TOO_MANY_REQUESTS,
            headers: {"Content-Type": "application/json", "Retry-After": "60"},
        },
    );
}

/**
 * GET /chat/session
 * Generate a new session ID and issue an initial HS256 Bearer access token.
 */
router.get("/session", async (request: Request): Promise<Response> => {
    if (isRateLimited(request, "session-mint", SESSION_MINTS_PER_MINUTE)) {
        return tooManyRequests();
    }
    const sessionId = nanoid();
    const secret = getJwtSecret();

    const token = jwt.sign(
        {sub: sessionId, sessionId},
        secret,
        {algorithm: JWT_ALGORITHM, expiresIn: "1h"},
    );

    return new Response(
        JSON.stringify({sessionId, token}),
        {headers: {"Content-Type": "application/json"}},
    );
});

interface ChatMessageRequestPayload {
    sessionId?: string;
    displayName?: string;
    content?: string;
    message?: string;
    locale?: string;
}

/**
 * POST /chat/message
 * Verify HS256 Bearer token and process chat message without frontend signing.
 */
router.post("/message", async (request: Request): Promise<Response> => {
    let payload: ChatMessageRequestPayload;
    try {
        payload = await request.json() as ChatMessageRequestPayload;
    } catch {
        return new Response(
            JSON.stringify({error: "Bad Request"}),
            {status: StatusCodes.BAD_REQUEST, headers: {"Content-Type": "application/json"}},
        );
    }

    // Extract Bearer token from the Authorization header only
    const authHeader = request.headers.get("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : "";

    if (!token) {
        return new Response(
            JSON.stringify({error: "Bearer token is required"}),
            {
                status: StatusCodes.UNAUTHORIZED,
                headers: {
                    "Content-Type": "application/json",
                    "WWW-Authenticate": "Bearer",
                },
            },
        );
    }

    // Verify JWT token with HS256 only
    let claims: Record<string, any>;
    try {
        claims = jwt.verify(token, getJwtSecret(), {
            algorithms: [JWT_ALGORITHM],
        }) as Record<string, any>;
    } catch {
        return new Response(
            JSON.stringify({error: "Invalid access token"}),
            {
                status: StatusCodes.UNAUTHORIZED,
                headers: {
                    "Content-Type": "application/json",
                    "WWW-Authenticate": "Bearer",
                },
            },
        );
    }

    const inputContent = (payload.content || payload.message || "").trim();
    if (!inputContent) {
        return new Response(
            JSON.stringify({error: "content is required"}),
            {status: StatusCodes.BAD_REQUEST, headers: {"Content-Type": "application/json"}},
        );
    }

    // Extract user profile and session identity from claims
    const userId = String(claims.sub || claims.id || claims.userId || "anonymous");
    let displayName = payload.displayName;
    if (!displayName) {
        if (claims.given_name && claims.family_name) {
            displayName = `${claims.given_name} ${claims.family_name}`.trim();
        } else if (claims.name) {
            displayName = String(claims.name);
        } else if (claims.displayName) {
            displayName = String(claims.displayName);
        } else if (claims.username) {
            displayName = String(claims.username);
        } else {
            displayName = "User";
        }
    }

    // Bind the thread to the verified token claims; reject a mismatched body sessionId
    const sessionId = claims.sessionId || String(claims.sub || nanoid());
    if (payload.sessionId && payload.sessionId !== sessionId) {
        return new Response(
            JSON.stringify({error: "sessionId does not match the access token"}),
            {status: StatusCodes.FORBIDDEN, headers: {"Content-Type": "application/json"}},
        );
    }
    const localeCode = payload.locale || claims.locale || "zh-TW";

    const chatContext: ChatContext = {
        channelId: `web-chat:${sessionId}`,
        channelName,
        channelType,
        userId,
        displayName,
        localeCode,
        title: claims.title,
        groups: claims.groups,
        scope: claims.scope,
    };

    if (isRateLimited(request, "chat-message", MESSAGES_PER_MINUTE)) {
        return tooManyRequests();
    }

    try {
        const outputContent = await chatWithAI(chatContext, inputContent);

        return new Response(
            JSON.stringify({
                sessionId,
                content: outputContent,
            }),
            {
                headers: {
                    "Content-Type": "application/json",
                },
            },
        );
    } catch (error) {
        console.error("Failed to generate AI response:", error);
        return new Response(
            JSON.stringify({error: "Internal Server Error"}),
            {status: StatusCodes.INTERNAL_SERVER_ERROR, headers: {"Content-Type": "application/json"}},
        );
    }
});

// Export asuna register
const register: AsunaRegister = () => {
    // Register the routes with the root router
    rootRouter.all("/chat/*", router.fetch);
};

export default register;
