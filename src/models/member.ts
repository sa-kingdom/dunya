import {useSequelize} from "../init/sequelize.ts";
import {DataTypes, Model} from "sequelize";

const sequelize = useSequelize();

/**
 * Member Model for name resolution
 */
export default class Member extends Model {
    declare id: string;
    declare displayName: string;
}

Member.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    displayName: DataTypes.STRING,
}, {
    sequelize,
    modelName: "member",
    timestamps: true,
});
