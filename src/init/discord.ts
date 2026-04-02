import {
    Client,
    Partials,
    GatewayIntentBits,
    ChannelType,
    PresenceUpdateStatus,
    ActivityType,
} from "discord.js";
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
    presence: {
        status: PresenceUpdateStatus.Idle,
        activities: [{
            type: ActivityType.Listening,
            name: "Radiant Heart",
        }],
    },
});

export const sync = async (isForceRefresh: boolean = false): Promise<void> => {
    const channelIdForum = getMust("DISCORD_CHANNEL_ID_FORUM");
    const channel = await client.channels.fetch(channelIdForum);
    if (!channel || channel.type !== ChannelType.GuildForum) {
        throw new Error("Target channel is not a forum channel");
    }

    // Threads
    const channelThreadActivated = await channel.threads.fetch();
    const channelThreadArchived = await channel.threads.fetchArchived();
    const remoteThreads = [
        ...channelThreadActivated.threads.values(),
        ...channelThreadArchived.threads.values(),
    ];
    const remoteThreadIds = remoteThreads.map(({id}) => id);

    let threadsToProcess = remoteThreads;
    if (!isForceRefresh) {
        const localThreads = await Discussion.findAll({
            where: {id: {[Op.in]: remoteThreadIds}},
            attributes: ["id"],
        });
        const localThreadIds = localThreads.map((t) => t.id);
        const appendThreadIds = remoteThreadIds.filter(
            (id) => !localThreadIds.includes(id),
        );
        threadsToProcess = remoteThreads.filter(
            ({id}) => appendThreadIds.includes(id),
        );
    }

    const appendThreads = threadsToProcess.map((t) => threadToDiscussion(t));

    // Posts
    const threadMessages = await Promise.all(threadsToProcess.map(
        (thread) => thread.messages.fetch(),
    ));
    const appendPostsRaw = await Promise.all(threadMessages.map(
        (messages) => Promise.all(
            Array.from(messages.values()).map((m) => messageToPost(m, isForceRefresh)),
        ),
    ));
    const appendPosts = appendPostsRaw.flat();

    // Users
    const remoteUserIds = Array.from(
        new Set(appendPosts.map(({userId}) => userId)),
    );

    let userIdsToFetch = remoteUserIds;
    if (!isForceRefresh) {
        const localUsers = await User.findAll({
            where: {id: {[Op.in]: remoteUserIds}},
            attributes: ["id"],
        });
        const localUserIds = localUsers.map((u) => u.id);
        userIdsToFetch = remoteUserIds.filter(
            (id) => !localUserIds.includes(id),
        );
    }

    const remoteUsers = await channel.guild.members.fetch({
        user: userIdsToFetch,
    });
    const appendUsers = await Promise.all(Array.from(
        remoteUsers.values(),
    ).map((m) => memberToUser(m, isForceRefresh)));

    // Bulk creation / Upsert
    await User.bulkCreate(appendUsers, {
        updateOnDuplicate: ["username", "displayName", "avatarHash"],
    });
    await Discussion.bulkCreate(appendThreads, {
        updateOnDuplicate: [
            "name",
            "lastMessageId",
            "messageCount",
            "memberCount",
        ],
    });
    await Post.bulkCreate(appendPosts, {
        updateOnDuplicate: ["content"],
        include: [Media],
    });
};

export const initialize = async (
    isForceRefresh: boolean = false,
): Promise<void> => {
    const botToken = getMust("DISCORD_BOT_TOKEN");
    await client.login(botToken);
    await sync(isForceRefresh);
};

export const useClient = (): Client => client;
