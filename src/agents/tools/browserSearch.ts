import {z} from "zod";

import {
    tool,
    StructuredToolInterface,
} from "@langchain/core/tools";

import {
    tavily,
} from "@tavily/core";

/**
 * Factory that creates a Tavily search tool if the API key is present.
 * @param apiKey - The Tavily API key.
 * @returns The configured tool when possible.
 */
export function createBrowserSearchTool(
    apiKey?: string,
): StructuredToolInterface | null {
    if (!apiKey) {
        return null;
    }

    const tvly = tavily({apiKey});

    return tool(
        async ({query}) => {
            try {
                const searchResponse = await tvly.search(query, {
                    searchDepth: "advanced",
                    includeAnswer: true,
                    maxResults: 5,
                });

                if (searchResponse.answer) {
                    return `Answer: ${searchResponse.answer}\n\nSources:\n${searchResponse.results.map((r) => `- ${r.title}: ${r.url}`).join("\n")}`;
                }

                return searchResponse.results
                    .map((r) => `Title: ${r.title}\nURL: ${r.url}\nContent: ${r.content}`)
                    .join("\n\n");
            } catch (error: unknown) {
                return `Search failed: ${error instanceof Error ? error.message : String(error)}`;
            }
        },
        {
            name: "browser_search",
            description: "Search the web for real-time information and news using Tavily.",
            schema: z.object({
                query: z.string().describe("The search query"),
            }),
        },
    );
}
