import {Events} from "discord.js";
import {useClient} from "../init/discord.ts";
import {moveCommand} from "../commands/move.ts";

const client = useClient();

export default (): void => {
    client.on(Events.InteractionCreate, async (interaction) => {
        if (!interaction.isChatInputCommand()) {
            return;
        }

        if (interaction.commandName === moveCommand.data.name) {
            await moveCommand.execute(interaction);
        }
    });
};
