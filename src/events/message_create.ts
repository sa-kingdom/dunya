import {Events, ChannelType, Message, GuildMember} from "discord.js";
import {useClient} from "../init/discord.ts";
import {agent} from "../agents/chat.ts";
import {getMust} from "../config.ts";
import {sliceContent} from "../utils/text.ts";
import Discussion from "../models/discussion.ts";
import Media from "../models/media.ts";
import Post, {messageToPost} from "../models/post.ts";
import User, {memberToUser} from "../models/user.ts";

const client = useClient();
const guildId = getMust("DISCORD_GUILD_ID");

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

        await Post.create(messageToPost(message), {include: [Media]});
    } catch (error) {
        console.error("Failed to sync message:", error);
    }
}

async function replyMessage(message: Message): Promise<void> {
    if (message.author.bot) return;

    if (!client.user || !message.mentions.has(client.user)) {
        return;
    }

    const cleanContent = message.content.replace(new RegExp(`<@!?${client.user.id}>`, "g"), "").trim();
    if (!cleanContent) return;

    // Trigger typing indicator
    await message.channel.sendTyping();

    try {
        // Invoke the agent
        const response = await agent.invoke(
            {messages: [["user", cleanContent]]},
            {configurable: {thread_id: message.channel.id}},
        );

        // Extract the latest AI message
        const messages = response.messages;
        const lastMessage = messages[messages.length - 1];

        if (!lastMessage?.content) {
            throw new Error("Agent returned an empty or invalid response");
        }

        // Reply to the user, slicing into snippets if too long (2000 chars limit on Discord)
        const responseText = lastMessage.content as string;
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
