import {Events, ChannelType, Message, PartialMessage} from "discord.js";
import {useClient} from "../init/discord.ts";
import {getMust} from "../config.ts";
import Post from "../models/post.ts";

const client = useClient();
const guildId = getMust("DISCORD_GUILD_ID");

export default (): void => {
    client.on(
        Events.MessageUpdate,
        async (
            _oldMessage: Message | PartialMessage,
            newMessage: Message | PartialMessage,
        ) => {
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
            }

            await post.save();
        },
    );
};
