import { describe, it, expect } from "bun:test";
import { decodeHtmlEntities, flarumToDiscordMarkdown } from "../src/utils/flarumFormatter.ts";

describe("flarumFormatter", () => {
    describe("decodeHtmlEntities", () => {
        it("decodes common HTML entities", () => {
            const input = "&amp; &lt; &gt; &quot; &#039; &#39; &nbsp;";
            expect(decodeHtmlEntities(input)).toBe("& < > \" ' '  ");
        });

        it("decodes double-encoded entities", () => {
            expect(decodeHtmlEntities("&amp;amp;")).toBe("&");
            expect(decodeHtmlEntities("&amp;lt;")).toBe("<");
            expect(decodeHtmlEntities("&amp;quot;")).toBe('"');
        });
    });

    describe("flarumToDiscordMarkdown", () => {
        it("returns empty string for null or empty input", () => {
            expect(flarumToDiscordMarkdown(null)).toBe("");
            expect(flarumToDiscordMarkdown("")).toBe("");
        });

        it("extracts plain text / markdown from <t> tags", () => {
            const input = "<t>**Bold** &amp; *italic*</t>";
            expect(flarumToDiscordMarkdown(input)).toBe("**Bold** & *italic*");
        });

        it("strips <p> and <br> tags inside <t> tags", () => {
            const input = "<t><p>discord的</p></t>";
            expect(flarumToDiscordMarkdown(input)).toBe("discord的");

            const multiline = "<t><p>第一行<br/>第二行</p></t>";
            expect(flarumToDiscordMarkdown(multiline)).toBe("第一行\n第二行");
        });

        it("converts mentions", () => {
            const userMention =
                '<r><USERMENTION id="1" username="alice">@"alice"#1</USERMENTION></r>';
            expect(flarumToDiscordMarkdown(userMention)).toBe("@alice");

            // Post mention → friendly floor reference (L1 fix)
            const postMentionWithNumber =
                '<r><POSTMENTION id="10" number="5">@"bob"#p10</POSTMENTION></r>';
            expect(flarumToDiscordMarkdown(postMentionWithNumber)).toBe("📌 第 5 樓");

            const postMentionByAuthor = '<r><POSTMENTION id="10">@"bob"#p10</POSTMENTION></r>';
            expect(flarumToDiscordMarkdown(postMentionByAuthor)).toBe("📌 @bob 的留言");
        });

        it("converts images and URLs", () => {
            const img =
                '<r><IMG src="https://example.com/pic.png"><s>![pic](</s>https://example.com/pic.png<e>)</e></IMG></r>';
            expect(flarumToDiscordMarkdown(img)).toBe("https://example.com/pic.png");

            const urlWithLabel =
                '<r><URL url="https://example.com"><s>[url=https://example.com]</s>My Site<e>[/url]</e></URL></r>';
            expect(flarumToDiscordMarkdown(urlWithLabel)).toBe("[My Site](https://example.com)");

            const urlPlain = '<r><URL url="https://example.com">https://example.com</URL></r>';
            expect(flarumToDiscordMarkdown(urlPlain)).toBe("https://example.com");
        });

        it("converts code blocks and inline code", () => {
            const codeBlock =
                '<r><CODE lang="typescript">' +
                "<s>```typescript</s>const x = 1;<e>```</e></CODE></r>";
            const expectedCode = "```typescript\nconst x = 1;\n```";
            expect(flarumToDiscordMarkdown(codeBlock)).toBe(expectedCode);

            const inlineCode = "<r><C><s>`</s>const y = 2;<e>`</e></C></r>";
            expect(flarumToDiscordMarkdown(inlineCode)).toBe("`const y = 2;`");
        });

        it("converts basic formatting and spoilers", () => {
            const formatting =
                "<r><p><B><s>[b]</s>Bold<e>[/b]</e></B></p>" +
                "<p><I><s>[i]</s>Italic<e>[/i]</e></I></p>" +
                "<p><U><s>[u]</s>Underline<e>[/u]</e></U></p>" +
                "<p><DEL><s>[s]</s>Strikethrough<e>[/s]</e></DEL></p>" +
                "<p><SPOILER><s>[spoiler]</s>Secret<e>[/spoiler]</e></SPOILER></p></r>";

            const converted = flarumToDiscordMarkdown(formatting);
            expect(converted).toContain("**Bold**");
            expect(converted).toContain("*Italic*");
            expect(converted).toContain("__Underline__");
            expect(converted).toContain("~~Strikethrough~~");
            expect(converted).toContain("||Secret||");

            const ispoiler =
                "<r><p><ISPOILER>我剛剛偷加了一些了，加上自己額外設計</ISPOILER></p></r>";
            expect(flarumToDiscordMarkdown(ispoiler)).toBe(
                "||我剛剛偷加了一些了，加上自己額外設計||",
            );
        });

        it("converts quotes with authors", () => {
            const quote =
                '<r><QUOTE author="alice">' +
                '<s>[quote="alice"]</s>Quoted text<e>[/quote]</e></QUOTE></r>';
            const converted = flarumToDiscordMarkdown(quote);
            expect(converted).toContain("> **alice:**");
            expect(converted).toContain("> Quoted text");
        });

        it("converts lists", () => {
            const list = "<r><LIST><LI><s>* </s>Item 1</LI><LI><s>* </s>Item 2</LI></LIST></r>";
            const converted = flarumToDiscordMarkdown(list);
            expect(converted).toContain("- Item 1");
            expect(converted).toContain("- Item 2");
        });

        it("converts Flarum heading XML tags (L2 fix)", () => {
            const h1 = "<r><H1><s># </s>My Title<e></e></H1></r>";
            const result = flarumToDiscordMarkdown(h1);
            expect(result).toContain("# My Title");

            const h3 = "<r><H3><s>### </s>Sub<e></e></H3></r>";
            expect(flarumToDiscordMarkdown(h3)).toContain("### Sub");
        });

        it("converts FancyPants <FP> tags", () => {
            const fp = '<r><p><FP char="…"><s>...</s></FP></p></r>';
            expect(flarumToDiscordMarkdown(fp)).toBe("…");

            const fpQuote = '<r><p><FP char="”">"</FP></p></r>';
            expect(flarumToDiscordMarkdown(fpQuote)).toBe("”");
        });

        it("hides system event posts", () => {
            expect(flarumToDiscordMarkdown('{"sticky":false}')).toBe("");
            expect(flarumToDiscordMarkdown('{"title":"New Title"}')).toBe("");
            expect(flarumToDiscordMarkdown('{"tagIds":[1,2]}')).toBe("");
        });

        it("deduplicates redundant image links", () => {
            const s9e =
                '<r><URL url="https://example.com/pic.png">' +
                "<s>[url=https://example.com/pic.png]</s>" +
                '<IMG src="https://example.com/pic.png"><s>[img]</s>https://example.com/pic.png<e>[/img]</e></IMG>' +
                "<e>[/url]</e></URL></r>";
            expect(flarumToDiscordMarkdown(s9e)).toBe("https://example.com/pic.png");

            const bbcode =
                "[url=https://example.com/pic.png][img]https://example.com/pic.png[/img][/url]";
            expect(flarumToDiscordMarkdown(bbcode)).toBe("https://example.com/pic.png");

            const mdLinked = "[![](https://example.com/pic.png)](https://example.com/pic.png)";
            expect(flarumToDiscordMarkdown(mdLinked)).toBe("https://example.com/pic.png");

            const mdLinkedAlt =
                "[![alt](https://example.com/pic.png)](https://example.com/pic.png)";
            expect(flarumToDiscordMarkdown(mdLinkedAlt)).toBe("https://example.com/pic.png");

            const mdSame = "[https://example.com/pic.png](https://example.com/pic.png)";
            expect(flarumToDiscordMarkdown(mdSame)).toBe("https://example.com/pic.png");
        });

        it("converts <YOUTUBE> media embed tags", () => {
            const yt =
                '<r><YOUTUBE id="8I66lrj6CO8">' +
                "[https://youtu.be/8I66lrj6CO8](https://youtu.be/8I66lrj6CO8)" +
                "</YOUTUBE></r>";
            expect(flarumToDiscordMarkdown(yt)).toBe("https://www.youtube.com/watch?v=8I66lrj6CO8");
        });
    });
});
