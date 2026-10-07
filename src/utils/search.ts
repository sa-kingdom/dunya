import {QueryTypes} from "sequelize";
import {useSequelize} from "../init/sequelize.ts";

export interface PostSearchResult {
    id: string;
    content: string;
    userId: string | null;
    discussionId: string;
    discussionName: string;
    score: number;
    createdAt: Date;
}

export interface DiscussionSearchResult {
    id: string;
    name: string;
    userId: string | null;
    messageCount: number | null;
    memberCount: number | null;
    score: number;
    createdAt: Date;
    updatedAt: Date;
}

export interface SearchOptions {
    discussionId?: string | null;
    limit?: number;
    offset?: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * Clamp search pagination options to sane bounds.
 * @param options - Raw search options.
 * @returns Normalized limit/offset values.
 */
function normalizePagination(options: SearchOptions): {
    limit: number;
    offset: number;
} {
    const limit = Math.min(
        Math.max(options.limit ?? DEFAULT_LIMIT, 1),
        MAX_LIMIT,
    );
    const offset = Math.max(options.offset ?? 0, 0);
    return {limit, offset};
}

/**
 * Full-text search over synced forum posts (Discord-sourced data only).
 * Results are ranked by the MySQL FULLTEXT relevance score.
 * @param query - Search query in natural language mode.
 * @param options - Optional discussion scope and pagination.
 * @returns Ranked post search results.
 */
export async function searchPosts(
    query: string,
    options: SearchOptions = {},
): Promise<PostSearchResult[]> {
    const {limit, offset} = normalizePagination(options);
    const discussionFilter = options.discussionId ?
        " AND p.discussionId = :discussionId" :
        "";
    const rows = await useSequelize().query<PostSearchResult>(
        `SELECT p.id, p.content, p.userId, p.discussionId,
                d.name AS discussionName,
                MATCH(p.content) AGAINST (:query IN NATURAL LANGUAGE MODE) AS score,
                p.createdAt
           FROM posts p
           JOIN discussions d ON d.id = p.discussionId
          WHERE p.deletedAt IS NULL
            AND d.deletedAt IS NULL
            AND MATCH(p.content) AGAINST (:query IN NATURAL LANGUAGE MODE) > 0${discussionFilter}
          ORDER BY score DESC, p.createdAt DESC
          LIMIT :limit OFFSET :offset`,
        {
            replacements: {
                query,
                discussionId: options.discussionId,
                limit,
                offset,
            },
            type: QueryTypes.SELECT,
        },
    );
    return rows.map((row) => ({
        ...row,
        score: Number(row.score),
        createdAt: new Date(row.createdAt),
    }));
}

/**
 * Full-text search over synced discussion (thread) titles.
 * Results are ranked by the MySQL FULLTEXT relevance score.
 * @param query - Search query in natural language mode.
 * @param options - Pagination options.
 * @returns Ranked discussion search results.
 */
export async function searchDiscussions(
    query: string,
    options: SearchOptions = {},
): Promise<DiscussionSearchResult[]> {
    const {limit, offset} = normalizePagination(options);
    const rows = await useSequelize().query<DiscussionSearchResult>(
        `SELECT id, name, userId, messageCount, memberCount,
                MATCH(name) AGAINST (:query IN NATURAL LANGUAGE MODE) AS score,
                createdAt, updatedAt
           FROM discussions
          WHERE deletedAt IS NULL
            AND MATCH(name) AGAINST (:query IN NATURAL LANGUAGE MODE) > 0
          ORDER BY score DESC, createdAt DESC
          LIMIT :limit OFFSET :offset`,
        {
            replacements: {query, limit, offset},
            type: QueryTypes.SELECT,
        },
    );
    return rows.map((row) => ({
        ...row,
        messageCount: row.messageCount == null ? null : Number(row.messageCount),
        memberCount: row.memberCount == null ? null : Number(row.memberCount),
        score: Number(row.score),
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
    }));
}
