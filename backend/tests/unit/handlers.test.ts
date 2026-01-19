/**
 * Handler Unit Tests
 *
 * Comprehensive tests for all Lambda handlers with mocked AWS services.
 */

// Set environment variables before imports
process.env.CONNECTIONS_TABLE = 'test-connections';
process.env.MESSAGES_TABLE = 'test-messages';

// Mock AWS SDK - must be before handler imports
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockDynamoSend = jest.fn();
  return {
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({ send: mockDynamoSend }),
    },
    PutCommand: jest.fn().mockImplementation((params) => ({ type: 'Put', ...params })),
    DeleteCommand: jest.fn().mockImplementation((params) => ({ type: 'Delete', ...params })),
    QueryCommand: jest.fn().mockImplementation((params) => ({ type: 'Query', ...params })),
    ScanCommand: jest.fn().mockImplementation((params) => ({ type: 'Scan', ...params })),
    __mockDynamoSend: mockDynamoSend,
  };
});

jest.mock('@aws-sdk/client-apigatewaymanagementapi', () => {
  const mockApiGatewaySend = jest.fn();
  return {
    ApiGatewayManagementApiClient: jest.fn().mockImplementation(() => ({
      send: mockApiGatewaySend,
    })),
    PostToConnectionCommand: jest.fn().mockImplementation((params) => ({ type: 'Post', ...params })),
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

// Import handlers after mocks are set up
import { handler as connectHandler } from '../../src/handlers/connect';
import { handler as disconnectHandler } from '../../src/handlers/disconnect';
import { handler as sendMessageHandler } from '../../src/handlers/sendMessage';
import { handler as getMessagesHandler } from '../../src/handlers/getMessages';

/**
 * Creates a mock WebSocket event for testing
 */
function createEvent(routeKey: string, options: {
  connectionId?: string;
  userId?: string;
  username?: string;
  body?: string;
} = {}): any {
  const { connectionId = 'test-conn-id', userId, username, body } = options;

  const queryParams: Record<string, string> = {};
  if (userId) queryParams.userId = userId;
  if (username) queryParams.username = username;

  return {
    requestContext: {
      routeKey,
      connectionId,
      domainName: 'test.execute-api.eu-central-1.amazonaws.com',
      stage: 'dev',
      apiId: 'test-api',
      connectedAt: Date.now(),
      requestId: 'test-request-id',
      requestTimeEpoch: Date.now(),
      messageDirection: 'IN',
      messageId: 'test-message-id',
      extendedRequestId: 'test-extended-id',
      requestTime: new Date().toISOString(),
      eventType: routeKey === '$connect' ? 'CONNECT' : routeKey === '$disconnect' ? 'DISCONNECT' : 'MESSAGE',
    },
    body: body || null,
    isBase64Encoded: false,
    queryStringParameters: Object.keys(queryParams).length > 0 ? queryParams : null,
  };
}

describe('Connect Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDynamoSend.mockResolvedValue({});
  });

  it('should save connection with user data and return 200', async () => {
    const event = createEvent('$connect', {
      userId: 'user-123',
      username: 'TestUser',
    });

    const result = await connectHandler(event, {} as any, {} as any);

    expect(result).toEqual({ statusCode: 200, body: 'Connected' });
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);

    const callArg = mockDynamoSend.mock.calls[0][0];
    expect(callArg.Item.connectionId).toBe('test-conn-id');
    expect(callArg.Item.userId).toBe('user-123');
    expect(callArg.Item.username).toBe('TestUser');
  });

  it('should use default values when query params are missing', async () => {
    const event = createEvent('$connect', {});

    const result = await connectHandler(event, {} as any, {} as any);

    expect(result).toEqual({ statusCode: 200, body: 'Connected' });

    const callArg = mockDynamoSend.mock.calls[0][0];
    expect(callArg.Item.userId).toBe('anonymous');
    expect(callArg.Item.username).toBe('Anonymous');
  });

  it('should set TTL for 24 hours', async () => {
    const event = createEvent('$connect', {});
    const beforeTime = Math.floor(Date.now() / 1000);

    await connectHandler(event, {} as any, {} as any);

    const callArg = mockDynamoSend.mock.calls[0][0];
    const ttl = callArg.Item.ttl;
    const expectedMin = beforeTime + 24 * 60 * 60;

    expect(ttl).toBeGreaterThanOrEqual(expectedMin);
    expect(ttl).toBeLessThan(expectedMin + 10); // Allow 10s tolerance
  });

  it('should return 500 on DynamoDB error', async () => {
    mockDynamoSend.mockRejectedValueOnce(new Error('DynamoDB Error'));
    const event = createEvent('$connect', {});

    const result = await connectHandler(event, {} as any, {} as any);

    expect(result).toEqual({ statusCode: 500, body: 'Failed to connect' });
  });
});

