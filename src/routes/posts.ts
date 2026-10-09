// Asuna - A blazing-fast, progressive microservice framework.
// SPDX-License-Identifier: BSD-3-Clause (https://ncurl.xyz/s/mI23sevHR)

import { Router } from "itty-router";
import { StatusCodes } from "http-status-codes";

import { type AsunaRegister, rootRouter } from "../init/router.ts";
import Discussion from "../models/discussion.ts";
import Media from "../models/media.ts";
import Post from "../models/post.ts";
import User from "../models/user.ts";
import { verifyInternalRequest } from "../utils/hmac.ts";

const UNKNOWN_USER = "Unknown User";

// Create router instance
const router = Router({
    base: "/posts",
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
 * GET /posts/:id
 * Fetch a single synced forum post with its author and media.
 * Content is returned raw (mentions are not resolved; use the
 * /discussions endpoints for mention-resolved content).
 */
router.get("/:id", async (request): Promise<Response> => {
    const postId = request.params.id;
    if (!postId) {
        return jsonResponse({ error: "Post ID is required" }, StatusCodes.BAD_REQUEST);
    }

    const post = await Post.findByPk(postId, {
        include: [User, Media, Discussion],
    });
    if (!post) {
        return jsonResponse({ error: "Post not found" }, StatusCodes.NOT_FOUND);
    }

    const raw = post.get({ plain: true }) as Record<string, unknown>;
    const author = raw.user as Record<string, unknown> | null;
    const discussion = raw.discussion as Record<string, unknown> | null;
    const media = Array.isArray(raw.media) ? (raw.media as Record<string, unknown>[]) : [];

    return jsonResponse({
        id: String(raw.id),
        content: (raw.content as string | null) ?? "",
        authorId: raw.userId != null ? String(raw.userId) : null,
        author: author ? {
            id: String(author.id),
            username: String(author.username ?? UNKNOWN_USER),
            displayName: String(author.displayName ?? author.username ?? UNKNOWN_USER),
            avatarHash: (author.avatarHash as string | null) ?? null,
        } : null,
        discussionId: (raw.discussionId as string | null) ?? null,
        discussionName: discussion ? String(discussion.name ?? "") : null,
        media,
        createdAt: raw.createdAt ? new Date(raw.createdAt as Date).toISOString() : "",
        updatedAt: raw.updatedAt ? new Date(raw.updatedAt as Date).toISOString() : "",
    });
});

// Export asuna register
const register: AsunaRegister = () => {
    // Register the routes with the root router, guarded by the internal
    // HMAC signature shared with trusted consumers (e.g. Deter).
    rootRouter.all("/posts/*", async (request: Request) => {
        const rejection = verifyInternalRequest(request);
        if (rejection) {
            return rejection;
        }
        return router.fetch(request);
    });
};

export default register;
