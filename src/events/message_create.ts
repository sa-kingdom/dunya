import {Events, ChannelType, Message, GuildMember} from "discord.js";
import {useClient} from "../init/discord.ts";
import {agent} from "../agents/chat.ts";
import {getMust} from "../config.ts";
import {sliceContent, toPromptWithContext} from "../utils/text.ts";
import Discussion from "../models/discussion.ts";
import Media from "../models/media.ts";
import Post, {messageToPost} from "../models/post.ts";
import User, {memberToUser} from "../models/user.ts";
import Member from "../models/member.ts";
import Role from "../models/role.ts";
import Soul from "../models/soul.ts";

const client = useClient();
const guildId = getMust("DISCORD_GUILD_ID");

async function readSoul(): Promise<string> {
    try {
        const soulId = getMust("SOUL_ID");
        const soul = await Soul.findByPk(soulId);
        return soul?.content || "(empty)";
    } catch (error) {
        console.error("Failed to read soul:", error);
        return "(unavailable)";
    }
}

async function syncMessage(message: Message): Promise<void> {
    try {
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

        const authorMember = message.member || await message.guild.members.fetch(message.author.id);
        const authorUser = await memberToUser(authorMember as GuildMember);
        await User.upsert(authorUser);
        await syncMetadata(message);

        await Post.create(await messageToPost(message), {include: [Media]});
    } catch (error) {
        console.error("Failed to sync message:", error);
    }
}

async function syncMetadata(message: Message): Promise<void> {
    try {
        const {mentions, member, author} = message;

        // Sync Author as Member
        if (member) {
            await Member.upsert({
                id: author.id,
                displayName: member.nickname || member.displayName || author.username,
            });
        } else {
            await Member.upsert({
                id: author.id,
                displayName: author.username,
            });
        }

        // Sync Mentioned Members
        for (const m of mentions.members?.values() || []) {
            await Member.upsert({
                id: m.id,
                displayName: m.nickname || m.displayName || m.user.username,
            });
        }

        // Sync Mentioned Users (who are not members, e.g. DM or if not in cache)
        for (const u of mentions.users.values()) {
            await Member.upsert({
                id: u.id,
                displayName: u.globalName || u.username,
            });
        }

        // Sync Mentioned Roles
        for (const r of mentions.roles.values()) {
            await Role.upsert({
                id: r.id,
                name: r.name,
            });
        }
    } catch (error) {
        console.error("Failed to sync metadata:", error);
    }
}

async function replyMessage(message: Message): Promise<void> {
    if (message.author.bot || message.guildId !== guildId) {
        return;
    }

    if (!client.user || !message.mentions.has(client.user)) {
        return;
    }

    const cleanContent = message.content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
    if (!cleanContent) return;

    // Trigger typing indicator
    if ("sendTyping" in message.channel) {
        await message.channel.sendTyping();
    }

    // Gather context about the message and the author to provide to the agent
    const context: Record<string, string> = {
        yourSoul: await readSoul(),
        guildId: message.guildId || "(none)",
        channelId: message.channelId,
        channelLocale: message.guild?.preferredLocale || "zh-TW",
        authorId: message.author.id,
        authorName:
            message.member?.nickname ||
            message.member?.displayName ||
            message.author.username,
        authorUsername: message.author.username,
        referMessageId: message.id,
    };
    if (message.reference) {
        try {
            const referencedMessage = await message.fetchReference();
            context.referencedMessageAuthorName = referencedMessage.author.username;
            context.referencedMessageContent = referencedMessage.content;
        } catch (error) {
            console.warn("Failed to fetch referenced message:", error);
        }
    }

    // Compose the prompt with additional context
    const promptWithContext = toPromptWithContext(cleanContent, context);

    try {
        // Configuration for the agent's state management
        const config = {configurable: {thread_id: message.channel.id}};

        // Get the current state to know how many messages existed before this turn
        const initialState = await agent.graph.getState(config);
        const initialMessagesCount = initialState.values?.messages?.length || 0;

        // Run the ReAct agent
        const result = await agent.invoke(
            {messages: [{role: "user", content: promptWithContext}]},
            config,
        );

        // Filter messages that were generated in this turn
        const newMessages = result.messages.slice(initialMessagesCount);

        let responseText = "";

        for (const msg of newMessages) {
            const type = msg.type;
            if (type === "ai" && msg.content) {
                responseText = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
            }
        }

        // Reply to the user, slicing into snippets if too long (2000 chars limit on Discord)
        const snippets = sliceContent(responseText, 1900);
        if (snippets.length > 0) {
            const firstSnippet = snippets.shift();
            await message.reply(firstSnippet || "No response content.");
        }
        for (const snippet of snippets) {
            await message.channel.send(snippet);
        }
    } catch (error) {
        console.error("Agent error:", error);
        await message.reply("Oops, something went wrong while thinking! (>_<)");
    }
}

export default (): void => {
    client.on(Events.MessageCreate, async (message: Message) => {
        await Promise.allSettled([
            syncMessage(message),
            replyMessage(message),
        ]);
    });
};
