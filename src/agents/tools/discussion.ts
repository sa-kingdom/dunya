import {DynamicStructuredTool} from "langchain";
import {Op} from "sequelize";
import {z} from "zod";
import {useSequelize} from "../../init/sequelize.ts";
import Discussion from "../../models/discussion.ts";
import Post from "../../models/post.ts";
import User from "../../models/user.ts";

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
