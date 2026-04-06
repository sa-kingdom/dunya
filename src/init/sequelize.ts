import {Sequelize} from "sequelize";
import {getMust, isProduction} from "../config.ts";

const sequelizeDbHost = getMust("SEQUELIZE_DB_HOST");
const sequelizeDbPort = getMust("SEQUELIZE_DB_PORT");
const sequelizeDbName = getMust("SEQUELIZE_DB_NAME");
const sequelizeDbUser = getMust("SEQUELIZE_DB_USER");
const sequelizeDbPass = getMust("SEQUELIZE_DB_PASS");

const sequelize = new Sequelize(
    sequelizeDbName,
    sequelizeDbUser,
    sequelizeDbPass,
    {
        host: sequelizeDbHost,
        port: parseInt(sequelizeDbPort),
        logging: !isProduction(),
        dialect: "mysql",
    },
);

export const initializePromise = (async (): Promise<void> => {
    await import("../models/index.ts");
    await sequelize.authenticate();
})();

export const useSequelize = (): Sequelize => sequelize;
