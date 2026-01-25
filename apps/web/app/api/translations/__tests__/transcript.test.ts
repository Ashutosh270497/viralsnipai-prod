/**
 * Integration tests for POST /api/translations/transcript
 */

import { POST } from '../transcript/route';
import { getCurrentUser } from '@/lib/auth';
import { container } from '@/lib/infrastructure/di/container';
import { TYPES } from '@/lib/infrastructure/di/types';
import type { TranslateTranscriptUseCase } from '@/lib/application/use-cases/TranslateTranscriptUseCase';

// Mock dependencies
jest.mock('@/lib/auth', () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock('@/lib/infrastructure/di/container', () => ({
  container: {
    get: jest.fn(),
  },
}));

describe('POST /api/translations/transcript', () => {
  let mockUseCase: jest.Mocked<TranslateTranscriptUseCase>;

  beforeEach(() => {
    mockUseCase = {
      execute: jest.fn(),
    } as any;

    (container.get as jest.Mock).mockReturnValue(mockUseCase);
    jest.clearAllMocks();
  });

  it('should translate transcript successfully', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

    mockUseCase.execute.mockResolvedValue({
      assetId: 'asset-1',
      translations: [
        { language: 'hi', translationId: 'trans-1', status: 'created' },
        { language: 'ta', translationId: 'trans-2', status: 'created' },
      ],
    });

    const request = new Request('http://localhost:3000/api/translations/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: 'asset-1',
        targetLanguages: ['hi', 'ta'],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data).toEqual({
      assetId: 'asset-1',
      translations: [
        { language: 'hi', translationId: 'trans-1', status: 'created' },
        { language: 'ta', translationId: 'trans-2', status: 'created' },
      ],
      summary: {
        requested: 2,
        created: 2,
        existing: 0,
      },
    });
    expect(mockUseCase.execute).toHaveBeenCalledWith({
      assetId: 'asset-1',
      targetLanguages: ['hi', 'ta'],
      userId: 'user-1',
    });
  });

  it('should return 401 when user is not authenticated', async () => {
    (getCurrentUser as jest.Mock).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/translations/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: 'asset-1',
        targetLanguages: ['hi'],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Authentication required');
  });

  it('should return 400 when assetId is missing', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

    const request = new Request('http://localhost:3000/api/translations/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetLanguages: ['hi'],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request body');
  });

  it('should return 400 when targetLanguages is empty', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

    const request = new Request('http://localhost:3000/api/translations/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: 'asset-1',
        targetLanguages: [],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBe('Invalid request body');
  });

  it('should return 400 when targetLanguages exceeds maximum', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

    const request = new Request('http://localhost:3000/api/translations/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: 'asset-1',
        targetLanguages: ['hi', 'ta', 'te', 'mr', 'gu', 'bn', 'pa'],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 400 when language codes are invalid format', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

    const request = new Request('http://localhost:3000/api/translations/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: 'asset-1',
        targetLanguages: ['hindi', 'ta'],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should include summary in response', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

    mockUseCase.execute.mockResolvedValue({
      assetId: 'asset-1',
      translations: [
        { language: 'hi', translationId: 'trans-1', status: 'created' },
        { language: 'ta', translationId: 'trans-2', status: 'existing' },
        { language: 'te', translationId: 'trans-3', status: 'created' },
      ],
    });

    const request = new Request('http://localhost:3000/api/translations/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: 'asset-1',
        targetLanguages: ['hi', 'ta', 'te'],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(data.data.summary).toEqual({
      requested: 3,
      created: 2,
      existing: 1,
    });
  });

  it('should handle use case errors gracefully', async () => {
    const mockUser = { id: 'user-1', email: 'test@example.com' };
    (getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

    mockUseCase.execute.mockRejectedValue(
      new Error('Asset has no transcript to translate')
    );

    const request = new Request('http://localhost:3000/api/translations/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId: 'asset-1',
        targetLanguages: ['hi'],
      }),
    });

    const response = await POST(request);

    expect(response.status).toBeGreaterThanOrEqual(400);
  });
});
