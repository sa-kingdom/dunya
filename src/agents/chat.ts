import {readFileSync} from "node:fs";

import {createAgent, DynamicStructuredTool} from "langchain";
import {ChatOpenAI} from "@langchain/openai";
import {MemorySaver} from "@langchain/langgraph";

import {getFallback} from "../config.ts";

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
const tools: DynamicStructuredTool[] = [];

// Create the production-ready ReAct agent using the modern createAgent factory
export const agent = createAgent({
    model,
    tools,
    checkpointer,
    systemPrompt,
});
