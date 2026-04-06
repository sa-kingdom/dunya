import {useSequelize} from "../init/sequelize.ts";
import {DataTypes, Model} from "sequelize";

const sequelize = useSequelize();

/**
 * Role Model for name resolution
 */
export default class Role extends Model {
    declare id: string;
    declare name: string;
}

Role.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    name: DataTypes.STRING,
}, {
    sequelize,
    modelName: "role",
    timestamps: true,
});
