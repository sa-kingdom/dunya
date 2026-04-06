import {Events, ChannelType, Message, PartialMessage} from "discord.js";
import {useClient} from "../init/discord.ts";
import {getMust} from "../config.ts";
import Post from "../models/post.ts";
import Member from "../models/member.ts";
import Role from "../models/role.ts";

const client = useClient();
const guildId = getMust("DISCORD_GUILD_ID");

export default (): void => {
    client.on(
        Events.MessageUpdate,
        async (
            _oldMessage: Message | PartialMessage,
            newMessage: Message | PartialMessage,
        ) => {
            if (newMessage.partial) {
                try {
                    newMessage = await newMessage.fetch();
                } catch (error) {
                    console.error("Failed to fetch partial message:", error);
                    return;
                }
            }

            if (
                !newMessage.guild ||
                newMessage.guild.id !== guildId ||
                newMessage.channel?.type !== ChannelType.PublicThread
            ) {
                return;
            }

            const post = await Post.findByPk(newMessage.id);
            if (!post) {
                return;
            }

            if (newMessage.content) {
                post.content = newMessage.content;
                await syncMetadata(newMessage as Message);
            }

            await post.save();
        },
    );
};

async function syncMetadata(message: Message): Promise<void> {
    try {
        const {mentions, member, author} = message;

        // Sync Author
        if (member) {
            await Member.upsert({
                id: author.id,
                displayName: member.nickname || member.displayName || author.username,
            });
        } else {
            await Member.upsert({
                id: author.id,
                displayName: author.username,
            });
        }

        // Sync Mentions
        for (const m of mentions.members?.values() || []) {
            await Member.upsert({
                id: m.id,
                displayName: m.nickname || m.displayName || m.user.username,
            });
        }

        for (const u of mentions.users.values()) {
            await Member.upsert({
                id: u.id,
                displayName: u.globalName || u.username,
            });
        }

        for (const r of mentions.roles.values()) {
            await Role.upsert({
                id: r.id,
                name: r.name,
            });
        }
    } catch (error) {
        console.error("Failed to sync metadata on update:", error);
    }
}
