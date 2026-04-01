import {useSequelize} from "../init/sequelize.ts";
import {DataTypes, Model} from "sequelize";

const sequelize = useSequelize();

/**
 * Soul Model
 */
export default class Soul extends Model {
    declare id: string;
    declare content: string;
}

Soul.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    content: DataTypes.TEXT,
}, {
    sequelize,
    modelName: "soul",
    paranoid: true,
});
