// Asuna - A blazing-fast, progressive microservice framework.
// SPDX-License-Identifier: BSD-3-Clause (https://ncurl.xyz/s/mI23sevHR)

import { Router } from "itty-router";
import { Op } from "sequelize";
import { StatusCodes } from "http-status-codes";

import { type AsunaRegister, rootRouter } from "../init/router.ts";
import { initializeLegacyPromise } from "../init/legacySequelize.ts";
import Discussion from "../models/discussion.ts";
import Media from "../models/media.ts";
import Member from "../models/member.ts";
import Post from "../models/post.ts";
import Role from "../models/role.ts";
import User from "../models/user.ts";
import { FlarumDiscussion, FlarumPost, FlarumTag, FlarumUser } from "../models/flarum/index.ts";
import { flarumToDiscordMarkdown } from "../utils/flarumFormatter.ts";
import { verifyInternalRequest } from "../utils/hmac.ts";

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MENTION_USER_REGEX = /<@!?(\d+)>/g;
const MENTION_ROLE_REGEX = /<@&(\d+)>/g;
const UNKNOWN_USER = "Unknown User";
const UNKNOWN_ROLE = "Unknown Role";

interface Author {
    id: string;
    username: string;
    displayName: string;
    avatarHash: string | null;
}

interface Tag {
    id: number;
    name: string;
    slug: string;
    color: string | null;
    icon: string | null;
}

interface PostPayload {
    id: string;
    content: string;
    authorId: string | null;
    author: Author | null;
    media: Record<string, unknown>[];
    createdAt: string;
    updatedAt: string;
}

interface DiscussionPayload {
    id: string;
    source: "discord" | "flarum";
    name: string;
    authorId: string | null;
    author: Author | null;
    lastMessageId: string | null;
    messageCount: number;
    memberCount: number;
    createdAt: string;
    updatedAt: string;
    tags: Tag[];
    posts?: PostPayload[];
}

// Create router instance
const router = Router({
    base: "/discussions",
});

/**
 * Serialize a date value into an ISO-8601 string.
 * @param value - Raw date value from the database.
 * @returns ISO-8601 string, or null when the value is absent.
 */
function toIso(value: unknown): string | null {
    if (!value) {
        return null;
    }
    return new Date(value as string | number | Date).toISOString();
}

/**
 * Map a synced Discord user row into the API author shape.
 * @param raw - Plain user record from the database.
 * @returns Author payload, or null when the record is absent.
 */
function mapDiscordAuthor(raw: Record<string, unknown> | null): Author | null {
    if (!raw) {
        return null;
    }
    return {
        id: String(raw.id),
        username: String(raw.username ?? UNKNOWN_USER),
        displayName: String(raw.displayName ?? raw.username ?? UNKNOWN_USER),
        avatarHash: (raw.avatarHash as string | null) ?? null,
    };
}

/**
 * Map a legacy Flarum user row into the API author shape.
 * @param raw - Plain Flarum user record from the database.
 * @returns Author payload, or null when the record is absent.
 */
function mapFlarumAuthor(raw: Record<string, unknown> | null): Author | null {
    if (!raw) {
        return null;
    }
    return {
        id: String(raw.id),
        username: String(raw.username ?? UNKNOWN_USER),
        displayName: String(raw.username ?? UNKNOWN_USER),
        avatarHash: (raw.avatarUrl as string | null) || "",
    };
}

/**
 * Map a legacy Flarum tag row into the API tag shape.
 * @param raw - Plain Flarum tag record from the database.
 * @returns Tag payload.
 */
function mapFlarumTag(raw: Record<string, unknown>): Tag {
    return {
        id: Number(raw.id),
        name: String(raw.name ?? ""),
        slug: String(raw.slug ?? ""),
        color: (raw.color as string | null) ?? null,
        icon: (raw.icon as string | null) ?? null,
    };
}

/**
 * Escape characters that are special in markdown.
 * @param text - The text to escape.
 * @returns The escaped text.
 */
