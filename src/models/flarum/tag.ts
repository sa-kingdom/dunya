import { DataTypes, Model } from "sequelize";
import { useLegacySequelize } from "../../init/legacySequelize.ts";

const sequelize = useLegacySequelize();

/**
 * Legacy Flarum Tag Model (read-only, schema owned by the Flarum instance).
 */
export default class FlarumTag extends Model {
    declare id: number;
    declare name: string;
    declare slug: string;
    declare description: string | null;
    declare color: string | null;
    declare icon: string | null;
}

FlarumTag.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: DataTypes.STRING,
        slug: DataTypes.STRING,
        description: DataTypes.TEXT,
        color: DataTypes.STRING,
        icon: DataTypes.STRING,
    },
    {
        sequelize,
        tableName: "tags",
        modelName: "flarum_tag",
        timestamps: false,
    },
);
