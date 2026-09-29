import { Sequelize } from "sequelize";
import { getFallback } from "../config.ts";

const legacyDbHost = getFallback("LEGACY_SEQUELIZE_DB_HOST", "127.0.0.1");
const legacyDbPort = getFallback("LEGACY_SEQUELIZE_DB_PORT", "3306");
const legacyDbName = getFallback("LEGACY_SEQUELIZE_DB_NAME", "flarum");
const legacyDbUser = getFallback("LEGACY_SEQUELIZE_DB_USER", "deter");
const legacyDbPass = getFallback("LEGACY_SEQUELIZE_DB_PASS", "deter");

export const legacySequelize = new Sequelize(legacyDbName, legacyDbUser, legacyDbPass, {
    host: legacyDbHost,
    port: parseInt(legacyDbPort),
    logging: false,
    dialect: "mysql",
});

export const initializeLegacyPromise = (async (): Promise<void> => {
    await import("../models/flarum/index.ts");
    await legacySequelize.authenticate().catch((e: unknown) => {
        console.warn("Legacy Flarum database is unavailable:", e);
    });
})();

export const useLegacySequelize = (): Sequelize => legacySequelize;
