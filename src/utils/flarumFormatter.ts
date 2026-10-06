/**
 * Decodes standard HTML entities back into plain characters.
 * Also handles double-encoded entities (e.g. &amp;amp; → &amp; → &).
 * @param str - The input string containing HTML entities.
 * @returns The unescaped string.
 */
export function decodeHtmlEntities(str: string): string {
    let text = str;
    // Double-encoded entities first, then single
    text = text.replace(/&amp;amp;/g, "&");
    text = text.replace(/&amp;lt;/g, "<");
    text = text.replace(/&amp;gt;/g, ">");
    text = text.replace(/&amp;quot;/g, '"');
    text = text.replace(/&amp;#039;|&amp;#39;/g, "'");

    text = text.replace(/&amp;/g, "&");
    text = text.replace(/&lt;/g, "<");
    text = text.replace(/&gt;/g, ">");
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#039;|&#39;/g, "'");
    text = text.replace(/&nbsp;/g, " ");
    return text;
}

/**
 * Converts Flarum post content (s9e/TextFormatter XML, BBCode, or Markdown)
 * into standard Discord Markdown.
 * @param raw - The raw post content string stored in Flarum.
 * @returns The formatted Discord Markdown string.
 */
export function flarumToDiscordMarkdown(raw: string | null | undefined): string {
    if (!raw) {
        return "";
    }

    const trimmedRaw = raw.trim();

    // Hide system event posts serialized as JSON (e.g. {"sticky":false}, etc.)
    if (
        trimmedRaw.startsWith('{"sticky":') ||
        trimmedRaw.startsWith('{"title":') ||
        trimmedRaw.startsWith('{"tagIds":') ||
        trimmedRaw.startsWith('{"locked":')
    ) {
        return "";
    }

    let text = raw;

    // If wrapped in <t>...</t>, strip the container tag.
    if (text.startsWith("<t>") && text.endsWith("</t>")) {
        text = text.slice(3, -4);
    }

    // 1. Mentions
    text = text.replace(/<USERMENTION[^>]*username="([^"]+)"[^>]*>.*?<\/USERMENTION>/gi, "@$1");
    text = text.replace(/<USERMENTION[^>]*>@"?([^"#<]+)"?#\d+<\/USERMENTION>/gi, "@$1");

    // Legacy post mentions: convert to friendly floor reference
    text = text.replace(
        /<POSTMENTION[^>]*number="([^"]+)"[^>]*>.*?<\/POSTMENTION>/gi,
        "📌 第 $1 樓",
    );
    text = text.replace(/<POSTMENTION[^>]*>@"?([^"#<]+)"?#p\d+<\/POSTMENTION>/gi, "📌 @$1 的留言");

    // 2. FancyPants character formatting (e.g. <FP char="…"><s>...</s></FP> -> …)
    text = text.replace(/<FP\b[^>]*char="([^"]+)"[^>]*>[\s\S]*?<\/FP>/gi, "$1");
    text = text.replace(/<FP\b[^>]*>([\s\S]*?)<\/FP>/gi, "$1");

    // 3. Images and URL deduplication
    // Handle <URL url="IMG"><IMG src="IMG">...</IMG></URL> before other rules
    const urlImgPat =
        '<URL\\b[^>]*url="([^"]+)"[^>]*>(?:<s>.*?<\\/s>)?\\s*' +
        '<IMG\\b[^>]*src="\\1"[^>]*>[\\s\\S]*?<\\/IMG>' +
        "\\s*(?:<e>.*?<\\/e>)?<\\/URL>";
    text = text.replace(new RegExp(urlImgPat, "gi"), "$1");

    // Standard <IMG>
    text = text.replace(/<IMG[^>]*src="([^"]+)"[^>]*>.*?<\/IMG>/gi, "$1");

    // Markdown linked images pointing to the same URL:
    // e.g. [![](URL)](URL) or [URL](URL)
    const mdImgLinkPat = "\\[\\s*!\\[.*?\\]\\((https?:\\/\\/[^\\s)]+)\\)\\s*\\]\\(\\1\\)";
    text = text.replace(new RegExp(mdImgLinkPat, "gi"), "$1");
    text = text.replace(/\[\s*(https?:\/\/[^\s\]]+)\s*\]\(\1\)/gi, "$1");

    // Markdown standalone images: ![alt](URL) -> URL
    text = text.replace(/!\[.*?\]\((https?:\/\/[^\s)]+)\)/gi, "$1");

    // 4. Media embeds (e.g. <YOUTUBE id="...">...</YOUTUBE>)
    text = text.replace(
        /<YOUTUBE\b[^>]*id="([^"]+)"[^>]*>[\s\S]*?<\/YOUTUBE>/gi,
        "https://www.youtube.com/watch?v=$1",
    );
    const ytFallbackPat =
        "<YOUTUBE\\b[^>]*>[\\s\\S]*?" +
        "(https?:\\/\\/(?:www\\.)?(?:youtube\\.com|youtu\\.be)\\/" +
        "[^\\s<)\\]]+)[\\s\\S]*?<\\/YOUTUBE>";
    text = text.replace(new RegExp(ytFallbackPat, "gi"), "$1");
    text = text.replace(/<\/?YOUTUBE\b[^>]*>/gi, "");

    // 5. URLs (s9e <URL> tags)
    const urlRegex = new RegExp(
        '<URL[^>]*url="([^"]+)"[^>]*>(?:<s>.*?<\\/s>)?' + "([\\s\\S]*?)(?:<e>.*?<\\/e>)?<\\/URL>",
        "gi",
    );
    text = text.replace(urlRegex, (_, url: string, label: string) => {
        const cleanLabel = label.replace(/<[se]>.*?<\/[se]>/gi, "").trim();
        if (!cleanLabel || cleanLabel === url) {
            return url;
        }
        return `[${cleanLabel}](${url})`;
    });

    // 5. Code blocks and inline code
    const codeRegex = new RegExp(
        '<CODE\\b(?:[^>]*lang="([^"]+)")?[^>]*>(?:<s>.*?<\\/s>)?' +
            "([\\s\\S]*?)(?:<e>.*?<\\/e>)?<\\/CODE>",
        "gi",
    );
    text = text.replace(codeRegex, (_, lang: string | undefined, code: string) => {
        return `\n\`\`\`${lang || ""}\n${code.trim()}\n\`\`\`\n`;
    });
    text = text.replace(/<C\b[^>]*>(?:<s>.*?<\/s>)?([\s\S]*?)(?:<e>.*?<\/e>)?<\/C>/gi, "`$1`");

    // 6. Spoilers (including inline spoiler <ISPOILER>)
    const spoilerPat =
        "<(?:I)?SPOILER\\b[^>]*>(?:<s>.*?<\\/s>)?" +
        "([\\s\\S]*?)(?:<e>.*?<\\/e>)?<\\/(?:I)?SPOILER>";
    text = text.replace(new RegExp(spoilerPat, "gi"), "||$1||");

    // 7. Formatting tags with delimiters
    text = text.replace(/<B\b[^>]*>(?:<s>.*?<\/s>)?([\s\S]*?)(?:<e>.*?<\/e>)?<\/B>/gi, "**$1**");
    text = text.replace(/<I\b[^>]*>(?:<s>.*?<\/s>)?([\s\S]*?)(?:<e>.*?<\/e>)?<\/I>/gi, "*$1*");
    text = text.replace(/<U\b[^>]*>(?:<s>.*?<\/s>)?([\s\S]*?)(?:<e>.*?<\/e>)?<\/U>/gi, "__$1__");
    const delRegex = new RegExp(
        "<(?:DEL|STRIKE)\\b[^>]*>(?:<s>.*?<\\/s>)?([\\s\\S]*?)" +
            "(?:<e>.*?<\\/e>)?<\\/(?:DEL|STRIKE)>",
        "gi",
    );
    text = text.replace(delRegex, "~~$1~~");

    // 8. Headings (s9e XML <H1>–<H6>)
    for (let level = 1; level <= 6; level++) {
        const hashes = "#".repeat(level);
        const hPat =
            `<H${level}\\b[^>]*>(?:<s>.*?</s>)?` + `([\\s\\S]*?)(?:<e>.*?</e>)?</H${level}>`;
        const hRegex = new RegExp(hPat, "gi");
        text = text.replace(hRegex, `${hashes} $1\n`);
    }

    // 9. Quotes
    const quoteRegex = new RegExp(
        '<QUOTE\\b(?:[^>]*author="([^"]+)")?[^>]*>(?:<s>.*?<\\/s>)?' +
            "([\\s\\S]*?)(?:<e>.*?<\\/e>)?<\\/QUOTE>",
        "gi",
    );
    text = text.replace(quoteRegex, (_, author: string | undefined, quote: string) => {
        let cleanQuote = quote.replace(/<[se]>.*?<\/[se]>/gi, "");
        cleanQuote = cleanQuote.replace(/^>+\s*/gm, "").trim();
        const lines = cleanQuote.split("\n");
        const header = author ? `> **${author}:**\n` : "";
        return "\n" + header + lines.map((l) => `> ${l}`).join("\n") + "\n";
    });

    // 10. Lists
    text = text.replace(/<LI\b[^>]*>(?:<s>.*?<\/s>)?([\s\S]*?)<\/LI>/gi, (_, item: string) => {
        const cleanItem = item.replace(/<[se]>.*?<\/[se]>/gi, "").trim();
        return `- ${cleanItem}\n`;
    });

    // Clean any remaining <s> or <e> tags
    text = text.replace(/<[se]>.*?<\/[se]>/gi, "");

    // Paragraphs and breaks
    text = text.replace(/<br\s*\/?>/gi, "\n");
    text = text.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, "$1\n\n");

    // Strip container tags <r>, </r>, <t>, </t>, <LIST>, </LIST>, <p>, </p>
    text = text.replace(/<\/?(?:r|t|p|LIST)\b[^>]*>/gi, "");
    text = text.replace(/\n{3,}/g, "\n\n");

    // Handle standard BBCode in case of non-s9e BBCode
    text = text.replace(/\[b\]([\s\S]*?)\[\/b\]/gi, "**$1**");
    text = text.replace(/\[i\]([\s\S]*?)\[\/i\]/gi, "*$1*");
    text = text.replace(/\[u\]([\s\S]*?)\[\/u\]/gi, "__$1__");
    text = text.replace(/\[(?:s|del)\]([\s\S]*?)\[\/(?:s|del)\]/gi, "~~$1~~");
    const bbcodeSpoilerPat = "\\[(?:i)?spoiler\\]([\\s\\S]*?)\\[\\/(?:i)?spoiler\\]";
    text = text.replace(new RegExp(bbcodeSpoilerPat, "gi"), "||$1||");

    // BBCode [url=URL][img]URL[/img][/url] image deduplication
    const bbcodeSamePat =
        "\\[url=(https?:\\/\\/[^\\]]+)\\]\\s*" + "\\[img\\]\\1\\[\\/img\\]\\s*\\[\\/url\\]";
    text = text.replace(new RegExp(bbcodeSamePat, "gi"), "$1");
    const bbcodeDiffPat =
        "\\[url=(https?:\\/\\/[^\\]]+)\\]\\s*" +
        "\\[img\\](https?:\\/\\/[^\\]]+)\\[\\/img\\]\\s*\\[\\/url\\]";
    text = text.replace(new RegExp(bbcodeDiffPat, "gi"), "$2");
    text = text.replace(/\[img\]([\s\S]*?)\[\/img\]/gi, "$1");

    // General BBCode [url=URL]LABEL[/url]
    text = text.replace(
        /\[url=([^\]]+)\]([\s\S]*?)\[\/url\]/gi,
        (_, url: string, label: string) => {
            const trimmed = label.trim();
            if (!trimmed || trimmed === url) {
                return url;
            }
            return `[${trimmed}](${url})`;
        },
    );
    text = text.replace(/\[url\]([\s\S]*?)\[\/url\]/gi, "$1");

    text = text.replace(
        /\[quote(?:="([^"]*)")?\]([\s\S]*?)\[\/quote\]/gi,
        (_, author: string | undefined, quote: string) => {
            const cleanQuote = quote.replace(/^>+\s*/gm, "").trim();
            const lines = cleanQuote.split("\n");
            const header = author ? `> **${author}:**\n` : "";
            return "\n" + header + lines.map((l) => `> ${l}`).join("\n") + "\n";
        },
    );
    text = text.replace(/\[code\]([\s\S]*?)\[\/code\]/gi, "\n```\n$1\n```\n");

    text = decodeHtmlEntities(text);
    return text.trim();
}
