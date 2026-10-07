import {Events, ChannelType, AnyThreadChannel} from "discord.js";
import {useClient} from "../init/discord.ts";
import {emitWebhookEvent} from "../init/webhook.ts";
import {getMust} from "../config.ts";
import Discussion from "../models/discussion.ts";

const client = useClient();
const guildId = getMust("DISCORD_GUILD_ID");
const channelIdForum = getMust("DISCORD_CHANNEL_ID_FORUM");

export default (): void => {
    client.on(Events.ThreadDelete, async (thread: AnyThreadChannel) => {
        if (
            !thread.guild ||
            thread.guild.id !== guildId ||
            !thread.parent ||
            thread.parent.id !== channelIdForum ||
            thread.parent.type !== ChannelType.GuildForum
        ) {
            return;
        }

        const discussion = await Discussion.findByPk(thread.id);
        if (!discussion) {
            return;
        }

        const name = discussion.name;
        await discussion.destroy();

        void emitWebhookEvent("thread.deleted", {
            id: discussion.id,
            discussionId: discussion.id,
            data: {name},
        });
    });
};
