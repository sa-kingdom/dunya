import { DataTypes, Model } from "sequelize";
import { useLegacySequelize } from "../../init/legacySequelize.ts";
import type FlarumUser from "./user.ts";
import type FlarumPost from "./post.ts";
import type FlarumTag from "./tag.ts";

const sequelize = useLegacySequelize();

/**
 * Legacy Flarum Discussion Model (read-only, schema owned by the Flarum instance).
 */
export default class FlarumDiscussion extends Model {
    declare id: number;
    declare title: string;
    declare commentCount: number;
    declare participantCount: number;
    declare postNumberIndex: number;
    declare createdAt: Date;
    declare userId: number | null;
    declare firstPostId: number | null;
    declare lastPostedAt: Date | null;
    declare lastPostedUserId: number | null;
    declare lastPostId: number | null;
    declare lastPostNumber: number | null;
    declare hiddenAt: Date | null;
    declare slug: string;
    declare isPrivate: boolean;
    declare isApproved: boolean;
    declare isLocked: boolean;
    declare isSticky: boolean;
    declare user?: FlarumUser | null;
    declare posts?: FlarumPost[];
    declare tags?: FlarumTag[];
}

FlarumDiscussion.init(
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        title: DataTypes.STRING,
        commentCount: { type: DataTypes.INTEGER, field: "comment_count" },
        participantCount: {
            type: DataTypes.INTEGER,
            field: "participant_count",
        },
        postNumberIndex: {
            type: DataTypes.INTEGER,
            field: "post_number_index",
        },
        createdAt: { type: DataTypes.DATE, field: "created_at" },
        userId: { type: DataTypes.INTEGER, field: "user_id" },
        firstPostId: {
            type: DataTypes.INTEGER,
            field: "first_post_id",
        },
        lastPostedAt: { type: DataTypes.DATE, field: "last_posted_at" },
        lastPostedUserId: {
            type: DataTypes.INTEGER,
            field: "last_posted_user_id",
        },
        lastPostId: { type: DataTypes.INTEGER, field: "last_post_id" },
        lastPostNumber: {
            type: DataTypes.INTEGER,
            field: "last_post_number",
        },
        hiddenAt: { type: DataTypes.DATE, field: "hidden_at" },
        slug: DataTypes.STRING,
        isPrivate: { type: DataTypes.BOOLEAN, field: "is_private" },
        isApproved: { type: DataTypes.BOOLEAN, field: "is_approved" },
        isLocked: { type: DataTypes.BOOLEAN, field: "is_locked" },
        isSticky: { type: DataTypes.BOOLEAN, field: "is_sticky" },
    },
    {
        sequelize,
        tableName: "discussions",
        modelName: "flarum_discussion",
        timestamps: false,
    },
);
