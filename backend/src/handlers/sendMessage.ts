/**
 * WebSocket Send Message Handler
 *
 * Lambda function that handles the sendMessage route when a client
 * sends a chat message via WebSocket.
 * @module handlers/sendMessage
 */

import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { saveMessage, getAllConnections } from '../services/dynamodb';
import { initApiGatewayClient, broadcastMessage } from '../services/websocket';
import { SendMessagePayload, Connection } from '../types';

/**
 * Handles sending a chat message.
 *
 * Validates the message content, saves it to DynamoDB, and broadcasts
 * it to all connected clients.
 *
 * Expected message format:
 * ```json
 * {
 *   "action": "sendMessage",
 *   "data": {
 *     "content": "Hello world!",
 *     "roomId": "global"  // optional, defaults to 'global'
 *   }
 * }
 * ```
 *
 * @param event - API Gateway WebSocket event with message payload
 * @returns Response with status 200 and messageId on success, 400/500 on error
 *
 * @example
 * // Success response:
 * // { statusCode: 200, body: '{"success":true,"messageId":"1234-abc"}' }
 *
 * // Error responses:
 * // { statusCode: 400, body: '{"error":"Message content is required"}' }
 * // { statusCode: 400, body: '{"error":"Connection not found"}' }
 */
export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  console.log('SendMessage event:', JSON.stringify(event, null, 2));

  const connectionId = event.requestContext.connectionId;
  const { domainName, stage } = event.requestContext;
  const endpoint = `https://${domainName}/${stage}`;

  initApiGatewayClient(endpoint);

  try {
    const body = JSON.parse(event.body || '{}');
    const { content, roomId = 'global' } = (body.data || {}) as SendMessagePayload;

    if (!content || typeof content !== 'string' || content.trim() === '') {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Message content is required' }),
      };
    }

    const connections = await getAllConnections();
    const sender = connections.find(
      (conn: Connection) => conn.connectionId === connectionId
    );

    if (!sender) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Connection not found' }),
      };
    }

    const message = await saveMessage(
      sender.userId,
      sender.username,
      content.trim(),
      roomId
    );

    await broadcastMessage({
      type: 'newMessage',
      data: message,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, messageId: message.messageId }),
    };
  } catch (error) {
    console.error('Error sending message:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send message' }),
    };
  }
};