function escapeMarkdown(text: string): string {
    return text.replace(/[\\*_`~|[\]]/g, "\\$&");
}

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
 * Map a synced Discord discussion (with author) into the API payload shape.
 * @param raw - Plain discussion record including the joined user.
 * @returns Discussion payload.
 */
function mapDiscordDiscussion(raw: Record<string, unknown>): DiscussionPayload {
    return {
        id: String(raw.id),
        source: "discord",
        name: String(raw.name ?? ""),
        authorId: raw.userId != null ? String(raw.userId) : null,
        author: mapDiscordAuthor(raw.user as Record<string, unknown> | null),
        lastMessageId: (raw.lastMessageId as string | null) ?? null,
        messageCount: Number(raw.messageCount ?? 0),
        memberCount: Number(raw.memberCount ?? 0),
        createdAt: toIso(raw.createdAt) ?? "",
        updatedAt: toIso(raw.updatedAt) ?? "",
        tags: [],
    };
}

/**
 * Map a legacy Flarum discussion into the API payload shape.
 * @param raw - Plain Flarum discussion record including joined rows.
 * @returns Discussion payload.
 */
function mapFlarumDiscussion(raw: Record<string, unknown>): DiscussionPayload {
    const tags = Array.isArray(raw.tags)
        ? (raw.tags as Record<string, unknown>[]).map(mapFlarumTag)
        : [];
    return {
        id: String(raw.id),
        source: "flarum",
        name: String(raw.title ?? ""),
        authorId: raw.userId != null ? String(raw.userId) : null,
        author: mapFlarumAuthor(raw.user as Record<string, unknown> | null),
        lastMessageId: raw.lastPostId != null ? String(raw.lastPostId) : null,
        messageCount: Number(raw.commentCount ?? 0),
        memberCount: Number(raw.participantCount ?? 0),
        createdAt: toIso(raw.createdAt) ?? "",
        updatedAt: toIso(raw.lastPostedAt || raw.createdAt) ?? "",
        tags,
    };
}

/**
 * GET /discussions/feed
 * Cursor-paginated feed merged from synced Discord discussions and legacy
 * Flarum discussions, sorted by last activity descending.
 */
router.get("/feed", async (request): Promise<Response> => {
    const query = request.query;
    const beforeCursor = query.before ? new Date(String(query.before)) : null;
    const limit = query.limit ? Math.min(Number(query.limit), MAX_PAGE_SIZE) : PAGE_SIZE;
    const tagId = query.tag ? Number.parseInt(String(query.tag), 10) : null;

    // ── Current (Discord-sourced) discussions ────────────────────────
    const currentWhere: Record<string, unknown> = {};
    if (beforeCursor) {
        currentWhere.updatedAt = { [Op.lt]: beforeCursor };
    }

    const currentDiscussionsPromise =
        tagId !== null
            ? Promise.resolve([] as DiscussionPayload[])
            : Discussion.findAll({
                  where: currentWhere,
                  order: [["updatedAt", "DESC"]],
                  limit,
                  include: [User],
              }).then((rows) =>
                  rows.map((row) =>
                      mapDiscordDiscussion(row.get({ plain: true }) as Record<string, unknown>),
                  ),
              );

    // ── Legacy (Flarum) discussions ─────────────────────────────────
    const legacyWhere: Record<string, unknown> = {
        isPrivate: false,
        isApproved: true,
        hiddenAt: null,
    };
    if (beforeCursor) {
        legacyWhere.lastPostedAt = { [Op.lt]: beforeCursor };
    }

    const tagInclude: Record<string, unknown> = {
        model: FlarumTag,
        as: "tags",
    };
    if (tagId !== null) {
        tagInclude.where = { id: tagId };
        tagInclude.required = true;
    }

    const legacyDiscussionsPromise = FlarumDiscussion.findAll({
        where: legacyWhere,
        order: [["lastPostedAt", "DESC"]],
        limit,
        include: [{ model: FlarumUser, as: "user" }, tagInclude as never],
    })
        .then((rows) =>
            rows.map((row) =>
                mapFlarumDiscussion(row.get({ plain: true }) as Record<string, unknown>),
            ),
        )
        .catch((e: unknown) => {
            console.error("Failed to fetch legacy discussions:", e);
            return [] as DiscussionPayload[];
        });

    const [currentDiscussions, legacyDiscussions] = await Promise.all([
        currentDiscussionsPromise,
        legacyDiscussionsPromise,
    ]);

    // Merge and sort descending, then take a single page
    const merged = [...currentDiscussions, ...legacyDiscussions];
    merged.sort(
        (a, b) =>
            new Date(b.updatedAt || b.createdAt).getTime() -
            new Date(a.updatedAt || a.createdAt).getTime(),
    );

    const items = merged.slice(0, limit);

    // Next cursor = updatedAt of the last item in this page
    const last = items[items.length - 1];
    const nextCursor = last ? new Date(last.updatedAt || last.createdAt).toISOString() : null;

    // Signal end-of-feed when this page is shorter than requested limit
    const hasMore = items.length >= limit;

    return jsonResponse({ items, nextCursor: hasMore ? nextCursor : null });
});

/**
 * Resolve `<@user>` and `<@&role>` mentions in synced post content using the
 * Member and Role tables, leaving a raw markdown string for the consumer.
 * @param content - Raw Discord post content.
 * @param memberMap - Member id to display name mapping.
 * @param roleMap - Role id to name mapping.
 * @returns Content with mentions replaced by readable names.
 */
function resolveMentions(
    content: string,
    memberMap: Map<string, string>,
    roleMap: Map<string, string>,
): string {
    let text = content.replace(MENTION_USER_REGEX, (_match: string, id: string) => {
        const name = memberMap.get(id);
        return name ? `@${escapeMarkdown(name)}` : `@${UNKNOWN_USER}`;
    });
    text = text.replace(MENTION_ROLE_REGEX, (_match: string, id: string) => {
        const name = roleMap.get(id);
        return name ? `@${escapeMarkdown(name)}` : `@${UNKNOWN_ROLE}`;
    });
    return text;
}

/**
 * GET /discussions/discord/:id
 * Fetch a synced Discord discussion with its posts, media, and
 * member/role-resolved post content.
 */
router.get("/discord/:id", async (request): Promise<Response> => {
    const discussionId = request.params.id;
    if (!discussionId) {
        return jsonResponse({ error: "Discussion ID is required" }, StatusCodes.BAD_REQUEST);
    }

    const discussion = await Discussion.findByPk(discussionId, {
        include: [
            User,
            {
                model: Post,
                include: [User, Media],
            },
        ],
        order: [[{ model: Post, as: "posts" }, "createdAt", "ASC"]],
    });

    if (!discussion) {
        return jsonResponse({ error: "Discussion not found" }, StatusCodes.NOT_FOUND);
    }

    const raw = discussion.get({ plain: true }) as Record<string, unknown>;
    const payload = mapDiscordDiscussion(raw);
    const rawPosts = Array.isArray(raw.posts) ? (raw.posts as Record<string, unknown>[]) : [];

    // Collect all unique mention IDs across all posts for batch retrieval
    const memberIds = new Set<string>();
    const roleIds = new Set<string>();
    for (const post of rawPosts) {
        const content = post.content as string | null;
        if (content) {
            for (const match of content.matchAll(MENTION_USER_REGEX)) {
                memberIds.add(match[1]);
            }
            for (const match of content.matchAll(MENTION_ROLE_REGEX)) {
                roleIds.add(match[1]);
            }
        }
    }

    // Fetch member and role names from database
    const [members, roles] = await Promise.all([
        memberIds.size > 0 ? Member.findAll({ where: { id: Array.from(memberIds) } }) : [],
        roleIds.size > 0 ? Role.findAll({ where: { id: Array.from(roleIds) } }) : [],
    ]);

    const memberMap = new Map(members.map((m) => [m.id, m.displayName]));
    const roleMap = new Map(roles.map((r) => [r.id, r.name]));

    payload.posts = rawPosts.map((post) => ({
        id: String(post.id),
        content: post.content ? resolveMentions(post.content as string, memberMap, roleMap) : "",
        authorId: post.userId != null ? String(post.userId) : null,
        author: mapDiscordAuthor(post.user as Record<string, unknown> | null),
        media: (post.media as Record<string, unknown>[] | null) ?? [],
        createdAt: toIso(post.createdAt) ?? "",
        updatedAt: toIso(post.updatedAt) ?? "",
    }));

    return jsonResponse(payload);
});

/**
 * GET /discussions/flarum/:id
 * Fetch a legacy Flarum discussion with its posts converted from Flarum
 * formatting into Discord markdown.
 */
router.get("/flarum/:id", async (request): Promise<Response> => {
    const rawId = request.params.id;
    const flarumId = Number.parseInt(rawId ?? "", 10);
    if (Number.isNaN(flarumId)) {
        return jsonResponse({ error: "Discussion not found" }, StatusCodes.NOT_FOUND);
    }

    const discussion = await FlarumDiscussion.findOne({
        where: {
            id: flarumId,
            isPrivate: false,
            isApproved: true,
            hiddenAt: null,
        },
        include: [
            {
                model: FlarumUser,
                as: "user",
            },
            {
                model: FlarumTag,
                as: "tags",
            },
            {
                model: FlarumPost,
                as: "posts",
                where: {
                    isPrivate: false,
                    isApproved: true,
                    hiddenAt: null,
                },
                required: false,
                include: [
                    {
                        model: FlarumUser,
                        as: "user",
                    },
                ],
            },
        ],
        order: [[{ model: FlarumPost, as: "posts" }, "createdAt", "ASC"]],
    });

    if (!discussion) {
        return jsonResponse({ error: "Discussion not found" }, StatusCodes.NOT_FOUND);
    }

    const raw = discussion.get({ plain: true }) as Record<string, unknown>;
    const payload = mapFlarumDiscussion(raw);
    const rawPosts = Array.isArray(raw.posts) ? (raw.posts as Record<string, unknown>[]) : [];

    payload.posts = rawPosts
        .filter((post) => {
            if (post.type && post.type !== "comment") {
                return false;
            }
            return true;
        })
        .map((post) => ({
            id: String(post.id),
            content: flarumToDiscordMarkdown(post.content as string | null),
            authorId: post.userId != null ? String(post.userId) : null,
            author: mapFlarumAuthor(post.user as Record<string, unknown> | null),
            media: [],
            createdAt: toIso(post.createdAt) ?? "",
            updatedAt: toIso(post.editedAt || post.createdAt) ?? "",
        }))
        .filter((post) => post.content.length > 0);

    return jsonResponse(payload);
});

// Export asuna register
const register: AsunaRegister = () => {
    // Register the routes with the root router, guarded by the internal
    // HMAC signature shared with trusted consumers (e.g. Deter).
    rootRouter.all("/discussions/*", async (request: Request) => {
        const rejection = verifyInternalRequest(request);
        if (rejection) {
            return rejection;
        }
        await initializeLegacyPromise;
        return router.fetch(request);
    });
};

export default register;
