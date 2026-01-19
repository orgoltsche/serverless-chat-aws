/**
 * WebSocket Service Module
 *
 * Provides functions for sending messages to connected WebSocket clients
 * via AWS API Gateway Management API.
 * @module services/websocket
 */

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from '@aws-sdk/client-apigatewaymanagementapi';
import { deleteConnection, getAllConnections } from './dynamodb';
import { BroadcastMessage, Connection } from '../types';

/** Singleton API Gateway Management API client instance */
let apiGatewayClient: ApiGatewayManagementApiClient | null = null;

/**
 * Initializes the API Gateway Management API client.
 * Must be called before sending messages to connections.
 *
 * @param endpoint - The WebSocket API endpoint URL (e.g., 'https://abc123.execute-api.region.amazonaws.com/stage')
 *
 * @example
 * const endpoint = `https://${domainName}/${stage}`;
 * initApiGatewayClient(endpoint);
 */
export function initApiGatewayClient(endpoint: string): void {
  apiGatewayClient = new ApiGatewayManagementApiClient({
    endpoint,
  });
}

/**
 * Sends a message to a specific WebSocket connection.
 * Automatically cleans up stale connections that are no longer active.
 *
 * @param connectionId - Target connection ID to send the message to
 * @param data - Message payload to send
 * @returns Promise resolving to true if sent successfully, false if connection was gone
 * @throws Error if client not initialized or network error (non-GoneException)
 *
 * @example
 * const success = await sendToConnection('abc123', {
 *   type: 'messageHistory',
 *   data: messages
 * });
 * if (!success) {
 *   console.log('Connection was stale, removed from database');
 * }
 */
export async function sendToConnection(
  connectionId: string,
  data: BroadcastMessage
): Promise<boolean> {
  if (!apiGatewayClient) {
    throw new Error('API Gateway client not initialized');
  }

  try {
    await apiGatewayClient.send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: Buffer.from(JSON.stringify(data)),
      })
    );
    return true;
  } catch (error) {
    if (error instanceof GoneException) {
      console.log(`Connection ${connectionId} is gone, removing from table`);
      await deleteConnection(connectionId);
      return false;
    }
    throw error;
  }
}

/**
 * Broadcasts a message to all connected WebSocket clients.
 * Optionally excludes a specific connection (useful for not echoing back to sender).
 *
 * Uses Promise.allSettled to ensure all sends are attempted even if some fail.
 * Stale connections are automatically cleaned up via sendToConnection.
 *
 * @param data - Message payload to broadcast
 * @param excludeConnectionId - Optional connection ID to exclude from broadcast
 * @returns Promise that resolves when all send attempts complete
 *
 * @example
 * // Broadcast to all users
 * await broadcastMessage({
 *   type: 'newMessage',
 *   data: message
 * });
 *
 * // Broadcast to all except sender
 * await broadcastMessage({
 *   type: 'newMessage',
 *   data: message
 * }, senderConnectionId);
 */
export async function broadcastMessage(
  data: BroadcastMessage,
  excludeConnectionId?: string
): Promise<void> {
  const connections = await getAllConnections();

  const sendPromises = connections
    .filter((conn: Connection) => conn.connectionId !== excludeConnectionId)
    .map((conn: Connection) => sendToConnection(conn.connectionId, data));

  await Promise.allSettled(sendPromises);
}
