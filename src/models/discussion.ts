import {useSequelize} from "../init/sequelize.ts";
import {DataTypes, Model} from "sequelize";
import {ChannelType, type AnyThreadChannel, type ForumChannel} from "discord.js";

const sequelize = useSequelize();

/**
 * Discussion Model
 */
export default class Discussion extends Model {
    declare id: string;
    declare name: string;
    declare userId: string;
    declare lastMessageId: string | null;
    declare messageCount: number;
    declare memberCount: number;
    declare tags: {id: string; name: string}[] | null;
}

Discussion.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    name: DataTypes.STRING,
    lastMessageId: DataTypes.STRING,
    messageCount: DataTypes.INTEGER,
    memberCount: DataTypes.INTEGER,
    tags: DataTypes.JSON,
}, {
    sequelize,
    modelName: "discussion",
    paranoid: true,
});

/**
 * Extract the applied forum tags of a thread as board entries.
 * @param thread - The forum thread.
 * @returns Array of board entries ({id, name}).
 */
export function threadToTags(
    thread: AnyThreadChannel,
): {id: string; name: string}[] {
    const parent = thread.parent;
    if (!parent || parent.type !== ChannelType.GuildForum) {
        return [];
    }
    return thread.appliedTags.flatMap((tagId) => {
        const tag = (parent as ForumChannel).availableTags
            .find((t) => t.id === tagId);
        return tag ? [{id: tag.id, name: tag.name}] : [];
    });
}

export function threadToDiscussion(thread: AnyThreadChannel): {
    id: string;
    name: string;
    userId: string | null;
    lastMessageId: string | null;
    messageCount: number | null;
    memberCount: number | null;
    createdAt: number | null;
    tags: {id: string; name: string}[];
} {
    const {
        id, name, ownerId: userId, lastMessageId,
        messageCount, memberCount,
        archiveTimestamp: createdAt,
    } = thread;

    return {
        id, name, userId, lastMessageId,
        messageCount, memberCount, createdAt,
        tags: threadToTags(thread),
    };
}
