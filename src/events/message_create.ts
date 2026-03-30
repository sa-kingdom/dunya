import {Events, ChannelType, Message} from "discord.js";
import {useClient} from "../init/discord.ts";
import {getMust} from "../config.ts";
import Discussion from "../models/discussion.ts";
import Media, {attachmentToMedia} from "../models/media.ts";
import Post, {messageToPost} from "../models/post.ts";
import User, {memberToUser} from "../models/user.ts";

const client = useClient();
const guildId = getMust("DISCORD_GUILD_ID");

export default (): void => {
    client.on(Events.MessageCreate, async (message: Message) => {
        if (
            !message.guild ||
            message.guild.id !== guildId ||
            message.channel.type !== ChannelType.PublicThread
        ) {
            return;
        }

        if (!await Discussion.findByPk(message.channel.id)) {
            return;
        }

        const authorMember = await message.guild.members.fetch(message.author.id);
        const authorUser = await memberToUser(authorMember);
        await User.upsert(authorUser);

        const messageMedia = Array.from(
            message.attachments.values(),
        ).map(attachmentToMedia);
        await Media.bulkCreate(messageMedia, {ignoreDuplicates: true});

        await Post.create(messageToPost(message), { include: [Media] });
    });
};
