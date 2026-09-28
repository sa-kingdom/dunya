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
        .setDescription("Move this forum post from one board to another.")
        .addStringOption((option) =>
            option
                .setName("from")
                .setDescription("The name of the board to move from. Omit to assign a board to an untagged post.")
                .setRequired(false),
        )
        .addStringOption((option) =>
            option
                .setName("to")
                .setDescription("The name of the board to move to.")
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
        const availableBoards = parent.availableTags;
        const resolveBoard = (name: string) =>
            availableBoards.find(
                (tag) => tag.name.toLowerCase() === name.toLowerCase(),
            );
        const fromName = interaction.options.getString("from");
        const toName = interaction.options.getString("to", true);
        const from = fromName ? resolveBoard(fromName) : undefined;
        const to = resolveBoard(toName);
        if ((fromName && !from) || !to) {
            const notFound = fromName && !from ? fromName : toName;
            const boardList = availableBoards.map((tag) => tag.name).join(", ");
            await interaction.reply({
                content: `Board "${notFound}" not found. Available boards: ${boardList || "(none)"}.`,
                ephemeral: true,
            });
            return;
        }

        if (from && !thread.appliedTags.includes(from.id)) {
            const currentBoards = thread.appliedTags
                .flatMap((tagId) => availableBoards.filter((tag) => tag.id === tagId))
                .map((tag) => tag.name)
                .join(", ");
            await interaction.reply({
                content: `This post is not in board "${fromName}". Current boards: ${currentBoards || "(none)"}.`,
                ephemeral: true,
            });
            return;
        }

        if (from && from.id === to.id) {
            await interaction.reply({
                content: "The source and target boards are the same.",
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
            const nextTags = from ?
                [
                    ...thread.appliedTags.filter((tagId) => tagId !== from.id),
                    to.id,
                ] :
                [...new Set([...thread.appliedTags, to.id])];
            await thread.setAppliedTags(nextTags);
            await interaction.reply(
                from ?
                    `This post has been moved from board "${from.name}" to board "${to.name}".` :
                    `This post has been moved to board "${to.name}".`,
            );
        } catch (error: unknown) {
            console.error("move command failed:", error);
            await interaction.reply({
                content: "Failed to move this post. Please try again later.",
                ephemeral: true,
            });
        }
    },
};