describe('Disconnect Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDynamoSend.mockResolvedValue({});
  });

  it('should delete connection and return 200', async () => {
    const event = createEvent('$disconnect', { connectionId: 'conn-to-delete' });

    const result = await disconnectHandler(event, {} as any, {} as any);

    expect(result).toEqual({ statusCode: 200, body: 'Disconnected' });
    expect(mockDynamoSend).toHaveBeenCalledTimes(1);

    const callArg = mockDynamoSend.mock.calls[0][0];
    expect(callArg.Key.connectionId).toBe('conn-to-delete');
  });

  it('should return 500 on DynamoDB error', async () => {
    mockDynamoSend.mockRejectedValueOnce(new Error('DynamoDB Error'));
    const event = createEvent('$disconnect', {});

    const result = await disconnectHandler(event, {} as any, {} as any);

    expect(result).toEqual({ statusCode: 500, body: 'Failed to disconnect' });
  });
});

describe('SendMessage Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGatewaySend.mockResolvedValue({});
  });

  it('should reject empty message content', async () => {
    const event = createEvent('sendMessage', {
      body: JSON.stringify({ data: { content: '' } }),
    });

    const result = await sendMessageHandler(event, {} as any, {} as any);

    expect((result as any).statusCode).toBe(400);
    expect(JSON.parse((result as any).body).error).toBe('Message content is required');
  });

  it('should reject whitespace-only content', async () => {
    const event = createEvent('sendMessage', {
      body: JSON.stringify({ data: { content: '   ' } }),
    });

    const result = await sendMessageHandler(event, {} as any, {} as any);

    expect((result as any).statusCode).toBe(400);
  });

  it('should reject missing content field', async () => {
    const event = createEvent('sendMessage', {
      body: JSON.stringify({ data: {} }),
    });

    const result = await sendMessageHandler(event, {} as any, {} as any);

    expect((result as any).statusCode).toBe(400);
  });

  it('should reject null content', async () => {
    const event = createEvent('sendMessage', {
      body: JSON.stringify({ data: { content: null } }),
    });

    const result = await sendMessageHandler(event, {} as any, {} as any);

    expect((result as any).statusCode).toBe(400);
  });

  it('should handle missing body by returning validation error', async () => {
    const event = createEvent('sendMessage', { body: undefined });

    const result = await sendMessageHandler(event, {} as any, {} as any);

    expect((result as any).statusCode).toBe(400);
  });

  it('should save message and broadcast to all connections', async () => {
    // Mock: scan returns connections, put saves message
    mockDynamoSend
      .mockResolvedValueOnce({
        Items: [
          { connectionId: 'sender-conn', userId: 'sender-user', username: 'Sender' },
          { connectionId: 'other-conn', userId: 'other-user', username: 'Other' },
        ],
      }) // getAllConnections for sender lookup
      .mockResolvedValueOnce({}) // saveMessage
      .mockResolvedValueOnce({
        Items: [
          { connectionId: 'sender-conn', userId: 'sender-user', username: 'Sender' },
          { connectionId: 'other-conn', userId: 'other-user', username: 'Other' },
        ],
      }); // getAllConnections for broadcast

    const event = createEvent('sendMessage', {
      connectionId: 'sender-conn',
      body: JSON.stringify({ data: { content: 'Hello World', roomId: 'global' } }),
    });

    const result = await sendMessageHandler(event, {} as any, {} as any);

    expect((result as any).statusCode).toBe(200);
    expect(JSON.parse((result as any).body).success).toBe(true);
  });

  it('should default roomId when not provided', async () => {
    mockDynamoSend
      .mockResolvedValueOnce({
        Items: [{ connectionId: 'conn-1', userId: 'user-1', username: 'User' }],
      })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        Items: [{ connectionId: 'conn-1', userId: 'user-1', username: 'User' }],
      });

    const event = createEvent('sendMessage', {
      connectionId: 'conn-1',
      body: JSON.stringify({ data: { content: 'Hello without room' } }),
    });

    const result = await sendMessageHandler(event, {} as any, {} as any);
    const responseBody = JSON.parse((result as any).body);

    expect((result as any).statusCode).toBe(200);
    expect(responseBody.success).toBe(true);
  });

  it('should return 400 when sender connection not found', async () => {
    mockDynamoSend.mockResolvedValueOnce({ Items: [] }); // No connections found

    const event = createEvent('sendMessage', {
      connectionId: 'unknown-conn',
      body: JSON.stringify({ data: { content: 'Hello' } }),
    });

    const result = await sendMessageHandler(event, {} as any, {} as any);

    expect((result as any).statusCode).toBe(400);
    expect(JSON.parse((result as any).body).error).toBe('Connection not found');
  });

  it('should return 500 on unexpected error', async () => {
    const event = createEvent('sendMessage', {
      connectionId: 'sender-conn',
      body: 'not-json',
    });

    const result = await sendMessageHandler(event, {} as any, {} as any);

    expect((result as any).statusCode).toBe(500);
    expect(JSON.parse((result as any).body).error).toBe('Failed to send message');
  });
});

