import { DataTypes, Model } from "sequelize";
import { useLegacySequelize } from "../../init/legacySequelize.ts";
import type FlarumUser from "./user.ts";

const sequelize = useLegacySequelize();

/**
 * Legacy Flarum Post Model (read-only, schema owned by the Flarum instance).
 */
export default class FlarumPost extends Model {
    declare id: number;
    declare discussionId: number;
    declare number: number | null;
    declare createdAt: Date;
    declare userId: number | null;
    declare type: string | null;
    declare content: string | null;
    declare editedAt: Date | null;
    declare hiddenAt: Date | null;
    declare isPrivate: boolean;
    declare isApproved: boolean;
    declare user?: FlarumUser | null;
}

FlarumPost.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        discussionId: {
            type: DataTypes.INTEGER,
            field: "discussion_id",
        },
        number: DataTypes.INTEGER,
        createdAt: { type: DataTypes.DATE, field: "created_at" },
        userId: { type: DataTypes.INTEGER, field: "user_id" },
        type: DataTypes.STRING,
        content: DataTypes.TEXT,
        editedAt: { type: DataTypes.DATE, field: "edited_at" },
        hiddenAt: { type: DataTypes.DATE, field: "hidden_at" },
        isPrivate: { type: DataTypes.BOOLEAN, field: "is_private" },
        isApproved: { type: DataTypes.BOOLEAN, field: "is_approved" },
    },
    {
        sequelize,
        tableName: "posts",
        modelName: "flarum_post",
        timestamps: false,
    },
);
