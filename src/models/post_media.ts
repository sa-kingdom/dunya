import {useSequelize} from "../init/sequelize.ts";
import {DataTypes, Model} from "sequelize";

const sequelize = useSequelize();

/**
 * PostMedia Junction Model
 */
export default class PostMedia extends Model {
    declare postId: string;
    declare mediaId: string;
}

PostMedia.init({
    postId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },
    mediaId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },
}, {
    sequelize,
    tableName: "post_media",
    modelName: "PostMedia",
    timestamps: false,
});
