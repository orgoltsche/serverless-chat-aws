/**
 * DynamoDB Service Module
 *
 * Provides database operations for managing WebSocket connections and chat messages.
 * Uses AWS SDK v3 DynamoDB Document Client for simplified item operations.
 * @module services/dynamodb
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  DeleteCommand,
  QueryCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { Connection, Message } from '../types';

/** DynamoDB low-level client */
const client = new DynamoDBClient({});

/** DynamoDB Document Client with automatic marshalling/unmarshalling */
const docClient = DynamoDBDocumentClient.from(client);

/** Table name for storing active connections (from environment) */
export function getConnectionsTable(): string {
  return process.env.CONNECTIONS_TABLE || 'chat-connections';
}

/** Table name for storing chat messages (from environment) */
export function getMessagesTable(): string {
  return process.env.MESSAGES_TABLE || 'chat-messages';
}

/** Default chat room identifier */
const DEFAULT_ROOM = 'global';

/**
 * Saves a new WebSocket connection to DynamoDB.
 * Called when a client establishes a WebSocket connection.
 *
 * @param connection - Connection details to store
 * @returns Promise that resolves when the connection is saved
 * @throws Error if DynamoDB operation fails
 *
 * @example
 * await saveConnection({
 *   connectionId: 'abc123',
 *   userId: 'user-456',
 *   username: 'John',
 *   connectedAt: Date.now(),
 *   ttl: Math.floor(Date.now() / 1000) + 86400
 * });
 */
export async function saveConnection(connection: Connection): Promise<void> {
  await docClient.send(
    new PutCommand({
      TableName: getConnectionsTable(),
      Item: connection,
    })
  );
}

/**
 * Removes a WebSocket connection from DynamoDB.
 * Called when a client disconnects or connection is detected as stale.
 *
 * @param connectionId - The connection ID to remove
 * @returns Promise that resolves when the connection is deleted
 * @throws Error if DynamoDB operation fails
 *
 * @example
 * await deleteConnection('abc123');
 */
export async function deleteConnection(connectionId: string): Promise<void> {
  await docClient.send(
    new DeleteCommand({
      TableName: getConnectionsTable(),
      Key: { connectionId },
    })
  );
}

/**
 * Retrieves all active WebSocket connections from DynamoDB.
 * Used for broadcasting messages to all connected clients.
 *
 * Note: Uses Scan operation which may be slow for large numbers of connections.
 * Consider pagination for production use with many concurrent users.
 *
 * @returns Promise resolving to array of all active connections
 * @throws Error if DynamoDB operation fails
 *
 * @example
 * const connections = await getAllConnections();
 * console.log(`${connections.length} users online`);
 */
export async function getAllConnections(): Promise<Connection[]> {
  const result = await docClient.send(
    new ScanCommand({
      TableName: getConnectionsTable(),
    })
  );
  return (result.Items as Connection[]) || [];
}

/**
 * Saves a new chat message to DynamoDB.
 * Generates unique messageId and sortKey for proper ordering.
 *
 * @param userId - ID of the user sending the message
 * @param username - Display name of the sender
 * @param content - The message text content
 * @param roomId - Target room ID (defaults to 'global')
 * @returns Promise resolving to the saved Message object with generated fields
 * @throws Error if DynamoDB operation fails
 *
 * @example
 * const message = await saveMessage('user-123', 'Alice', 'Hello world!');
 * console.log(`Message ${message.messageId} saved at ${message.createdAt}`);
 */
export async function saveMessage(
  userId: string,
  username: string,
  content: string,
  roomId: string = DEFAULT_ROOM
): Promise<Message> {
  const now = Date.now();
  const messageId = `${now}-${Math.random().toString(36).substring(2, 9)}`;
  const sortKey = `${now}#${messageId}`;

  const message: Message = {
    roomId,
    sortKey,
    messageId,
    userId,
    username,
    content,
    createdAt: now,
  };

  await docClient.send(
    new PutCommand({
      TableName: getMessagesTable(),
      Item: message,
    })
  );

  return message;
}

/**
 * Retrieves chat messages from a specific room.
 * Messages are returned in chronological order (oldest first).
 *
 * @param roomId - Room ID to fetch messages from (defaults to 'global')
 * @param limit - Maximum number of messages to return (defaults to 50)
 * @returns Promise resolving to array of messages sorted by creation time
 * @throws Error if DynamoDB operation fails
 *
 * @example
 * const messages = await getMessages('global', 100);
 * messages.forEach(msg => console.log(`${msg.username}: ${msg.content}`));
 */
export async function getMessages(
  roomId: string = DEFAULT_ROOM,
  limit: number = 50
): Promise<Message[]> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: getMessagesTable(),
      KeyConditionExpression: 'roomId = :roomId',
      ExpressionAttributeValues: {
        ':roomId': roomId,
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  const messages = (result.Items as Message[]) || [];
  return messages.reverse();
}
