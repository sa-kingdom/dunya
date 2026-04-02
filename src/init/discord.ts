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
import {useSequelize} from "./sequelize.ts";
import Discussion, {threadToDiscussion} from "../models/discussion.ts";
import Post, {messageToPost} from "../models/post.ts";
import PostMedia from "../models/post_media.ts";
import User, {memberToUser} from "../models/user.ts";
import Media, {attachmentToMedia} from "../models/media.ts";

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
    console.info("[sync] Starting synchronization...");

    const channel = await client.channels.fetch(channelIdForum);
    if (!channel || channel.type !== ChannelType.GuildForum) {
        throw new Error("Target channel is not a forum channel");
    }

    // Threads
    console.info("[sync] Fetching threads from Discord...");
    const channelThreadActivated = await channel.threads.fetch();
    const channelThreadArchived = await channel.threads.fetchArchived();
    const remoteThreads = [
        ...channelThreadActivated.threads.values(),
        ...channelThreadArchived.threads.values(),
    ];
    const remoteThreadIds = remoteThreads.map(({id}) => id);
    console.info(`[sync] Found ${remoteThreads.length} threads on Discord.`);

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
    console.info(`[sync] Processing ${threadsToProcess.length} threads.`);

    const appendThreads = threadsToProcess.map((t) => threadToDiscussion(t));

    // Posts & Media
    console.info("[sync] Fetching messages and media from Discord...");
    const threadMessages = await Promise.all(threadsToProcess.map(
        (thread) => thread.messages.fetch(),
    ));
    const appendPostsRaw = await Promise.all(threadMessages.map(
        (messages) => Promise.all(
            Array.from(messages.values()).map((m) => messageToPost(m, isForceRefresh)),
        ),
    ));
    const appendPosts = appendPostsRaw.flat();
    console.info(`[sync] Fetched ${appendPosts.length} posts.`);

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

    console.info(`[sync] Fetching ${userIdsToFetch.length} users from Discord...`);
    const remoteUsers = await channel.guild.members.fetch({
        user: userIdsToFetch,
    });
    const appendUsers = await Promise.all(Array.from(
        remoteUsers.values(),
    ).map((m) => memberToUser(m, isForceRefresh)));

    // Extract unique media across all posts
    const mediaMap = new Map<string, Awaited<ReturnType<typeof attachmentToMedia>>>();
    for (const post of appendPosts) {
        for (const m of post.media) {
            mediaMap.set(m.id, m);
        }
    }
    const allMedia = Array.from(mediaMap.values());

    // Build PostMedia links
    const postMediaLinks = appendPosts.flatMap((post) =>
        post.media.map((m) => ({postId: post.id, mediaId: m.id})),
    );

    // Layered bulk saves in a transaction
    const sequelize = useSequelize();
    await sequelize.transaction(async (t: import("sequelize").Transaction) => {
        // Level 1: Users
        console.info(`[sync] Saving ${appendUsers.length} users...`);
        await User.bulkCreate(appendUsers, {
            updateOnDuplicate: ["username", "displayName", "avatarHash"],
            transaction: t,
        });

        // Level 2: Discussions
        console.info(`[sync] Saving ${appendThreads.length} discussions...`);
        await Discussion.bulkCreate(appendThreads, {
            updateOnDuplicate: ["name", "lastMessageId", "messageCount", "memberCount"],
            transaction: t,
        });

        // Level 3: Media (separate from posts to avoid ER_DUP_ENTRY)
        console.info(`[sync] Saving ${allMedia.length} media records...`);
        await Media.bulkCreate(allMedia, {
            updateOnDuplicate: [
                "name", "description", "contentType", "size",
                "url", "proxyUrl", "height", "width",
                "ephemeral", "duration", "waveform",
            ],
            transaction: t,
        });

        // Level 4: Posts (without include)
        console.info(`[sync] Saving ${appendPosts.length} posts...`);
        const postRows = appendPosts.map(({media: _m, ...rest}) => rest);
        await Post.bulkCreate(postRows, {
            updateOnDuplicate: ["content", "userId", "discussionId"],
            transaction: t,
        });

        // Level 5: PostMedia links (noop on duplicate)
        console.info(`[sync] Saving ${postMediaLinks.length} post-media links...`);
        await PostMedia.bulkCreate(postMediaLinks, {
            ignoreDuplicates: true,
            transaction: t,
        });
    });

    console.info("[sync] Synchronization completed ✓");
};

export const initialize = async (
    isForceRefresh: boolean = false,
): Promise<void> => {
    const botToken = getMust("DISCORD_BOT_TOKEN");
    await client.login(botToken);
    await sync(isForceRefresh);
};

export const useClient = (): Client => client;
