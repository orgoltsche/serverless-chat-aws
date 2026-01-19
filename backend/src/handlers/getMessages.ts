/**
 * WebSocket Get Messages Handler
 *
 * Lambda function that handles the getMessages route when a client
 * requests chat message history via WebSocket.
 * @module handlers/getMessages
 */

import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { getMessages } from '../services/dynamodb';
import { initApiGatewayClient, sendToConnection } from '../services/websocket';
import { GetMessagesPayload } from '../types';

/**
 * Handles fetching message history.
 *
 * Retrieves messages from DynamoDB for the specified room and sends them
 * back to the requesting client via WebSocket.
 *
 * Expected message format:
 * ```json
 * {
 *   "action": "getMessages",
 *   "data": {
 *     "roomId": "global",  // optional, defaults to 'global'
 *     "limit": 50          // optional, defaults to 50, max 100
 *   }
 * }
 * ```
 *
 * Response sent to client:
 * ```json
 * {
 *   "type": "messageHistory",
 *   "data": [
 *     { "messageId": "...", "content": "...", ... },
 *     ...
 *   ]
 * }
 * ```
 *
 * @param event - API Gateway WebSocket event with optional query parameters
 * @returns Response with status 200 on success, 500 on error
 */
export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  console.log('GetMessages event:', JSON.stringify(event, null, 2));

  const connectionId = event.requestContext.connectionId;
  const { domainName, stage } = event.requestContext;
  const endpoint = `https://${domainName}/${stage}`;

  initApiGatewayClient(endpoint);

  try {
    const body = JSON.parse(event.body || '{}');
    const { roomId = 'global', limit = 50 } = (body.data ||
      {}) as GetMessagesPayload;

    const messages = await getMessages(roomId, Math.min(limit, 100));

    await sendToConnection(connectionId, {
      type: 'messageHistory',
      data: messages,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Error getting messages:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to get messages' }),
    };
  }
};
