/**
 * WebSocket Disconnect Handler
 *
 * Lambda function that handles the $disconnect route when a client
 * closes their WebSocket connection to the API Gateway.
 * @module handlers/disconnect
 */

import { APIGatewayProxyWebsocketHandlerV2 } from 'aws-lambda';
import { deleteConnection } from '../services/dynamodb';

/**
 * Handles WebSocket disconnection.
 *
 * Removes the connection record from DynamoDB when a client disconnects.
 * This can happen due to client-initiated close, network issues, or timeout.
 *
 * Note: This handler may not always be called (e.g., sudden network loss),
 * which is why connections have a TTL for automatic cleanup.
 *
 * @param event - API Gateway WebSocket disconnect event
 * @returns Response with status 200 on success, 500 on error
 */
export const handler: APIGatewayProxyWebsocketHandlerV2 = async (event) => {
  console.log('Disconnect event:', JSON.stringify(event, null, 2));

  const connectionId = event.requestContext.connectionId;

  try {
    await deleteConnection(connectionId);
    console.log(`Connection ${connectionId} removed`);

    return {
      statusCode: 200,
      body: 'Disconnected',
    };
  } catch (error) {
    console.error('Error removing connection:', error);
    return {
      statusCode: 500,
      body: 'Failed to disconnect',
    };
  }
};
