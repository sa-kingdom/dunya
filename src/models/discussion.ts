import {useSequelize} from "../init/sequelize.ts";
import {DataTypes, Model} from "sequelize";
import type {AnyThreadChannel} from "discord.js";

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
}, {
    sequelize,
    modelName: "discussion",
    paranoid: true,
});

export function threadToDiscussion(thread: AnyThreadChannel): {
    id: string;
    name: string;
    userId: string | null;
    lastMessageId: string | null;
    messageCount: number | null;
    memberCount: number | null;
    createdAt: number | null;
} {
    const {
        id, name, ownerId: userId, lastMessageId,
        messageCount, memberCount,
        archiveTimestamp: createdAt,
    } = thread;

    return {
        id, name, userId, lastMessageId,
        messageCount, memberCount, createdAt,
    };
}
