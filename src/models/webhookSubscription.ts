import {useSequelize} from "../init/sequelize.ts";
import {DataTypes, Model} from "sequelize";

const sequelize = useSequelize();

/**
 * WebhookSubscription Model
 */
export default class WebhookSubscription extends Model {
    declare id: string;
    declare url: string;
    declare secret: string;
    declare events: string[] | null;
    declare active: boolean;
}

WebhookSubscription.init({
    id: {
        type: DataTypes.STRING,
        primaryKey: true,
    },
    url: {
        type: DataTypes.STRING(2048),
        allowNull: false,
        validate: {
            isUrl: true,
        },
    },
    secret: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    events: DataTypes.JSON,
    active: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    sequelize,
    modelName: "webhookSubscription",
    timestamps: true,
});
