import {useSequelize} from "../init/sequelize.ts";
import {DataTypes, Model} from "sequelize";

const sequelize = useSequelize();

/**
 * PostMedia Junction Model
 */
export default class PostMedia extends Model {
    declare postId: string;
    declare mediumId: string;
    declare createdAt: Date;
    declare updatedAt: Date;
}

PostMedia.init({
    postId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },
    mediumId: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },
}, {
    sequelize,
    tableName: "post_media",
    modelName: "PostMedia",
    timestamps: true,
});
