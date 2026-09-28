import {tool} from "@langchain/core/tools";
import {z} from "zod";
import {listKnowledgeNames, loadKnowledge} from "../../init/knowledge.ts";

/**
 * Factory that creates a knowledge retrieval tool.
 * Returns raw XML for the AI to interpret directly.
 * @returns The knowledge retrieval tool.
 */
export function createKnowledgeRetrievalTool() {
    const availableKnowledge = listKnowledgeNames();
    const knowledgeList = availableKnowledge.length > 0 ?
        availableKnowledge.join(", ") :
        "(none available)";

    return tool(
        async ({knowledgeName}) => {
            console.info("[tool] retrieve_knowledge", {knowledgeName});
            const content = await loadKnowledge(knowledgeName);
            return content || "(none)";
        },
        {
            name: "retrieve_knowledge",
            description:
                "Retrieve internal knowledge from the knowledge base. " +
                `Available topics: ${knowledgeList}. ` +
                "Check if any available topic matches the user query FIRST before using external search. " +
                "If no relevant knowledge is available, use browser_search instead.",
            schema: z.object({
                knowledgeName: z
                    .string()
                    .describe(`Knowledge name. Options: ${knowledgeList}`),
            }),
        },
    );
}
