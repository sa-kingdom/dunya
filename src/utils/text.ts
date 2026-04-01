/**
 * Slice the message content into multiple snippets.
 * @param content - The content to slice.
 * @param maxLength - The maximum length of each snippet.
 * @param separator - The separator to split the content.
 * @returns The sliced snippets.
 */
export function sliceContent(
    content: string,
    maxLength: number,
    separator: string = "\n",
): string[] {
    // Validation guards
    if (maxLength <= 0) return [];
    if (!content) return [];

    const snippets: string[] = [];
    let current = "";

    // Helper: flush current buffer into snippets
    const flushCurrent = () => {
        const trimmed = current.trim();
        if (trimmed) snippets.push(trimmed);
        current = "";
    };

    // Helper: split a very long string into maxLength chunks
    const splitIntoChunks = (str: string) => {
        for (let i = 0; i < str.length; i += maxLength) {
            const part = str.slice(i, i + maxLength).trim();
            if (part) snippets.push(part);
        }
    };

    // Helper: try to append a line (with separator when appropriate)
    const appendLine = (lineWithSep: string) => {
    // If it fits, append
        if (!current || current.length + lineWithSep.length <= maxLength) {
            current = current ? current + lineWithSep : lineWithSep;
            return;
        }

        // Otherwise flush and then handle the line
        flushCurrent();
        if (lineWithSep.length <= maxLength) {
            current = lineWithSep;
        } else {
            splitIntoChunks(lineWithSep);
        }
    };

    // Process source by lines to keep separator awareness
    const lines = content.split(separator);
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const isLast = i === lines.length - 1;
        const lineWithSep = isLast ? line : line + separator;

        // Guard: if a single piece is too long
        // and current is empty, split directly
        if (!current && lineWithSep.length > maxLength) {
            splitIntoChunks(lineWithSep);
            continue;
        }

        appendLine(lineWithSep);
    }

    flushCurrent();
    return snippets;
}

/**
 * Composes a prompt by combining the given prompt with
 * additional context information. The context is serialized
 * as a JSON string and prefixed to the prompt,
 * separated by a special delimiter.
 * This allows the agent to have access to rich contextual
 * information when processing the prompt, enabling it to
 * generate more relevant and informed responses.
 * @param prompt - The original prompt to be enhanced with context
 * @param context - The additional context information to be included with the prompt
 * @returns A new prompt string that includes the context information
 * The context can include any relevant information
 * about the current interaction, such as the user's identity,
 * the conversation history, or any other metadata that might
 * be useful for the agent to know when generating a response.
 * By including this context in the prompt, the agent can
 * better understand the user's intent and provide more
 * accurate and personalized responses.
 */
export function toPromptWithContext(prompt: string, context: Record<string, string>): string {
    return JSON.stringify({
        context,
    }) + "\x1e\n\n" + prompt;
}
