import {DynamicStructuredTool} from "langchain";
import {z} from "zod";
import {
    ChannelType,
    type TextChannel,
} from "discord.js";
import {
    useClient,
} from "../../init/discord.ts";

/**
 * Tool for retrieving all servers a bot is a member of.
 */
export function createDiscordGetGuilds(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "discord_get_guilds",
        description: "Get a list of all Discord servers (guilds) the bot is a member of.",
        schema: z.object({}).optional(),
        func: async () => {
            try {
                const client = useClient();
                const guilds = await client.guilds.fetch();
                return guilds.map((g) => `ID: ${g.id}, Name: ${g.name}`).join("\n") || "No guilds found.";
            } catch (error: unknown) {
                return `Failed to get guilds: ${
                    error instanceof Error ? error.message : String(error)
                }`;
            }
        },
    });
}

/**
 * Tool for retrieving text channels within a server/guild.
 */
export function createDiscordGetTextChannels(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "discord_get_text_channels",
        description: "Get all text channels in a specific Discord server (guild) by its ID.",
        schema: z.object({
            guildId: z.string().describe("The ID of the Discord server (guild)"),
        }),
        func: async ({guildId}) => {
            try {
                const client = useClient();
                const guild = await client.guilds.fetch(guildId);
                const channels = await guild.channels.fetch();
                return channels
                    .filter((c) => c?.type === ChannelType.GuildText)
                    .map((c) => `ID: ${c?.id}, Name: ${c?.name}`)
                    .join("\n") || "No text channels found.";
            } catch (error: unknown) {
                return `Failed to get text channels: ${
                    error instanceof Error ? error.message : String(error)
                }`;
            }
        },
    });
}

/**
 * Tool for retrieving messages from a discord channel.
 */
export function createDiscordGetMessages(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "discord_get_messages",
        description: "Get recent messages from a specific Discord channel.",
        schema: z.object({
            channelId: z.string().describe("The ID of the Discord channel"),
            limit: z.number().optional().default(10).describe("Number of messages to retrieve"),
        }),
        func: async ({channelId, limit = 10}) => {
            try {
                const client = useClient();
                const channel = await client.channels.fetch(channelId);
                if (!channel || channel.type !== ChannelType.GuildText) {
                    return "Channel not found or is not a text channel.";
                }
                const messages = await (channel as TextChannel).messages.fetch({limit});
                return messages
                    .map((m) => `${m.author.tag} (${m.createdAt.toLocaleString()}): ${m.content}`)
                    .join("\n") || "No messages found.";
            } catch (error: unknown) {
                return `Failed to get messages: ${
                    error instanceof Error ? error.message : String(error)
                }`;
            }
        },
    });
}

/**
 * Tool for sending messages to a discord channel.
 */
export function createDiscordSendMessages(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "discord_send_messages",
        description: "Send a message to a specific Discord channel.",
        schema: z.object({
            channelId: z.string().describe("The ID of the Discord channel"),
            message: z.string().describe("The message content to send"),
        }),
        func: async ({channelId, message}) => {
            try {
                const client = useClient();
                const channel = await client.channels.fetch(channelId);
                if (!channel || !("send" in channel)) {
                    return "Channel not found or does not support sending messages.";
                }
                const sent = await (channel as TextChannel).send(message);
                return `Message sent successfully. Message ID: ${sent.id}`;
            } catch (error: unknown) {
                return `Failed to send message: ${
                    error instanceof Error ? error.message : String(error)
                }`;
            }
        },
    });
}

/**
 * Tool for searching for messages within a discord channel.
 */
export function createDiscordChannelSearch(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "discord_channel_search",
        description: "Search for messages containing a specific string in a Discord channel (searches recent 100 messages).",
        schema: z.object({
            channelId: z.string().describe("The ID of the Discord channel"),
            query: z.string().describe("The text to search for"),
            limit: z.number().optional().default(10).describe("Max results to return"),
        }),
        func: async ({channelId, query, limit = 50}) => {
            try {
                const client = useClient();
                const channel = await client.channels.fetch(channelId);
                if (!channel || channel.type !== ChannelType.GuildText) {
                    return "Channel not found or is not a text channel.";
                }
                const messages = await (channel as TextChannel).messages.fetch({limit: 100});
                const filtered = messages.filter(
                    (m) => m.content.toLowerCase().includes(query.toLowerCase()),
                ).first(limit);
                return filtered
                    .map((m) => `${m.author.tag} (${m.createdAt.toLocaleString()}): ${m.content}`)
                    .join("\n") || `No messages matching "${query}" found in the last 100 messages.`;
            } catch (error: unknown) {
                return `Search failed: ${error instanceof Error ? error.message : String(error)}`;
            }
        },
    });
}
