import {z} from "zod";

import {
    tool,
} from "@langchain/core/tools";
import type {StructuredToolInterface} from "@langchain/core/tools";

const LOCAL_TIME_ZONE = new Intl.DateTimeFormat().resolvedOptions().timeZone;
const DEFAULT_LOCALE = "zh-TW";
const FALLBACK_LOCALE = "en-US";

/**
 * Normalize user-specified locale strings into valid Intl locales.
 * @param maybeLocale - Optional locale provided by the user.
 * @returns The resolved locale identifier.
 */
function resolveLocale(maybeLocale?: string | null): string {
    const targetLocale = maybeLocale?.trim() || DEFAULT_LOCALE;
    try {
        return new Intl.DateTimeFormat(targetLocale).resolvedOptions().locale;
    } catch {
        return new Intl.DateTimeFormat(FALLBACK_LOCALE)
            .resolvedOptions().locale;
    }
}

/**
 * Normalize user-specified timezone strings into valid IANA zones.
 * @param maybeZone - Optional timezone provided by the user.
 * @returns The resolved timezone identifier.
 */
function resolveTimeZone(maybeZone?: string | null): string {
    const targetZone = maybeZone?.trim() || LOCAL_TIME_ZONE;
    try {
        return new Intl.DateTimeFormat("en-US", {timeZone: targetZone})
            .resolvedOptions().timeZone;
    } catch {
        return LOCAL_TIME_ZONE;
    }
}

/**
 * Factory that creates the current time tool definition.
 * @returns The configured time tool.
 */
export function createCurrentTimeTool(): StructuredToolInterface {
    return tool(
        async ({
            locale,
            timeZone,
        }) => {
            const now = new Date();
            const resolvedLocale = resolveLocale(locale);
            const resolvedZone = resolveTimeZone(timeZone);
            const formatter = new Intl.DateTimeFormat(resolvedLocale, {
                dateStyle: "full",
                timeStyle: "long",
                timeZone: resolvedZone,
            });

            return JSON.stringify({
                iso: now.toISOString(),
                epochMs: now.getTime(),
                formatted: formatter.format(now),
                locale: resolvedLocale,
                timeZone: resolvedZone,
            });
        },
        {
            name: "current_time",
            description:
          "Retrieves the current date and time. Use before " +
          "referencing schedules, deadlines, or timestamps.",
            schema: z.object({
                locale: z
                    .string()
                    .nullable()
                    .default("zh-TW")
                    .describe("BCP-47 locale tag, e.g. zh-TW or en-US."),
                timeZone: z
                    .string()
                    .nullable()
                    .default("Asia/Taipei")
                    .describe("IANA timezone, e.g. Asia/Taipei."),
            }),
        },
    );
}
