import {Events, ChannelType, AnyThreadChannel} from "discord.js";
import {useClient} from "../init/discord.ts";
import {emitWebhookEvent} from "../init/webhook.ts";
import {getMust} from "../config.ts";
import Discussion, {threadToTags} from "../models/discussion.ts";

const client = useClient();
const guildId = getMust("DISCORD_GUILD_ID");
const channelIdForum = getMust("DISCORD_CHANNEL_ID_FORUM");

export default (): void => {
    client.on(
        Events.ThreadUpdate,
        async (
            _oldThread: AnyThreadChannel,
            newThread: AnyThreadChannel,
        ) => {
            if (
                !newThread.guild ||
                newThread.guild.id !== guildId ||
                !newThread.parent ||
                newThread.parent.id !== channelIdForum ||
                newThread.parent.type !== ChannelType.GuildForum
            ) {
                return;
            }

            const discussion = await Discussion.findByPk(newThread.id);
            if (!discussion) {
                return;
            }

            discussion.name = newThread.name;
            discussion.tags = threadToTags(newThread);
            await discussion.save();

            void emitWebhookEvent("thread.updated", {
                id: discussion.id,
                discussionId: discussion.id,
                data: {name: discussion.name, tags: discussion.tags},
            });
        },
    );
};
