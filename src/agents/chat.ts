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

    const initialState = await agent.graph.getState(config);
    const initialMessagesCount = initialState.values?.messages?.length || 0;

    const result = await agent.invoke(
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

