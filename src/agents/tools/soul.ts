import {tool} from "@langchain/core/tools";
import {z} from "zod";
import Soul from "../../models/soul.ts";
import {getMust} from "../../config.ts";

/**
 * Get the soul ID from configuration
 */
const getSoulId = () => getMust("SOUL_ID");

/**
 * Handle content limits (original: 300 characters)
 */
const limitContent = (content: string, limit = 300) => {
    if (content.length > limit) {
        return {
            content: content.substring(0, limit),
            truncated: true,
        };
    }
    return {content, truncated: false};
};

export function createSoulReadTool() {
    return tool(
        async () => {
            console.info("[tool] soul_read");
            const soulId = getSoulId();
            const soul = await Soul.findByPk(soulId);
            return soul?.content || "Your soul is currently empty.";
        },
        {
            name: "soul_read",
            description: "Read your current soul (state, identity, and context).",
        },
    );
}

export function createSoulWriteTool() {
    return tool(
        async ({content}) => {
            console.info("[tool] soul_write");
            const soulId = getSoulId();
            const {content: finalContent, truncated} = limitContent(content);

            if (truncated) console.warn("[tool] soul_write: content truncated to 300 characters");

            await Soul.upsert({
                id: soulId,
                content: finalContent,
            });

            return `Soul updated successfully.${truncated ? " (Truncated to 300 characters)" : ""}`;
        },
        {
            name: "soul_write",
            description: "Overwrite your entire soul with new content. Note: Max 300 characters.",
            schema: z.object({
                content: z.string().describe("The new content for your soul."),
            }),
        },
    );
}

export function createSoulAppendTool() {
    return tool(
        async ({content}) => {
            console.info("[tool] soul_append");
            const soulId = getSoulId();
            const soul = await Soul.findByPk(soulId);
            const originalContent = soul?.content || "";
            const newContent = originalContent + (originalContent ? "\n" : "") + content;
            const {content: finalContent, truncated} = limitContent(newContent);

            if (truncated) console.warn("[tool] soul_append: content truncated to 300 characters");

            await Soul.upsert({
                id: soulId,
                content: finalContent,
            });

            return `Content appended to soul successfully.${truncated ? " (Truncated to 300 characters)" : ""}`;
        },
        {
            name: "soul_append",
            description: "Append new information to your soul.",
            schema: z.object({
                content: z.string().describe("The information to append to your soul."),
            }),
        },
    );
}

export function createSoulFindTool() {
    return tool(
        async ({pattern}) => {
            console.info("[tool] soul_find");
            const soulId = getSoulId();
            const soul = await Soul.findByPk(soulId);
            if (!soul || !soul.content) return "No matches found.";

            try {
                const regex = new RegExp(pattern, "g");
                const matches = soul.content.match(regex);
                return matches && matches.length > 0 ? matches.join("\n") : "No matches found.";
            } catch (error) {
                console.error("[tool] soul_find error:", (error as Error).message);
                return `Invalid regex pattern: ${(error as Error).message}`;
            }
        },
        {
            name: "soul_find",
            description: "Search for specific patterns in your soul using regex.",
            schema: z.object({
                pattern: z.string().describe("The regex pattern to search for."),
            }),
        },
    );
}

export function createSoulReplaceTool() {
    return tool(
        async ({pattern, replacement}) => {
            console.info("[tool] soul_replace");
            const soulId = getSoulId();
            const soul = await Soul.findByPk(soulId);
            if (!soul || !soul.content) return "Soul content replaced successfully. (No existing content to replace)";

            try {
                const regex = new RegExp(pattern, "g");
                const newContent = soul.content.replace(regex, replacement);
                const {content: finalContent} = limitContent(newContent);

                await Soul.upsert({
                    id: soulId,
                    content: finalContent,
                });

                return "Soul content replaced successfully.";
            } catch (error) {
                console.error("[tool] soul_replace error:", (error as Error).message);
                return `Replacement failed: ${(error as Error).message}`;
            }
        },
        {
            name: "soul_replace",
            description: "Replace occurrences of a pattern in your soul.",
            schema: z.object({
                pattern: z.string().describe("The regex pattern to find."),
                replacement: z.string().describe("The string to replace the pattern with."),
            }),
        },
    );
}

export function createSoulClearTool() {
    return tool(
        async () => {
            console.info("[tool] soul_clear");
            const soulId = getSoulId();
            await Soul.destroy({where: {id: soulId}, force: true});
            return "Soul cleared successfully.";
        },
        {
            name: "soul_clear",
            description: "Clear your entire soul. Use with extreme caution.",
        },
    );
}
