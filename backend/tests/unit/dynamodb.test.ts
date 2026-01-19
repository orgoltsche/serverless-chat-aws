import { Connection, Message } from '../../src/types';

// Mock AWS SDK
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({ send: mockSend }),
    },
    PutCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'Put' })),
    DeleteCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'Delete' })),
    QueryCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'Query' })),
    ScanCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'Scan' })),
    __mockSend: mockSend,
  };
});

describe('DynamoDB Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CONNECTIONS_TABLE = 'test-connections';
    process.env.MESSAGES_TABLE = 'test-messages';
  });

  describe('Connection Types', () => {
    it('should have correct Connection type structure', () => {
      const connection: Connection = {
        connectionId: 'test-123',
        userId: 'user-456',
        username: 'TestUser',
        connectedAt: Date.now(),
        ttl: Math.floor(Date.now() / 1000) + 86400,
      };

      expect(connection.connectionId).toBe('test-123');
      expect(connection.userId).toBe('user-456');
      expect(connection.username).toBe('TestUser');
      expect(typeof connection.connectedAt).toBe('number');
      expect(typeof connection.ttl).toBe('number');
    });
  });

  describe('Message Types', () => {
    it('should have correct Message type structure', () => {
      const now = Date.now();
      const messageId = `${now}-abc123`;

      const message: Message = {
        roomId: 'global',
        sortKey: `${now}#${messageId}`,
        messageId,
        userId: 'user-123',
        username: 'TestUser',
        content: 'Hello, World!',
        createdAt: now,
      };

      expect(message.roomId).toBe('global');
      expect(message.content).toBe('Hello, World!');
      expect(message.username).toBe('TestUser');
    });

    it('should sort messages correctly by sortKey', () => {
      const messages: Message[] = [
        {
          roomId: 'global',
          sortKey: '1000#msg1',
          messageId: 'msg1',
          userId: 'user1',
          username: 'User1',
          content: 'First',
          createdAt: 1000,
        },
        {
          roomId: 'global',
          sortKey: '2000#msg2',
          messageId: 'msg2',
          userId: 'user2',
          username: 'User2',
          content: 'Second',
          createdAt: 2000,
        },
      ];

      const sorted = messages.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
      expect(sorted[0].content).toBe('First');
      expect(sorted[1].content).toBe('Second');
    });
  });
});
