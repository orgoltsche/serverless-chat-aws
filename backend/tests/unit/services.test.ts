/**
 * Service Layer Unit Tests
 *
 * Tests for DynamoDB and WebSocket service functions.
 */

process.env.CONNECTIONS_TABLE = 'test-connections';
process.env.MESSAGES_TABLE = 'test-messages';

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockDynamoSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({ send: mockDynamoSend }),
    },
    PutCommand: jest.fn().mockImplementation((params) => params),
    DeleteCommand: jest.fn().mockImplementation((params) => params),
    QueryCommand: jest.fn().mockImplementation((params) => params),
    ScanCommand: jest.fn().mockImplementation((params) => params),
    __mockDynamoSend: mockDynamoSend,
  };
});

jest.mock('@aws-sdk/client-apigatewaymanagementapi', () => {
  const mockApiGatewaySend = jest.fn();
  return {
    ApiGatewayManagementApiClient: jest.fn().mockImplementation(() => ({
      send: mockApiGatewaySend,
    })),
    PostToConnectionCommand: jest.fn().mockImplementation((params) => params),
    GoneException: class GoneException extends Error {
      constructor() {
        super('Gone');
        this.name = 'GoneException';
      }
    },
    __mockApiGatewaySend: mockApiGatewaySend,
  };
});

const { __mockDynamoSend: mockDynamoSend } = jest.requireMock('@aws-sdk/lib-dynamodb');
const { __mockApiGatewaySend: mockApiGatewaySend } = jest.requireMock('@aws-sdk/client-apigatewaymanagementapi');

import {
  saveConnection,
  deleteConnection,
  getAllConnections,
  saveMessage,
  getMessages,
  getConnectionsTable,
  getMessagesTable,
} from '../../src/services/dynamodb';

import {
  initApiGatewayClient,
  sendToConnection,
  broadcastMessage,
} from '../../src/services/websocket';

describe('DynamoDB Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDynamoSend.mockResolvedValue({});
  });

  describe('table name helpers', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env.CONNECTIONS_TABLE = originalEnv.CONNECTIONS_TABLE || 'test-connections';
      process.env.MESSAGES_TABLE = originalEnv.MESSAGES_TABLE || 'test-messages';
    });

    it('returns env-based table names', () => {
      process.env.CONNECTIONS_TABLE = 'custom-connections';
      process.env.MESSAGES_TABLE = 'custom-messages';

      expect(getConnectionsTable()).toBe('custom-connections');
      expect(getMessagesTable()).toBe('custom-messages');
    });

    it('falls back to defaults when env missing', () => {
      delete process.env.CONNECTIONS_TABLE;
      delete process.env.MESSAGES_TABLE;

      expect(getConnectionsTable()).toBe('chat-connections');
      expect(getMessagesTable()).toBe('chat-messages');
    });
  });

  describe('saveConnection', () => {
    it('should save connection to DynamoDB', async () => {
      const connection = {
        connectionId: 'conn-123',
        userId: 'user-456',
        username: 'TestUser',
        connectedAt: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 86400,
      };

      await saveConnection(connection);

      expect(mockDynamoSend).toHaveBeenCalledTimes(1);
      const callArg = mockDynamoSend.mock.calls[0][0];
      expect(callArg.TableName).toBe('test-connections');
      expect(callArg.Item).toEqual(connection);
    });
  });

  describe('deleteConnection', () => {
    it('should delete connection from DynamoDB', async () => {
      await deleteConnection('conn-to-delete');

      expect(mockDynamoSend).toHaveBeenCalledTimes(1);
      const callArg = mockDynamoSend.mock.calls[0][0];
      expect(callArg.TableName).toBe('test-connections');
      expect(callArg.Key).toEqual({ connectionId: 'conn-to-delete' });
    });
  });

  describe('getAllConnections', () => {
    it('should return all connections', async () => {
      const mockConnections = [
        { connectionId: 'conn-1', userId: 'user-1' },
        { connectionId: 'conn-2', userId: 'user-2' },
      ];
      mockDynamoSend.mockResolvedValueOnce({ Items: mockConnections });

      const result = await getAllConnections();

      expect(result).toEqual(mockConnections);
      expect(mockDynamoSend).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no connections', async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: undefined });

      const result = await getAllConnections();

      expect(result).toEqual([]);
    });
  });

  describe('saveMessage', () => {
    it('should save message with generated ID and timestamp', async () => {
      const beforeTime = Date.now();

      const result = await saveMessage('user-123', 'TestUser', 'Hello World', 'global');

      expect(result.roomId).toBe('global');
      expect(result.userId).toBe('user-123');
      expect(result.username).toBe('TestUser');
      expect(result.content).toBe('Hello World');
      expect(result.createdAt).toBeGreaterThanOrEqual(beforeTime);
      expect(result.messageId).toBeDefined();
      expect(result.sortKey).toContain('#');
    });

    it('should use default room when not provided', async () => {
      const result = await saveMessage('user-123', 'TestUser', 'Hello');

      expect(result.roomId).toBe('global');
    });
  });

  describe('getMessages', () => {
    it('should query messages by room', async () => {
      const mockMessages = [
        { roomId: 'global', content: 'Second', createdAt: 2000 },
        { roomId: 'global', content: 'First', createdAt: 1000 },
      ];
      mockDynamoSend.mockResolvedValueOnce({ Items: mockMessages });

      const result = await getMessages('global', 50);

      // Should be reversed (oldest first)
      expect(result[0].content).toBe('First');
      expect(result[1].content).toBe('Second');
    });

    it('should use default values', async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: [] });

      await getMessages();

      const callArg = mockDynamoSend.mock.calls[0][0];
      expect(callArg.ExpressionAttributeValues[':roomId']).toBe('global');
      expect(callArg.Limit).toBe(50);
    });

    it('should return empty array when no messages', async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: undefined });

      const result = await getMessages();

      expect(result).toEqual([]);
    });
  });
});

