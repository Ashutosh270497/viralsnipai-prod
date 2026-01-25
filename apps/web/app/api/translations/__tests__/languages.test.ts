/**
 * Integration tests for GET /api/translations/languages
 */

import { GET } from '../languages/route';

describe('GET /api/translations/languages', () => {
  it('should return list of supported languages', async () => {
    const request = new Request('http://localhost:3000/api/translations/languages');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data.languages).toBeDefined();
    expect(Array.isArray(data.data.languages)).toBe(true);
    expect(data.data.count).toBeGreaterThan(0);
  });

  it('should return languages with correct properties', async () => {
    const request = new Request('http://localhost:3000/api/translations/languages');

    const response = await GET(request);
    const data = await response.json();

    const firstLanguage = data.data.languages[0];
    expect(firstLanguage).toHaveProperty('code');
    expect(firstLanguage).toHaveProperty('name');
    expect(firstLanguage).toHaveProperty('nativeName');
    expect(firstLanguage).toHaveProperty('region');
  });

  it('should include English in supported languages', async () => {
    const request = new Request('http://localhost:3000/api/translations/languages');

    const response = await GET(request);
    const data = await response.json();

    const english = data.data.languages.find((lang: any) => lang.code === 'en');
    expect(english).toBeDefined();
    expect(english.name).toBe('English');
  });

  it('should include Indian languages', async () => {
    const request = new Request('http://localhost:3000/api/translations/languages');

    const response = await GET(request);
    const data = await response.json();

    const languageCodes = data.data.languages.map((lang: any) => lang.code);
    expect(languageCodes).toContain('hi'); // Hindi
    expect(languageCodes).toContain('ta'); // Tamil
    expect(languageCodes).toContain('te'); // Telugu
  });

  it('should return correct count', async () => {
    const request = new Request('http://localhost:3000/api/translations/languages');

    const response = await GET(request);
    const data = await response.json();

    expect(data.data.count).toBe(data.data.languages.length);
  });
});
