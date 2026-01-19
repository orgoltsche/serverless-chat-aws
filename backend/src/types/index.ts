/**
 * Type definitions for the Serverless Chat Application.
 * These interfaces define the data structures used across Lambda functions.
 * @module types
 */

/**
 * Represents an active WebSocket connection stored in DynamoDB.
 * Connections are automatically removed after TTL expiration.
 */
export interface Connection {
  /** Unique identifier assigned by API Gateway WebSocket */
  connectionId: string;
  /** User identifier from Cognito or query parameter */
  userId: string;
  /** Display name for the user */
  username: string;
  /** Unix timestamp (milliseconds) when connection was established */
  connectedAt: number;
  /** Unix timestamp (seconds) for DynamoDB TTL auto-deletion */
  ttl: number;
}

/**
 * Represents a chat message stored in DynamoDB.
 * Messages are organized by room and sorted by creation time.
 */
export interface Message {
  /** Room identifier (partition key), defaults to 'global' */
  roomId: string;
  /** Composite sort key: timestamp#messageId for ordering */
  sortKey: string;
  /** Unique message identifier */
  messageId: string;
  /** ID of the user who sent the message */
  userId: string;
  /** Display name of the sender */
  username: string;
  /** The actual message text */
  content: string;
  /** Unix timestamp (milliseconds) when message was created */
  createdAt: number;
}

/**
 * Generic WebSocket message structure for incoming requests.
 * The action field determines which Lambda handler processes the message.
 */
export interface WebSocketMessage {
  /** Action name matching API Gateway route (e.g., 'sendMessage', 'getMessages') */
  action: string;
  /** Optional payload data specific to the action */
  data?: unknown;
}

/**
 * Payload structure for the sendMessage action.
 */
export interface SendMessagePayload {
  /** The message text to send */
  content: string;
  /** Target room ID, defaults to 'global' if not specified */
  roomId?: string;
}

/**
 * Payload structure for the getMessages action.
 */
export interface GetMessagesPayload {
  /** Room ID to fetch messages from, defaults to 'global' */
  roomId?: string;
  /** Maximum number of messages to return, defaults to 50 */
  limit?: number;
}

/**
 * Structure for outgoing WebSocket messages sent to clients.
 * Used by broadcastMessage and sendToConnection functions.
 */
export interface BroadcastMessage {
  /** Message type (e.g., 'newMessage', 'messageHistory') */
  type: string;
  /** Payload data to send to clients */
  data: unknown;
}
