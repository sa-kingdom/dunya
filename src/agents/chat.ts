import {readFileSync} from "node:fs";

import {createAgent, DynamicStructuredTool} from "langchain";
import {ChatOpenAI} from "@langchain/openai";
import {MemorySaver} from "@langchain/langgraph";

import {get, getFallback, getMust} from "../config.ts";
import {toPromptWithContext} from "../utils/text.ts";
import Soul from "../models/soul.ts";

import {
    createCurrentTimeTool,
    createDiscordGetGuilds,
    createDiscordGetTextChannels,
    createDiscordGetMessages,
    createDiscordSendMessages,
    createDiscordChannelSearch,
    createSoulReadTool,
    createSoulWriteTool,
    createSoulAppendTool,
    createSoulFindTool,
    createSoulReplaceTool,
    createSoulClearTool,
    createBrowserSearchTool,
    createBrowserExtractTool,
    createOpenWeatherMapTool,
    createCodeExecutionTool,
    createKnowledgeRetrievalTool,
    createDiscussionGetHotTopics,
    createDiscussionSearchTool,
} from "./tools/index.ts";

// Define the system prompt with a clear and authoritative persona for the agent
const systemPrompt = readFileSync("settings.txt", "utf-8").trim();

// Configure the checkpointer for persistent state management across interactions
const checkpointer = new MemorySaver();

// Get model name from config
const modelName = getFallback("AGENT_MODEL", "openai/gpt-oss-120b");

// Initialize the reasoning engine
const model = new ChatOpenAI({
    model: modelName,
});

// Define tools for agent capabilities
const toolsArray = [
    createCurrentTimeTool(),
    createDiscordGetGuilds(),
    createDiscordGetTextChannels(),
    createDiscordGetMessages(),
    createDiscordSendMessages(),
    createDiscordChannelSearch(),
    createSoulReadTool(),
    createSoulWriteTool(),
    createSoulAppendTool(),
    createSoulFindTool(),
    createSoulReplaceTool(),
    createSoulClearTool(),
    createBrowserSearchTool(get("TAVILY_API_KEY")),
    createBrowserExtractTool(get("TAVILY_API_KEY")),
    createOpenWeatherMapTool(get("OPENWEATHER_API_KEY")),
    createCodeExecutionTool(),
    createKnowledgeRetrievalTool(),
    createDiscussionGetHotTopics(),
    createDiscussionSearchTool(),
];

// Define tools for agent capabilities
const tools: DynamicStructuredTool[] | any[] = toolsArray.filter(Boolean);

// Create the production-ready ReAct agent using the modern createAgent factory
export const agent = createAgent({
    model,
    tools,
    checkpointer,
    systemPrompt,
});

// Tools that must never be reachable from the unauthenticated web chat:
// live Discord guild access and the shared persistent persona state.
const webExcludedTools = new Set([
    "discord_get_guilds",
    "discord_get_text_channels",
    "discord_get_messages",
    "discord_send_messages",
    "discord_channel_search",
    "soul_read",
    "soul_write",
    "soul_append",
    "soul_find",
    "soul_replace",
    "soul_clear",
]);

// Restricted agent instance for the anonymous web chat channel.
export const webChatAgent = createAgent({
    model,
    tools: tools.filter((tool) => !webExcludedTools.has(tool.name)),
    checkpointer,
    systemPrompt,
});

/**
 * Chat context interface for user and channel details.
 */
export interface ChatContext {
    channelId: string;
    channelName?: string;
    channelType?: string;
    channelLocale?: string;
    guildId?: string;
    userId?: string;
    displayName?: string;
    localeCode?: string;
    authorUsername?: string;
    referMessageId?: string;
    referencedMessageAuthorName?: string;
    referencedMessageContent?: string;
    [key: string]: any;
}

/**
 * Read the current persona content from the database.
 * @returns The soul content.
 */
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

/**
 * Unified interface to chat with the AI persona.
 * @param context - The channel and user context.
 * @param textPrompt - The user prompt text.
 * @returns The AI generated response text.
 */
export async function chatWithAI(
    context: ChatContext,
    textPrompt: string,
): Promise<string> {
    const threadId = context.channelId;
    const soulContent = await readSoul();

    const promptContext: Record<string, string> = {
        yourSoul: soulContent,
        guildId: context.guildId || "(none)",
        channelId: context.channelId,
        channelLocale: context.channelLocale || context.localeCode || "zh-TW",
        authorId: context.userId || "(none)",
        authorName: context.displayName || context.authorUsername || "Anonymous",
        authorUsername: context.authorUsername || context.displayName || "Anonymous",
        referMessageId: context.referMessageId || "(none)",
    };

    if (context.referencedMessageAuthorName && context.referencedMessageContent) {
        promptContext.referencedMessageAuthorName = context.referencedMessageAuthorName;
        promptContext.referencedMessageContent = context.referencedMessageContent;
    }

    const promptWithContext = toPromptWithContext(textPrompt, promptContext);
    const config = {configurable: {thread_id: threadId}};

    // Select the agent instance by channel type: the anonymous web chat
    // runs the restricted instance without Discord and persona tools.
    const activeAgent = context.channelType === "chat" ? webChatAgent : agent;

    const initialState = await activeAgent.graph.getState(config);
    const initialMessagesCount = initialState.values?.messages?.length || 0;

    const result = await activeAgent.invoke(
        {messages: [{role: "user", content: promptWithContext}]},
        config,
    );

    const newMessages = result.messages.slice(initialMessagesCount);
    let responseText = "";

    for (const msg of newMessages) {
        const type = msg.type;
        if (type === "ai" && msg.content) {
            responseText = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        }
    }

    return responseText;
}

