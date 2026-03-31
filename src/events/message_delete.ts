import {Events, ChannelType, Message, PartialMessage} from "discord.js";
import {useClient} from "../init/discord.ts";
import {getMust} from "../config.ts";
import Post from "../models/post.ts";

const client = useClient();
const guildId = getMust("DISCORD_GUILD_ID");

export default (): void => {
    client.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
        if (
            !message.guild ||
            message.guild.id !== guildId ||
            message.channel?.type !== ChannelType.PublicThread
        ) {
            return;
        }

        const post = await Post.findByPk(message.id);
        if (!post) {
            return;
        }

        await post.destroy();
    });
};
