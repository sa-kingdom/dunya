// Asuna - A blazing-fast, progressive microservice framework.
// SPDX-License-Identifier: BSD-3-Clause (https://ncurl.xyz/s/mI23sevHR)

import { Router } from "itty-router";
import { StatusCodes } from "http-status-codes";

import { type AsunaRegister, rootRouter } from "../init/router.ts";
import Media from "../models/media.ts";
import { verifyInternalRequest } from "../utils/hmac.ts";

const MEDIA_ASSET_DIR = "assets";

// Create router instance
const router = Router({
    base: "/media",
});

/**
 * Respond with a JSON payload.
 * @param data - Payload to serialize.
 * @param status - HTTP status code.
 * @returns JSON Response.
 */
function jsonResponse(data: unknown, status: StatusCodes = StatusCodes.OK): Response {
    return new Response(JSON.stringify(data), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

/**
 * GET /media/:id
 * Serve a synced media asset from local storage when the binary was
 * downloaded during sync; otherwise redirect to the remote (proxy) URL.
 */
router.get("/:id", async (request): Promise<Response> => {
    const mediaId = request.params.id;
    if (!mediaId) {
        return jsonResponse({ error: "Media ID is required" }, StatusCodes.BAD_REQUEST);
    }

    const media = await Media.findByPk(mediaId);
    if (!media) {
        return jsonResponse({ error: "Media not found" }, StatusCodes.NOT_FOUND);
    }

    const file = Bun.file(`${MEDIA_ASSET_DIR}/media-${media.id}`);
    if (await file.exists()) {
        return new Response(file, {
            status: StatusCodes.OK,
            headers: {
                "Content-Type": media.contentType ?? "application/octet-stream",
            },
        });
    }

    const remoteUrl = media.proxyUrl || media.url;
    if (!remoteUrl) {
        return jsonResponse(
            { error: "Media binary is not available" },
            StatusCodes.NOT_FOUND,
        );
    }

    return new Response(null, {
        status: StatusCodes.MOVED_TEMPORARILY,
        headers: { Location: remoteUrl },
    });
});

// Export asuna register
const register: AsunaRegister = () => {
    // Register the routes with the root router, guarded by the internal
    // HMAC signature shared with trusted consumers (e.g. Deter).
    rootRouter.all("/media/*", async (request: Request) => {
        const rejection = verifyInternalRequest(request);
        if (rejection) {
            return rejection;
        }
        return router.fetch(request);
    });
};

export default register;
