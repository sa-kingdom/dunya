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
