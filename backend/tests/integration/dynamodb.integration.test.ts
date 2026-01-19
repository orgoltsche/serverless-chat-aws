/**
 * Integration tests for DynamoDB operations
 * These tests run against a local DynamoDB instance (docker-compose)
 *
 * Run with: docker compose run backend npm run test:integration
 */

import { DynamoDBClient, CreateTableCommand, DeleteTableCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, DeleteCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';

// Skip these tests if not running against local DynamoDB
const isIntegrationTest = process.env.DYNAMODB_ENDPOINT !== undefined;

const describeIfIntegration = isIntegrationTest ? describe : describe.skip;

describeIfIntegration('DynamoDB Integration Tests', () => {
  let client: DynamoDBClient;
  let docClient: DynamoDBDocumentClient;
  const CONNECTIONS_TABLE = 'test-connections';
  const MESSAGES_TABLE = 'test-messages';

  beforeAll(async () => {
    client = new DynamoDBClient({
      endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000',
      region: 'eu-central-1',
      credentials: {
        accessKeyId: 'local',
        secretAccessKey: 'local',
      },
    });
    docClient = DynamoDBDocumentClient.from(client);

    // Create test tables
    try {
      await client.send(
        new CreateTableCommand({
          TableName: CONNECTIONS_TABLE,
          KeySchema: [{ AttributeName: 'connectionId', KeyType: 'HASH' }],
          AttributeDefinitions: [{ AttributeName: 'connectionId', AttributeType: 'S' }],
          BillingMode: 'PAY_PER_REQUEST',
        })
      );
    } catch (e: any) {
      if (e.name !== 'ResourceInUseException') throw e;
    }

    try {
      await client.send(
        new CreateTableCommand({
          TableName: MESSAGES_TABLE,
          KeySchema: [
            { AttributeName: 'roomId', KeyType: 'HASH' },
            { AttributeName: 'sortKey', KeyType: 'RANGE' },
          ],
          AttributeDefinitions: [
            { AttributeName: 'roomId', AttributeType: 'S' },
            { AttributeName: 'sortKey', AttributeType: 'S' },
          ],
          BillingMode: 'PAY_PER_REQUEST',
        })
      );
    } catch (e: any) {
      if (e.name !== 'ResourceInUseException') throw e;
    }
  });

  afterAll(async () => {
    // Clean up tables
    try {
      await client.send(new DeleteTableCommand({ TableName: CONNECTIONS_TABLE }));
      await client.send(new DeleteTableCommand({ TableName: MESSAGES_TABLE }));
    } catch (e) {
      // Ignore errors during cleanup
    }
  });

  describe('Connections Table', () => {
    it('should save and retrieve a connection', async () => {
      const connection = {
        connectionId: 'test-conn-1',
        userId: 'user-123',
        username: 'TestUser',
        connectedAt: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 86400,
      };

      // Save
      await docClient.send(
        new PutCommand({
          TableName: CONNECTIONS_TABLE,
          Item: connection,
        })
      );

      // Retrieve
      const result = await docClient.send(
        new GetCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connectionId: connection.connectionId },
        })
      );

      expect(result.Item).toBeDefined();
      expect(result.Item?.userId).toBe('user-123');
      expect(result.Item?.username).toBe('TestUser');
    });

    it('should delete a connection', async () => {
      const connectionId = 'test-conn-delete';

      // First create
      await docClient.send(
        new PutCommand({
          TableName: CONNECTIONS_TABLE,
          Item: { connectionId, userId: 'user', username: 'User', connectedAt: Date.now() },
        })
      );

      // Delete
      await docClient.send(
        new DeleteCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connectionId },
        })
      );

      // Verify deleted
      const result = await docClient.send(
        new GetCommand({
          TableName: CONNECTIONS_TABLE,
          Key: { connectionId },
        })
      );

      expect(result.Item).toBeUndefined();
    });

    it('should scan all connections', async () => {
      // Create multiple connections
      for (let i = 0; i < 3; i++) {
        await docClient.send(
          new PutCommand({
            TableName: CONNECTIONS_TABLE,
            Item: {
              connectionId: `scan-test-${i}`,
              userId: `user-${i}`,
              username: `User${i}`,
              connectedAt: Date.now(),
            },
          })
        );
      }

      const result = await docClient.send(
        new ScanCommand({
          TableName: CONNECTIONS_TABLE,
        })
      );

      expect(result.Items).toBeDefined();
      expect(result.Items!.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Messages Table', () => {
    it('should save and query messages by room', async () => {
      const roomId = 'test-room';
      const messages = [
        { roomId, sortKey: '1000#msg1', messageId: 'msg1', content: 'Hello', userId: 'u1', username: 'User1', createdAt: 1000 },
        { roomId, sortKey: '2000#msg2', messageId: 'msg2', content: 'World', userId: 'u2', username: 'User2', createdAt: 2000 },
      ];

      // Save messages
      for (const msg of messages) {
        await docClient.send(
          new PutCommand({
            TableName: MESSAGES_TABLE,
            Item: msg,
          })
        );
      }

      // Query by room
      const { QueryCommand } = await import('@aws-sdk/lib-dynamodb');
      const result = await docClient.send(
        new QueryCommand({
          TableName: MESSAGES_TABLE,
          KeyConditionExpression: 'roomId = :roomId',
          ExpressionAttributeValues: { ':roomId': roomId },
        })
      );

      expect(result.Items).toBeDefined();
      expect(result.Items!.length).toBe(2);
      expect(result.Items![0].content).toBe('Hello');
      expect(result.Items![1].content).toBe('World');
    });
  });
});
