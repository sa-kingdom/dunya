import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ChannelType,
    PermissionsBitField,
    ThreadChannel,
    ForumChannel,
} from "discord.js";
import {getMust, get} from "../config.ts";

const channelIdForum = getMust("DISCORD_CHANNEL_ID_FORUM");

/**
 * Get the moderator role IDs allowed to move posts.
 * @returns Array of role IDs.
 */
const getModeratorRoleIds = (): string[] => {
    return (get("DISCORD_MODERATOR_ROLE_IDS") || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
};

/**
 * Check whether the user may move the given thread.
 * Allowed for the thread author, configured moderator roles,
 * and members with the "Manage Threads" permission.
 * @param interaction - The chat input command interaction.
 * @param thread - The forum thread to move.
 * @returns True when the user is allowed to move the thread.
 */
async function canMove(
    interaction: ChatInputCommandInteraction,
    thread: ThreadChannel,
): Promise<boolean> {
    if (thread.ownerId === interaction.user.id) {
        return true;
    }
    const member = await interaction.guild?.members.fetch(interaction.user.id);
    if (!member) {
        return false;
    }
    if (member.permissions.has(PermissionsBitField.Flags.ManageThreads)) {
        return true;
    }
    return getModeratorRoleIds().some((id) => member.roles.cache.has(id));
}

export const moveCommand = {
    data: new SlashCommandBuilder()
        .setName("move")
        .setDescription("Move this forum post to a board (forum tag).")
        .addStringOption((option) =>
            option
                .setName("board")
                .setDescription("The name of the target board.")
                .setRequired(true),
        ),

    /**
     * Execute the move command.
     * @param interaction - The chat input command interaction.
     */
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
        const channel = interaction.channel;
        if (
            !channel ||
            !channel.isThread() ||
            !channel.parent ||
            channel.parent.id !== channelIdForum ||
            channel.parent.type !== ChannelType.GuildForum
        ) {
            await interaction.reply({
                content: "This command can only be used inside a forum post.",
                ephemeral: true,
            });
            return;
        }

        const thread = channel;
        const parent = thread.parent as ForumChannel;
        const boardName = interaction.options.getString("board", true);
        const availableBoards = parent.availableTags;
        const target = availableBoards.find(
            (tag) => tag.name.toLowerCase() === boardName.toLowerCase(),
        );
        if (!target) {
            const boardList = availableBoards.map((tag) => tag.name).join(", ");
            await interaction.reply({
                content: `Board "${boardName}" not found. Available boards: ${boardList || "(none)"}.`,
                ephemeral: true,
            });
            return;
        }

        if (!await canMove(interaction, thread)) {
            await interaction.reply({
                content: "Only the post author or moderators can move this post.",
                ephemeral: true,
            });
            return;
        }

        try {
            await thread.setAppliedTags([target.id]);
            await interaction.reply(`This post has been moved to board "${target.name}".`);
        } catch (error: unknown) {
            console.error("move command failed:", error);
            await interaction.reply({
                content: "Failed to move this post. Please try again later.",
                ephemeral: true,
            });
        }
    },
};
