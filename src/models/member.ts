import {useSequelize} from "../init/sequelize.ts";
import {DataTypes, Model} from "sequelize";
import type {Message} from "discord.js";
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
    static async syncMetadata(message: Message): Promise<void> {
        try {
            const {mentions, member, author} = message;
            const memberUpdates = new Map<string, string>();

            // 1. Collect from mentions.users (lowest priority)
            for (const u of mentions.users.values()) {
                memberUpdates.set(u.id, u.globalName || u.username);
            }

            // 2. Collect from mentions.members (higher priority: nicknames)
            for (const m of mentions.members?.values() || []) {
                memberUpdates.set(m.id, m.nickname || m.displayName || m.user.username);
            }

            // 3. Collect from author (highest priority for this message)
            if (member) {
                memberUpdates.set(author.id, member.nickname || member.displayName || author.username);
            } else {
                memberUpdates.set(author.id, author.username);
            }

            // Batch upsert members and roles
            const memberData = Array.from(memberUpdates.entries()).map(([id, displayName]) => ({
                id,
                displayName,
            }));
            const roleData = Array.from(mentions.roles.values()).map((r) => ({
                id: r.id,
                name: r.name,
            }));

            await Promise.all([
                memberData.length > 0 ?
                    Member.bulkCreate(memberData, {updateOnDuplicate: ["displayName"]}) :
                    Promise.resolve(),
                roleData.length > 0 ?
                    Role.bulkCreate(roleData, {updateOnDuplicate: ["name"]}) :
                    Promise.resolve(),
            ]);
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
