import {DynamicStructuredTool} from "langchain";
import {z} from "zod";
import Soul from "../../models/soul.ts";
import {getMust} from "../../config.ts";

export function createSoulReadTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "ReadSoul",
        description: "Reads the content of your own SOUL_ID. This is your personal storage to remember important things.",
        schema: z.object({
            reason: z.string().optional().describe("Reason for reading your soul"),
        }),
        func: async () => {
            const soulId = getMust("SOUL_ID");

            const soul = await Soul.findByPk(soulId);
            if (!soul) {
                return "Your soul is currently empty.";
            }
            return soul.content || "Your soul is currently empty.";
        },
    });
}

export function createSoulWriteTool(): DynamicStructuredTool {
    return new DynamicStructuredTool({
        name: "WriteSoul",
        description: "Updates the content of your own SOUL_ID to remember important things.",
        schema: z.object({
            content: z.string().describe("The new content to write to your soul."),
        }),
        func: async ({content}: { content: string }) => {
            const soulId = getMust("SOUL_ID");

            await Soul.upsert({
                id: soulId,
                content,
            });

            return "Successfully updated your soul content.";
        },
    });
}
