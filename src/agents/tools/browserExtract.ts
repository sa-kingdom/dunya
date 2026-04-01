import {z} from "zod";

import {
    tool,
    StructuredToolInterface,
} from "@langchain/core/tools";

import {
    tavily,
} from "@tavily/core";

/**
 * Factory that creates a Tavily extract tool if the API key is present.
 * @param apiKey - The Tavily API key.
 * @returns The configured tool when possible.
 */
export function createBrowserExtractTool(
    apiKey?: string,
): StructuredToolInterface | null {
    if (!apiKey) {
        return null;
    }

    const tvly = tavily({apiKey});

    return tool(
        async ({urls}) => {
            try {
                const extractResponse = await tvly.extract(urls);
                return extractResponse.results
                    .map((r) => `URL: ${r.url}\nContent: ${r.rawContent}`)
                    .join("\n\n---\n\n");
            } catch (error: unknown) {
                const msg = error instanceof Error ? error.message : String(error);
                return `Extraction failed: ${msg}`;
            }
        },
        {
            name: "browser_extract",
            description: "Extract clean content from specific URLs using Tavily.",
            schema: z.object({
                urls: z.array(z.string()).describe("The list of URLs to extract content from"),
            }),
        },
    );
}
