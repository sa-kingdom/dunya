import { DataTypes, Model } from "sequelize";
import { useLegacySequelize } from "../../init/legacySequelize.ts";

const sequelize = useLegacySequelize();

/**
 * Legacy Flarum User Model (read-only, schema owned by the Flarum instance).
 */
export default class FlarumUser extends Model {
    declare id: number;
    declare username: string;
    declare avatarUrl: string | null;
}

FlarumUser.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        username: DataTypes.STRING,
        avatarUrl: { type: DataTypes.STRING, field: "avatar_url" },
    },
    {
        sequelize,
        tableName: "users",
        modelName: "flarum_user",
        timestamps: false,
    },
);