describe('WebSocket Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGatewaySend.mockResolvedValue({});
    mockDynamoSend.mockResolvedValue({});
  });

  describe('initApiGatewayClient', () => {
    it('should initialize without error', () => {
      expect(() => initApiGatewayClient('https://test.com')).not.toThrow();
    });
  });

  describe('sendToConnection', () => {
    beforeEach(() => {
      initApiGatewayClient('https://test.execute-api.com/dev');
    });

    it('should send message to connection', async () => {
      const result = await sendToConnection('conn-123', {
        type: 'test',
        data: { message: 'Hello' },
      });

      expect(result).toBe(true);
      expect(mockApiGatewaySend).toHaveBeenCalledTimes(1);
    });

    it('should handle GoneException by deleting connection', async () => {
      const { GoneException } = jest.requireMock('@aws-sdk/client-apigatewaymanagementapi');
      mockApiGatewaySend.mockRejectedValueOnce(new GoneException());

      const result = await sendToConnection('gone-conn', {
        type: 'test',
        data: {},
      });

      expect(result).toBe(false);
      expect(mockDynamoSend).toHaveBeenCalledTimes(1); // deleteConnection called
    });

    it('should throw on other errors', async () => {
      mockApiGatewaySend.mockRejectedValueOnce(new Error('Network error'));

      await expect(
        sendToConnection('conn-123', { type: 'test', data: {} })
      ).rejects.toThrow('Network error');
    });

    it('should throw if client not initialized', async () => {
      jest.resetModules();
      const { sendToConnection: freshSendToConnection } = await import('../../src/services/websocket');

      await expect(
        freshSendToConnection('conn-123', { type: 'test', data: {} })
      ).rejects.toThrow('API Gateway client not initialized');
    });
  });

  describe('broadcastMessage', () => {
    beforeEach(() => {
      initApiGatewayClient('https://test.execute-api.com/dev');
    });

    it('should send to all connections', async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Items: [
          { connectionId: 'conn-1' },
          { connectionId: 'conn-2' },
          { connectionId: 'conn-3' },
        ],
      });

      await broadcastMessage({ type: 'broadcast', data: 'Hello all' });

      expect(mockApiGatewaySend).toHaveBeenCalledTimes(3);
    });

    it('should exclude specified connection', async () => {
      mockDynamoSend.mockResolvedValueOnce({
        Items: [
          { connectionId: 'conn-1' },
          { connectionId: 'conn-2' },
          { connectionId: 'excluded-conn' },
        ],
      });

      await broadcastMessage(
        { type: 'broadcast', data: 'Hello' },
        'excluded-conn'
      );

      expect(mockApiGatewaySend).toHaveBeenCalledTimes(2);
    });

    it('should handle empty connections list', async () => {
      mockDynamoSend.mockResolvedValueOnce({ Items: [] });

      await broadcastMessage({ type: 'test', data: {} });

      expect(mockApiGatewaySend).not.toHaveBeenCalled();
    });
  });
});
