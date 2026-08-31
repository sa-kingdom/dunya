// Auto-load config
import "./src/init/config.ts";

import {Command} from "commander";
import {APP_NAME as appName} from "./src/init/const.ts";
import {getFallback, getOverview} from "./src/config.ts";
import {initialize as initDiscord, Events as discordEvents} from "./src/init/discord.ts";
import {initializePromise as initSequelize} from "./src/init/sequelize.ts";
import {camelToSnakeCase} from "./src/utils/native.ts";
import {rootRouter} from "./src/init/router.ts";

// CLI options
const program = new Command();
program
    .name(appName)
    .description("Discord bot for syncing forum discussions to database.")
    .option("-f, --force-refresh", "Force refresh all data and media", false)
    .parse(process.argv);

const options = program.opts();

// Define event names
const eventNames: string[] = [
    discordEvents.MessageCreate,
    discordEvents.MessageDelete,
    discordEvents.MessageUpdate,
    discordEvents.ThreadCreate,
    discordEvents.ThreadDelete,
    discordEvents.ThreadUpdate,
];

// Load events
const loadEvents = (eventNames: string[]): void => {
    const snakeNames = eventNames.map(camelToSnakeCase);

    const eventDirectory = new URL("src/events/", import.meta.url);
    const eventFilenames = snakeNames.map(
        (n) => new URL(`${n}.ts`, eventDirectory),
    );

    const eventMappers = eventFilenames.map((n) => import(n.href));
    eventMappers.forEach((c) => c.then((f) => f.default()));
};

// Define router names
const routerNames: string[] = [
    "root",
    "chat",
];

// Load routes
const loadRoutes = async (routerNames: string[]): Promise<void> => {
    const snakeNames = routerNames.map(camelToSnakeCase);

    const routeDirectory = new URL("src/routes/", import.meta.url);
    const routeFilenames = snakeNames.map(
        (n) => new URL(`${n}.ts`, routeDirectory),
    );

    const routerMappers = routeFilenames.map((n) => import(n.href));
    await Promise.all(routerMappers.map((c) => c.then((f) => f.default())));
};

// Initialize and start bot
(async (): Promise<void> => {
    try {
        // Wait for Discord and Database initialization
        await Promise.all([
            initDiscord(options.forceRefresh),
            initSequelize,
        ]);

        if (options.forceRefresh) {
            console.info("Force refresh completed.");
            process.exit(0);
        }

        // Load all event handlers
        loadEvents(eventNames);

        // Load all routes
        await loadRoutes(routerNames);

        // Start HTTP server
        const port = Number(getFallback("PORT", getFallback("HTTP_PORT", "3000")));
        const hostname = getFallback("HTTP_HOSTNAME", "0.0.0.0");

        Bun.serve({
            fetch: rootRouter.fetch,
            port,
            hostname,
        });

        // Display status
        const {node, runtime} = getOverview();
        console.info(appName, `(environment: ${node}, ${runtime})`);
        console.info("====");
        console.info("Discord bot is running...");
        console.info("Database connection established.");
        console.info(`HTTP server is listening at http://${hostname}:${port}`);
    } catch (error) {
        console.error("Failed to start bot:", error);
        process.exit(1);
    }
})();

