import {Client, Partials, GatewayIntentBits, ForumChannel, ChannelType} from "discord.js";
import {getMust} from "../config.ts";
import {Op} from "sequelize";
import Discussion, {threadToDiscussion} from "../models/discussion.ts";
import Post, {messageToPost} from "../models/post.ts";
import User, {memberToUser} from "../models/user.ts";
import Media from "../models/media.ts";

export {Events} from "discord.js";

const client = new Client({
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.Reaction,
    ],
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.MessageContent,
    ],
});

const botToken = getMust("DISCORD_BOT_TOKEN");
const channelIdForum = getMust("DISCORD_CHANNEL_ID_FORUM");

export const initializePromise = (async (): Promise<void> => {
    await client.login(botToken);

    const channel = await client.channels.fetch(channelIdForum);
    if (!channel || channel.type !== ChannelType.GuildForum) {
        throw new Error("Target channel is not a forum channel");
    }

    // Threads
    const channelThreadActivated = await channel.threads.fetch();
    const channelThreadArchived = await channel.threads.fetchArchived();
    const remoteActivatedThreads = Array.from(
        channelThreadActivated.threads.values(),
    );
    const remoteArchivedThreads = Array.from(
        channelThreadArchived.threads.values(),
    );
    const remoteThreads = remoteActivatedThreads.concat(remoteArchivedThreads);
    const remoteThreadIds = remoteThreads.map(({id}) => id);
    const localThreads = await Discussion.findAll({
        where: {
            id: {[Op.in]: remoteThreadIds},
        },
    });
    const localThreadIds = localThreads.map((t: any) => t.id);
    const appendThreadIds = remoteThreadIds.filter(
        (id) => !localThreadIds.includes(id),
    );
    const appendThreads = remoteThreads.filter(
        ({id}) => appendThreadIds.includes(id),
    ).map(threadToDiscussion);

    // Posts
    const messageThreads = remoteThreads.filter(
        ({id}) => appendThreadIds.includes(id),
    );
    const threadMessages = await Promise.all(messageThreads.map(
        (thread) => thread.messages.fetch(),
    ));
    const appendPosts = threadMessages.map(
        (messages) => Array.from(messages.values()).map(messageToPost),
    ).flat();

    // Users
    const remoteUserIds = Array.from(
        new Set(appendPosts.map(({userId}) => userId)),
    );
    const localUsers = await User.findAll({
        where: {
            id: {[Op.in]: remoteUserIds},
        },
    });
    const localUserIds = localUsers.map((u: any) => u.id);
    const appendUserIds = remoteUserIds.filter(
        (id) => !localUserIds.includes(id),
    );
    const remoteUsers = await channel.guild.members.fetch({
        user: appendUserIds,
    });
    const appendUsers = await Promise.all(Array.from(
        remoteUsers.values(),
    ).map(memberToUser));

    // Bulk creation
    await User.bulkCreate(appendUsers, {
        ignoreDuplicates: true,
    });
    await Discussion.bulkCreate(appendThreads, {
        ignoreDuplicates: true,
    });
    await Post.bulkCreate(appendPosts, {
        ignoreDuplicates: true,
        include: [Media],
    });
})();

export const useClient = (): Client => client;
