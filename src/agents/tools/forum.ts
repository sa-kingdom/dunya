import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { Op } from 'sequelize';
import Discussion from '../../models/discussion.ts';
import Post from '../../models/post.ts';
import User from '../../models/user.ts';

/**
 * Tool for searching forum discussions (threads) by keyword in their name.
 */
export function createForumSearchDiscussionsTool() {
  return tool(
    async ({ query, limit = 20 }) => {
      console.info('[tool] forum_search_discussions', { query, limit });
      try {
        const where = query
          ? { name: { [Op.like]: `%${query}%` } }
          : {};
        const discussions = await Discussion.findAll({
          where,
          limit,
          order: [['createdAt', 'DESC']],
        });
        if (discussions.length === 0) {
          return `No discussions matching "${query}" found.`;
        }
        return discussions
          .map(
            (d) =>
              `ID: ${d.id} | Name: ${d.name} | Messages: ${d.messageCount ?? 0} | Members: ${d.memberCount ?? 0}`,
          )
          .join('\n');
      } catch (error: unknown) {
        console.error('[tool] forum_search_discussions failed:', error);
        return `Failed to search discussions: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    },
    {
      name: 'forum_search_discussions',
      description:
                'Search the persistent forum archive for discussions (threads) whose name contains a keyword. Omit the query to list recent discussions. Returns discussion IDs, names, message and member counts.',
      schema: z.object({
        query: z
          .string()
          .optional()
          .describe('Keyword to search for in discussion titles. Empty lists recent discussions.'),
        limit: z
          .number()
          .optional()
          .default(20)
          .describe('Maximum number of discussions to return'),
      }),
    },
  );
}

/**
 * Tool for retrieving posts (messages) of a specific forum discussion by its ID.
 */
export function createForumGetPostsTool() {
  return tool(
    async ({ discussionId, limit = 50 }) => {
      console.info('[tool] forum_get_posts', { discussionId, limit });
      try {
        const discussion = await Discussion.findByPk(discussionId);
        if (!discussion) {
          return `Discussion ${discussionId} not found in the archive.`;
        }

        const posts = await Post.findAll({
          where: { discussionId },
          include: [{ model: User, required: false }],
          limit,
          order: [['createdAt', 'ASC']],
        });
        if (posts.length === 0) {
          return `Discussion "${discussion.name}" has no archived posts.`;
        }

        const header = `Discussion: ${discussion.name} (ID: ${discussion.id}, ${posts.length} posts)`;
        const body = posts
          .map((p) => {
            const author = (p as any).User;
            const authorName = author?.displayName || author?.username || p.userId;
            const ts = (p as any).createdAt
              ? new Date((p as any).createdAt).toLocaleString()
              : '(unknown date)';
            return `[${ts}] ${authorName}: ${p.content || '(empty)'}`;
          })
          .join('\n');
        return `${header}\n${body}`;
      } catch (error: unknown) {
        console.error('[tool] forum_get_posts failed:', error);
        return `Failed to get posts: ${
          error instanceof Error ? error.message : String(error)
        }`;
      }
    },
    {
      name: 'forum_get_posts',
      description:
                'Retrieve the archived posts (messages) of a specific forum discussion by its discussion (thread) ID. Returns author names, timestamps and content.',
      schema: z.object({
        discussionId: z.string().describe('The ID of the forum discussion (thread)'),
        limit: z
          .number()
          .optional()
          .default(50)
          .describe('Maximum number of posts to return'),
      }),
    },
  );
}
