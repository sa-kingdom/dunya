// Auto-load config
import "./src/init/config.ts";

// Import modules
import {APP_NAME as appName} from "./src/init/const.ts";
import {getOverview} from "./src/config.ts";
import {initializePromise as initDiscord, Events as discordEvents} from "./src/init/discord.ts";
import {initializePromise as initSequelize} from "./src/init/sequelize.ts";
import {camelToSnakeCase} from "./src/utils/native.ts";

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

// Initialize and start bot
(async (): Promise<void> => {
    try {
        // Wait for Discord and Database initialization
        await Promise.all([
            initDiscord,
            initSequelize,
        ]);

        // Load all event handlers
        loadEvents(eventNames);

        // Display status
        const {node, runtime} = getOverview();
        console.info(appName, `(environment: ${node}, ${runtime})`);
        console.info("====");
        console.info("Discord bot is running...");
        console.info("Database connection established.");
    } catch (error) {
        console.error("Failed to start bot:", error);
        process.exit(1);
    }
})();
