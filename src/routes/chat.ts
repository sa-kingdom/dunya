// Asuna - A blazing-fast, progressive microservice framework.
// SPDX-License-Identifier: BSD-3-Clause (https://ncurl.xyz/s/mI23sevHR)

import { Router } from 'itty-router';
import { StatusCodes } from 'http-status-codes';
import { nanoid } from 'nanoid';
import jwt from 'jsonwebtoken';

import {
  type AsunaRegister,
  rootRouter,
} from '../init/router.ts';
import {
  type ChatContext,
  chatWithAI,
} from '../agents/chat.ts';

const channelType = 'chat';
const channelName = 'Web Chat';
const JWT_ALGORITHM = 'HS256';

/**
 * Get the symmetric secret key used for HS256 JWT tokens.
 * @returns Secret key string.
 */
function getJwtSecret(): string {
  return Bun.env.JWT_SECRET || Bun.env.SOUL_ID || 'dunya-jwt-secret-key';
}

// Create router instance
const router = Router({
  base: '/chat',
});

/**
 * GET /chat/session
 * Generate a new session ID and issue an initial HS256 Bearer access token.
 */
router.get('/session', async (): Promise<Response> => {
  const sessionId = nanoid();
  const secret = getJwtSecret();

  const token = jwt.sign(
    { sub: sessionId, sessionId },
    secret,
    { algorithm: JWT_ALGORITHM, expiresIn: '1h' },
  );

  return new Response(
    JSON.stringify({ sessionId, token }),
    { headers: { 'Content-Type': 'application/json' } },
  );
});

interface ChatMessageRequestPayload {
    token?: string;
    sessionId?: string;
    displayName?: string;
    content?: string;
    message?: string;
    locale?: string;
}

/**
 * POST /chat/message
 * Verify HS256 Bearer token and process chat message without frontend signing.
 */
router.post('/message', async (request: Request): Promise<Response> => {
  let payload: ChatMessageRequestPayload;
  try {
    payload = await request.json() as ChatMessageRequestPayload;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Bad Request' }),
      { status: StatusCodes.BAD_REQUEST, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Extract Bearer token from Authorization header or request body
  const authHeader = request.headers.get('Authorization');
  let token = payload.token;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  }

  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Bearer token is required' }),
      {
        status: StatusCodes.UNAUTHORIZED,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer',
        },
      },
    );
  }

  // Verify JWT token with HS256 only
  let claims: Record<string, any>;
  try {
    claims = jwt.verify(token, getJwtSecret(), {
      algorithms: [JWT_ALGORITHM],
    }) as Record<string, any>;
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid access token' }),
      {
        status: StatusCodes.UNAUTHORIZED,
        headers: {
          'Content-Type': 'application/json',
          'WWW-Authenticate': 'Bearer',
        },
      },
    );
  }

  const inputContent = (payload.content || payload.message || '').trim();
  if (!inputContent) {
    return new Response(
      JSON.stringify({ error: 'content is required' }),
      { status: StatusCodes.BAD_REQUEST, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Extract user profile and session identity from claims
  const userId = String(claims.sub || claims.id || claims.userId || 'anonymous');
  let displayName = payload.displayName;
  if (!displayName) {
    if (claims.given_name && claims.family_name) {
      displayName = `${claims.given_name} ${claims.family_name}`.trim();
    } else if (claims.name) {
      displayName = String(claims.name);
    } else if (claims.displayName) {
      displayName = String(claims.displayName);
    } else if (claims.username) {
      displayName = String(claims.username);
    } else {
      displayName = 'User';
    }
  }

  const sessionId = payload.sessionId || claims.sessionId || String(claims.sub || nanoid());
  const localeCode = payload.locale || claims.locale || 'zh-TW';

  const chatContext: ChatContext = {
    channelId: sessionId,
    channelName,
    channelType,
    userId,
    displayName,
    localeCode,
    title: claims.title,
    groups: claims.groups,
    scope: claims.scope,
  };

  try {
    const outputContent = await chatWithAI(chatContext, inputContent);

    return new Response(
      JSON.stringify({
        sessionId,
        content: outputContent,
      }),
      {
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('Failed to generate AI response:', error);
    return new Response(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: StatusCodes.INTERNAL_SERVER_ERROR, headers: { 'Content-Type': 'application/json' } },
    );
  }
});

// Export asuna register
const register: AsunaRegister = () => {
  // Register the routes with the root router
  rootRouter.all('/chat/*', router.fetch);
};

export default register;
