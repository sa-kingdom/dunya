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

async function downloadAvatar(userId: string, avatarUrl: string): Promise<void> {
    const targetDir = "assets/images";
    const targetPath = `${targetDir}/avatar-${userId}`;
    const buffer = await got(avatarUrl).buffer();
    const {mkdir} = await import("node:fs/promises");
    await mkdir(targetDir, {recursive: true});
    await Bun.write(targetPath, buffer);
}

export async function memberToUser(member: GuildMember): Promise<{
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
        if (avatarUrl) {
            await downloadAvatar(userId, avatarUrl);
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
