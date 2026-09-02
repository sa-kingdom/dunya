import { useSequelize } from '../init/sequelize.ts';
import { DataTypes, Model } from 'sequelize';
import type { Message } from 'discord.js';
import { attachmentToMedia, embedToMedia, stickerToMedia } from './media.ts';

const sequelize = useSequelize();

/**
 * Post Model
 */
export default class Post extends Model {
  declare id: string;
  declare content: string;
  declare userId: string;
  declare discussionId: string;
}

Post.init({
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  content: DataTypes.TEXT,
}, {
  sequelize,
  modelName: 'post',
  paranoid: true,
});

/**
 *
 * @param message
 * @param isForceRefresh
 */
export async function messageToPost(
  message: Message,
  isForceRefresh: boolean = false,
): Promise<{
    id: string;
    content: string;
    userId: string;
    createdAt: number;
    discussionId: string;
    media: Awaited<ReturnType<typeof attachmentToMedia>>[];
}> {
  const {
    id,
    content,
    author,
    createdTimestamp: createdAt,
    channelId: discussionId,
    attachments,
    stickers,
    embeds,
  } = message;

  const { id: userId } = author;
  const mediaAttachments = await Promise.all(
    Array.from(attachments.values()).map(
      (attachment) => attachmentToMedia(attachment, isForceRefresh),
    ),
  );
  const mediaStickers = await Promise.all(
    Array.from(stickers.values()).map(
      (sticker) => stickerToMedia(sticker, isForceRefresh),
    ),
  );
  const mediaEmbedsRaw = await Promise.all(
    (embeds || []).map((embed, idx) => embedToMedia(embed, id, idx, isForceRefresh)),
  );
  const mediaEmbeds = mediaEmbedsRaw.filter(
    (m): m is NonNullable<typeof m> => m !== null,
  );
  const media = [...mediaAttachments, ...mediaStickers, ...mediaEmbeds];

  return {
    id,
    content,
    userId,
    createdAt,
    discussionId,
    media,
  };
}
