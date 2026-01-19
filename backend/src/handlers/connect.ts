/**
 * WebSocket Connect Handler
 *
 * Lambda function that handles the $connect route when a client
 * establishes a WebSocket connection to the API Gateway.
 * @module handlers/connect
 */

import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { saveConnection } from '../services/dynamodb';

/**
 * Extended WebSocket event type that includes query string parameters.
 * API Gateway sends these on $connect but they're not in the base type definition.
 */
interface WebSocketConnectEvent {
  requestContext: {
    connectionId: string;
    domainName: string;
    stage: string;
  };
  queryStringParameters?: Record<string, string>;
}

/**
 * Handles WebSocket connection establishment.
 *
 * Extracts user information from query parameters and stores the connection
 * in DynamoDB with a 24-hour TTL for automatic cleanup of stale connections.
 *
 * Query Parameters:
 * - userId: User identifier (defaults to 'anonymous')
 * - username: Display name (defaults to 'Anonymous')
 *
 * @param event - API Gateway WebSocket connect event
 * @returns Response with status 200 on success, 500 on error
 *
 * @example
 * // Client connects with:
 * // wss://api-id.execute-api.region.amazonaws.com/stage?userId=123&username=John
 */
export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  console.log('Connect event:', JSON.stringify(event, null, 2));

  // Cast event to include queryStringParameters (present on $connect but not in base type)
  const connectEvent = event as unknown as WebSocketConnectEvent;
  const connectionId = event.requestContext.connectionId;
  const queryParams = connectEvent.queryStringParameters || {};

  const userId = queryParams.userId || 'anonymous';
  const username = queryParams.username || 'Anonymous';

  const now = Date.now();
  const ttl = Math.floor(now / 1000) + 24 * 60 * 60;

  try {
    await saveConnection({
      connectionId,
      userId,
      username,
      connectedAt: now,
      ttl,
    });

    console.log(`Connection ${connectionId} saved for user ${username}`);

    return {
      statusCode: 200,
      body: 'Connected',
    };
  } catch (error) {
    console.error('Error saving connection:', error);
    return {
      statusCode: 500,
      body: 'Failed to connect',
    };
  }
};
