import {readFileSync} from "node:fs";

import {createAgent, DynamicStructuredTool} from "langchain";
import {ChatOpenAI} from "@langchain/openai";
import {MemorySaver} from "@langchain/langgraph";

import {get, getFallback} from "../config.ts";

import {
    createCurrentTimeTool,
    createDiscordGetGuilds,
    createDiscordGetTextChannels,
    createDiscordGetMessages,
    createDiscordSendMessages,
    createDiscordChannelSearch,
    createSoulReadTool,
    createSoulWriteTool,
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
