import {readdirSync} from "node:fs";

/**
 * Get the knowledge directory path.
 * @returns The knowledge directory URL.
 */
function getKnowledgeDir(): URL {
    return new URL("../../knowledge/", import.meta.url);
}

/**
 * List all available knowledge names.
 * @returns Array of knowledge names (without extension), or an empty array if the directory is missing.
 */
export function listKnowledgeNames(): string[] {
    try {
        const files = readdirSync(getKnowledgeDir());
        return files
            .filter((f) => f.endsWith(".xml"))
            .map((f) => f.replace(".xml", ""));
    } catch {
        return [];
    }
}

/**
 * Load a knowledge file and return raw XML content.
 * Always read fresh to ensure the latest data.
 * @param knowledgeName - The knowledge file name (without extension).
 * @returns Raw XML content, or null if not found.
 */
export async function loadKnowledge(
    knowledgeName: string,
): Promise<string | null> {
    if (!listKnowledgeNames().includes(knowledgeName)) {
        return null;
    }
    try {
        const filePath = new URL(
            `../../knowledge/${knowledgeName}.xml`,
            import.meta.url,
        );
        const content = await Bun.file(filePath).text();
        return content.trim();
    } catch (error) {
        console.error(`Failed to load knowledge "${knowledgeName}":`, error);
        return null;
    }
}
