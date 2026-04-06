import {useSequelize} from "../init/sequelize.ts";
import {DataTypes, Model} from "sequelize";
import type {Message, GuildMember} from "discord.js";
import Role from "./role.ts";

const sequelize = useSequelize();

/**
 * Member Model for name resolution
 */
export default class Member extends Model {
    declare id: string;
    declare displayName: string;

    /**
     * Syncs member and role metadata from a message for name resolution.
     */
    static async syncMetadata(message: Message, authorMember?: GuildMember | null): Promise<void> {
        try {
            const {mentions, member, author} = message;
            const memberUpdates = new Map<string, string>();

            // 1. Collect from mentions.users (lowest priority)
            for (const u of mentions.users.values()) {
                memberUpdates.set(u.id, u.displayName);
            }

            // 2. Collect from mentions.members (higher priority)
            for (const m of mentions.members?.values() || []) {
                memberUpdates.set(m.id, m.displayName);
            }

            // 3. Collect from author (highest priority for this message)
            const effectiveMember = authorMember || member;
            if (effectiveMember) {
                memberUpdates.set(author.id, effectiveMember.displayName);
            } else {
                memberUpdates.set(author.id, author.displayName);
            }

            // Batch upsert members and roles
            const now = new Date();
            const memberData = Array.from(memberUpdates.entries()).map(([id, displayName]) => ({
                id,
                displayName,
                updatedAt: now,
            }));
            const roleData = Array.from(mentions.roles.values()).map((r) => ({
                id: r.id,
                name: r.name,
                updatedAt: now,
            }));

            const tasks: Promise<any>[] = [];
            if (memberData.length > 0) {
                tasks.push(Member.bulkCreate(memberData, {updateOnDuplicate: ["displayName", "updatedAt"]}));
            }
            if (roleData.length > 0) {
                tasks.push(Role.bulkCreate(roleData, {updateOnDuplicate: ["name", "updatedAt"]}));
            }

            if (tasks.length > 0) {
                await Promise.all(tasks);
            }
        } catch (error) {
            console.error("Failed to sync metadata:", error);
        }
    }
}

Member.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    displayName: DataTypes.STRING,
}, {
    sequelize,
    modelName: "member",
    timestamps: true,
});