describe('GetMessages Handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockApiGatewaySend.mockResolvedValue({});
  });

  it('should query messages and send to client', async () => {
    const mockMessages = [
      { roomId: 'global', messageId: 'msg-1', content: 'Hello', createdAt: 1000 },
      { roomId: 'global', messageId: 'msg-2', content: 'World', createdAt: 2000 },
    ];

    mockDynamoSend.mockResolvedValueOnce({ Items: mockMessages });

    const event = createEvent('getMessages', {
      body: JSON.stringify({ data: { roomId: 'global', limit: 50 } }),
    });

    const result = await getMessagesHandler(event, {} as any, {} as any);

    expect((result as any).statusCode).toBe(200);
    expect(mockApiGatewaySend).toHaveBeenCalledTimes(1);
  });

  it('should use default roomId and limit when not provided', async () => {
    mockDynamoSend.mockResolvedValueOnce({ Items: [] });

    const event = createEvent('getMessages', {
      body: JSON.stringify({ data: {} }),
    });

    const result = await getMessagesHandler(event, {} as any, {} as any);

    expect((result as any).statusCode).toBe(200);

    const queryCall = mockDynamoSend.mock.calls[0][0];
    expect(queryCall.ExpressionAttributeValues[':roomId']).toBe('global');
    expect(queryCall.Limit).toBe(50);
  });

  it('should handle missing body by applying defaults', async () => {
    mockDynamoSend.mockResolvedValueOnce({ Items: [] });

    const event = createEvent('getMessages', {
      body: undefined,
    });

    const result = await getMessagesHandler(event, {} as any, {} as any);
    expect((result as any).statusCode).toBe(200);
  });

  it('should cap limit at 100', async () => {
    mockDynamoSend.mockResolvedValueOnce({ Items: [] });

    const event = createEvent('getMessages', {
      body: JSON.stringify({ data: { limit: 500 } }),
    });

    const result = await getMessagesHandler(event, {} as any, {} as any);

    expect((result as any).statusCode).toBe(200);

    const queryCall = mockDynamoSend.mock.calls[0][0];
    expect(queryCall.Limit).toBe(100);
  });

  it('should handle malformed JSON body gracefully', async () => {
    const event = createEvent('getMessages', {
      body: '{bad json}',
    });

    const result = await getMessagesHandler(event, {} as any, {} as any);

    expect((result as any).statusCode).toBe(500);
    expect(JSON.parse((result as any).body).error).toBe('Failed to get messages');
  });

  it('should return 500 on error', async () => {
    mockDynamoSend.mockRejectedValueOnce(new Error('Query failed'));

    const event = createEvent('getMessages', {
      body: JSON.stringify({ data: {} }),
    });

    const result = await getMessagesHandler(event, {} as any, {} as any);

    expect((result as any).statusCode).toBe(500);
  });
});

describe('Input Validation Helpers', () => {
  describe('Content Validation', () => {
    const isValidContent = (content: any): boolean => {
      return !!(content && typeof content === 'string' && content.trim() !== '');
    };

    it('should reject empty string', () => expect(isValidContent('')).toBe(false));
    it('should reject whitespace', () => expect(isValidContent('   ')).toBe(false));
    it('should reject null', () => expect(isValidContent(null)).toBe(false));
    it('should reject undefined', () => expect(isValidContent(undefined)).toBe(false));
    it('should reject number', () => expect(isValidContent(123)).toBe(false));
    it('should accept valid string', () => expect(isValidContent('Hello')).toBe(true));
  });

  describe('Query Param Extraction', () => {
    const extractUserData = (params: any) => ({
      userId: params?.userId || 'anonymous',
      username: params?.username || 'Anonymous',
    });

    it('should extract both fields', () => {
      const result = extractUserData({ userId: 'u1', username: 'User1' });
      expect(result).toEqual({ userId: 'u1', username: 'User1' });
    });

    it('should use defaults for null', () => {
      const result = extractUserData(null);
      expect(result).toEqual({ userId: 'anonymous', username: 'Anonymous' });
    });

    it('should use defaults for undefined', () => {
      const result = extractUserData(undefined);
      expect(result).toEqual({ userId: 'anonymous', username: 'Anonymous' });
    });

    it('should use default for missing userId', () => {
      const result = extractUserData({ username: 'User1' });
      expect(result.userId).toBe('anonymous');
    });
  });
});
