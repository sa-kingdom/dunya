import {Events, ChannelType, AnyThreadChannel} from "discord.js";
import {useClient} from "../init/discord.ts";
import {getMust} from "../config.ts";
import Discussion, {threadToDiscussion} from "../models/discussion.ts";

const client = useClient();
const guildId = getMust("DISCORD_GUILD_ID");
const channelIdForum = getMust("DISCORD_CHANNEL_ID_FORUM");

export default (): void => {
    client.on(Events.ThreadCreate, async (thread: AnyThreadChannel) => {
        if (
            !thread.guild ||
            thread.guild.id !== guildId ||
            !thread.parent ||
            thread.parent.id !== channelIdForum ||
            thread.parent.type !== ChannelType.GuildForum
        ) {
            return;
        }

        await Discussion.create(threadToDiscussion(thread));
    });
};
