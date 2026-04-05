import {useSequelize} from "../init/sequelize.ts";
import {DataTypes, Model} from "sequelize";
import type {GuildMember} from "discord.js";
import got from "got";

const baseUrlCdn = "https://cdn.discordapp.com";
const sequelize = useSequelize();

/**
 * User Model
 */
export default class User extends Model {
    declare id: string;
    declare username: string;
    declare displayName: string;
    declare avatarHash: string | null;
}

User.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    username: DataTypes.STRING,
    displayName: DataTypes.STRING,
    avatarHash: DataTypes.STRING,
}, {
    sequelize,
    modelName: "user",
});

function toAvatarUrl(userId: string, avatarHash: string | null): string | null {
    if (!userId || !avatarHash) {
        return null;
    }
    const url = `${baseUrlCdn}/avatars/${userId}/${avatarHash}`;
    console.log(url);
    return url;
}

async function downloadAvatar(
    userId: string,
    avatarUrl: string,
    avatarHash: string,
    isForceRefresh: boolean = false,
): Promise<void> {
    const targetDir = "assets";
    const targetPath = `${targetDir}/avatar-${userId}-${avatarHash}`;

    if (!isForceRefresh && await Bun.file(targetPath).exists()) {
        return;
    }

    const {mkdir, readdir, unlink} = await import("node:fs/promises");
    await mkdir(targetDir, {recursive: true});

    // Cleanup old avatars for this user
    try {
        const files = await readdir(targetDir).catch(() => []);
        for (const file of files) {
            if (file.startsWith(`avatar-${userId}-`) || file === `avatar-${userId}`) {
                await unlink(`${targetDir}/${file}`).catch(() => {});
            }
        }
    } catch (e) {
        console.warn(`Failed to cleanup old avatars for user ${userId}:`, e);
    }

    const buffer = await got(avatarUrl).buffer();
    await Bun.write(targetPath, buffer);
}

export async function memberToUser(
    member: GuildMember,
    isForceRefresh: boolean = false,
): Promise<{
    id: string;
    username: string;
    displayName: string;
    avatarHash: string | null;
}> {
    const {
        user,
        nickname: memberLocalDisplayName,
        avatar: memberLocalAvatarHash,
    } = member;

    const {
        id: userId,
        username,
        globalName: memberGlobalDisplayName,
        avatar: memberGlobalAvatarHash,
    } = user;

    const displayName = memberLocalDisplayName ||
        memberGlobalDisplayName ||
        username;
    let avatarHash = memberLocalAvatarHash ||
        memberGlobalAvatarHash;

    try {
        const avatarUrl = toAvatarUrl(userId, avatarHash);
        if (avatarUrl && avatarHash) {
            await downloadAvatar(userId, avatarUrl, avatarHash, isForceRefresh);
        } else {
            avatarHash = null;
        }
    } catch (e) {
        console.error(e);
        avatarHash = null;
    }

    return {
        id: userId,
        username,
        displayName,
        avatarHash,
    };
}
