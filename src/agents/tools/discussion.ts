import {DynamicStructuredTool} from "langchain";
import {Op} from "sequelize";
import {z} from "zod";
import {useSequelize} from "../../init/sequelize.ts";
import Discussion from "../../models/discussion.ts";
import Post from "../../models/post.ts";
import User from "../../models/user.ts";
import {searchDiscussions, searchPosts} from "../../utils/search.ts";

interface HotTopic {
    id: string;
    name: string;
    recentPosts: number;
    messageCount: number | null;
    memberCount: number | null;
    lastActiveAt: Date;
    boards: string[];
    authorName: string | null;
}

const SEARCH_SNIPPET_LENGTH = 160;

/**
 * Aggregate recent post activity per discussion from the synced database.
 * @param since - Only count posts created after this timestamp.
 * @param limit - Maximum number of discussions to return.
 * @returns Raw activity rows keyed by discussion ID.
 */
async function findRecentActivity(since: Date, limit: number): Promise<{
    discussionId: string;
    recentPosts: number;
    lastActiveAt: Date;
}[]> {
    const sequelize = useSequelize();
    const rows = await Post.findAll({
        attributes: [
            "discussionId",
            [sequelize.fn("COUNT", sequelize.col("id")), "recentPosts"],
            [sequelize.fn("MAX", sequelize.col("createdAt")), "lastActiveAt"],
        ],
        where: {createdAt: {[Op.gte]: since}},
        group: "discussionId",
        order: [
            [sequelize.fn("COUNT", sequelize.col("id")), "DESC"],
            [sequelize.fn("MAX", sequelize.col("createdAt")), "DESC"],
        ],
        limit,
    });
    return rows.map((row) => ({
        discussionId: String(row.getDataValue("discussionId")),
        recentPosts: Number(row.getDataValue("recentPosts")),
        lastActiveAt: new Date(row.getDataValue("lastActiveAt") as string),
    }));
}

/**
 * Tool for listing hot forum discussions ranked by recent activity.
 */
export function createDiscussionGetHotTopics(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "discussion_get_hot_topics",
        description:
            "Get the currently hot forum discussions (threads) from the " +
            "synced forum database, ranked by the number of recent posts. " +
            "Use this when the user asks about trending or hot forum topics " +
            "(e.g. \"近期社群上有哪些熱門話題？\"), instead of browsing Discord " +
            "channels or searching the web.",
        schema: z.object({
            days: z.number().nullable().default(7)
                .describe("Lookback window in days for counting activity"),
            limit: z.number().nullable().default(10)
                .describe("Maximum number of topics to return"),
        }),
        func: async ({days, limit}) => {
            const windowDays = Math.max(days ?? 7, 1);
            const maxItems = Math.min(Math.max(limit ?? 10, 1), 20);
            console.info("[tool] discussion_get_hot_topics", {
                days: windowDays,
                limit: maxItems,
            });
            try {
                const since = new Date(
                    Date.now() - windowDays * 24 * 60 * 60 * 1000,
                );
                const activity = await findRecentActivity(since, maxItems);
                if (activity.length === 0) {
                    return `No forum discussions had activity in the last ${windowDays} days.`;
                }

                const discussions = await Discussion.findAll({
                    where: {
                        id: {[Op.in]: activity.map((a) => a.discussionId)},
                    },
                    include: [User],
                });
                const byId = new Map(
                    discussions.map((d) => {
                        const raw = d.get({plain: true}) as Record<string, unknown>;
                        const author = raw.user as Record<string, unknown> | null;
                        const tags = raw.tags as {name: string}[] | null;
                        return [String(raw.id), {
                            id: String(raw.id),
                            name: String(raw.name ?? "(untitled)"),
                            messageCount: (raw.messageCount as number | null) ?? null,
                            memberCount: (raw.memberCount as number | null) ?? null,
                            boards: Array.isArray(tags) ?
                                tags.map((t) => t.name) :
                                [],
                            authorName: (author?.displayName as string | undefined) ||
                                (author?.username as string | undefined) ||
                                null,
                        }];
                    }),
                );

                const topics: HotTopic[] = [];
                for (const row of activity) {
                    const discussion = byId.get(row.discussionId);
                    if (!discussion) continue;
                    topics.push({
                        ...discussion,
                        recentPosts: row.recentPosts,
                        lastActiveAt: row.lastActiveAt,
                    });
                }

                if (topics.length === 0) {
                    return "No matching forum discussions found.";
                }

                const lines = topics.map((topic, index) => {
                    const boards = topic.boards.length > 0 ?
                        topic.boards.join(", ") :
                        "(none)";
                    const author = topic.authorName ?? "Unknown";
                    const lastActive = topic.lastActiveAt
                        .toISOString()
                        .replace("T", " ")
                        .slice(0, 16);
                    return `${index + 1}. ${topic.name} — ` +
                        `boards: ${boards}; ` +
                        `recent posts (last ${windowDays} days): ${topic.recentPosts}; ` +
                        `total messages: ${topic.messageCount ?? 0}; ` +
                        `participants: ${topic.memberCount ?? 0}; ` +
                        `author: ${author}; ` +
                        `last active: ${lastActive}; ` +
                        `thread ID: ${topic.id}`;
                });
                return `Hot forum discussions in the last ${windowDays} days ` +
                    `(ranked by recent posts):\n${lines.join("\n")}`;
            } catch (error: unknown) {
                console.error("discussion_get_hot_topics failed:", error);
                return `Failed to get hot topics: ${
                    error instanceof Error ? error.message : String(error)
                }`;
            }
        },
    });
}

