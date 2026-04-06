import {Events, ChannelType, Message, PartialMessage} from "discord.js";
import {useClient} from "../init/discord.ts";
import {getMust} from "../config.ts";
import Post from "../models/post.ts";
import Member from "../models/member.ts";

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
                await Member.syncMetadata(newMessage as Message, newMessage.member);
            }

            await post.save();
        },
    );
};

