import { ChannelType, Events, GuildMember, Message } from 'discord.js';
import { useClient } from '../init/discord.ts';
import { type ChatContext, chatWithAI } from '../agents/chat.ts';
import { getMust } from '../config.ts';
import { sliceContent } from '../utils/text.ts';
import Discussion from '../models/discussion.ts';
import Media from '../models/media.ts';
import Post, { messageToPost } from '../models/post.ts';
import PostMedia from '../models/post_media.ts';
import User, { memberToUser } from '../models/user.ts';
import Member from '../models/member.ts';
import { useSequelize } from '../init/sequelize.ts';

const client = useClient();
const guildId = getMust('DISCORD_GUILD_ID');

/**
 *
 * @param message
 */
async function syncMessage(message: Message): Promise<void> {
  try {
    if (
      !message.guild ||
            message.guild.id !== guildId ||
            message.channel.type !== ChannelType.PublicThread
    ) {
      return;
    }

    if (!await Discussion.findByPk(message.channel.id)) {
      return;
    }

    const authorMember = message.member || await message.guild.members.fetch(message.author.id);
    const authorUser = await memberToUser(authorMember as GuildMember);
    await User.upsert(authorUser);
    await Member.syncMetadata(message, authorMember as GuildMember);

    const postData = await messageToPost(message);
    const sequelize = useSequelize();
    await sequelize.transaction(async (t) => {
      if (postData.media.length > 0) {
        await Media.bulkCreate(postData.media, {
          updateOnDuplicate: [
            'name', 'description', 'contentType', 'size',
            'url', 'proxyUrl', 'height', 'width',
            'ephemeral', 'duration', 'waveform',
          ],
          transaction: t,
        });
      }

      const { media: _media, ...postRow } = postData;
      await Post.upsert(postRow, { transaction: t });

      if (postData.media.length > 0) {
        const seenMediumIds = new Set<string>();
        const postMediaLinks: {postId: string; mediumId: string}[] = [];
        for (const m of postData.media) {
          if (!seenMediumIds.has(m.id)) {
            seenMediumIds.add(m.id);
            postMediaLinks.push({ postId: message.id, mediumId: m.id });
          }
        }
        await PostMedia.bulkCreate(postMediaLinks, {
          ignoreDuplicates: true,
          transaction: t,
        });
      }
    });
  } catch (error) {
    console.error('Failed to sync message:', error);
  }
}

/**
 *
 * @param message
 */
async function replyMessage(message: Message): Promise<void> {
  if (message.author.bot || message.guildId !== guildId) {
    return;
  }

  if (!client.user || !message.mentions.has(client.user)) {
    return;
  }

  const cleanContent = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim();
  if (!cleanContent) return;

  // Trigger typing indicator
  if ('sendTyping' in message.channel) {
    await message.channel.sendTyping();
  }

  // Gather context about the message and the author to provide to the agent
  const context: ChatContext = {
    guildId: message.guildId || '(none)',
    channelId: message.channelId,
    channelLocale: message.guild?.preferredLocale || 'zh-TW',
    userId: message.author.id,
    displayName:
            message.member?.nickname ||
            message.member?.displayName ||
            message.author.username,
    authorUsername: message.author.username,
    referMessageId: message.id,
  };
  if (message.reference) {
    try {
      const referencedMessage = await message.fetchReference();
      context.referencedMessageAuthorName = referencedMessage.author.username;
      context.referencedMessageContent = referencedMessage.content;
    } catch (error) {
      console.warn('Failed to fetch referenced message:', error);
    }
  }

  try {
    const responseText = await chatWithAI(context, cleanContent);

    // Reply to the user, slicing into snippets if too long (2000 chars limit on Discord)
    const snippets = sliceContent(responseText, 1900);
    if (snippets.length > 0) {
      const firstSnippet = snippets.shift();
      await message.reply(firstSnippet || 'No response content.');
    }
    for (const snippet of snippets) {
      await message.channel.send(snippet);
    }
  } catch (error) {
    console.error('Agent error:', error);
    await message.reply('Oops, something went wrong while thinking! (>_<)');
  }
}

export default (): void => {
  client.on(Events.MessageCreate, async (message: Message) => {
    await Promise.allSettled([
      syncMessage(message),
      replyMessage(message),
    ]);
  });
};