/**
 * Build a readable snippet from a raw post content string.
 * @param content - Raw post content.
 * @returns Single-line snippet trimmed to SEARCH_SNIPPET_LENGTH characters.
 */
function buildSnippet(content: string): string {
    return content.replace(/\s+/g, " ").trim().slice(0, SEARCH_SNIPPET_LENGTH);
}

/**
 * Tool for full-text search over synced forum posts and thread titles.
 */
export function createDiscussionSearchTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "discussion_search",
        description:
            "Full-text search over the synced forum database for posts " +
            "(message content) and discussion thread titles. Use this when " +
            "the user wants to find past discussions or messages containing " +
            "specific keywords, instead of browsing Discord channels.",
        schema: z.object({
            query: z.string()
                .describe("Keywords to search for in posts and thread titles"),
            discussionId: z.string().nullable().default(null)
                .describe("Optional thread ID to restrict the search to"),
            limit: z.number().nullable().default(5)
                .describe("Maximum number of results to return"),
        }),
        func: async ({query, discussionId, limit}) => {
            const keywords = query.trim();
            if (!keywords) {
                return "Search query is empty.";
            }
            const maxItems = Math.min(Math.max(limit ?? 5, 1), 20);
            console.info("[tool] discussion_search", {
                query: keywords,
                discussionId: discussionId ?? null,
                limit: maxItems,
            });
            try {
                const postsPromise = searchPosts(keywords, {
                    discussionId: discussionId ?? null,
                    limit: maxItems,
                });
                const discussions = await searchDiscussions(keywords, {
                    limit: maxItems,
                });
                const posts = await postsPromise;

                const parts: string[] = [];
                if (discussions.length > 0) {
                    const titleLines = discussions.map((d, index) =>
                        `${index + 1}. ${d.name} (thread ID: ${d.id})`,
                    );
                    parts.push(
                        `Threads with matching titles:\n${titleLines.join("\n")}`,
                    );
                }
                if (posts.length > 0) {
                    const postLines = posts.map((p, index) => {
                        const snippet = buildSnippet(p.content);
                        return `${index + 1}. ${p.discussionName} — ` +
                            `"${snippet}" (thread ID: ${p.discussionId}, ` +
                            `post ID: ${p.id})`;
                    });
                    parts.push(
                        `Messages matching "${keywords}":\n${postLines.join("\n")}`,
                    );
                }
                if (parts.length === 0) {
                    return `No forum posts or threads match "${keywords}".`;
                }
                return parts.join("\n\n");
            } catch (error: unknown) {
                console.error("discussion_search failed:", error);
                return `Failed to search forum discussions: ${
                    error instanceof Error ? error.message : String(error)
                }`;
            }
        },
    });
}
