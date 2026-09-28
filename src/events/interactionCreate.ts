import {Events} from "discord.js";
import {useClient} from "../init/discord.ts";
import {assignCommand} from "../commands/assign.ts";

const client = useClient();

export default (): void => {
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) {
            return;
        }

        if (interaction.commandName === assignCommand.data.name) {
            await assignCommand.execute(interaction);
        }
    });
};
