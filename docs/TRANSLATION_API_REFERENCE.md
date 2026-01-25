# Translation API Reference

## Overview

The Translation API provides endpoints for translating video/audio transcripts into multiple languages. All endpoints require authentication and follow REST conventions.

**Base URL:** `https://your-domain.com/api`

**Authentication:** Session-based (cookie)

**Content Type:** `application/json`

## Endpoints

### 1. Get Supported Languages

Retrieves the list of all supported languages for translation.

#### Request

```http
GET /api/translations/languages HTTP/1.1
Host: your-domain.com
Cookie: session=xxx
```

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "languages": [
      {
        "code": "en",
        "name": "English",
        "nativeName": "English",
        "region": "Global"
      },
      {
        "code": "hi",
        "name": "Hindi",
        "nativeName": "हिन्दी",
        "region": "India"
      },
      {
        "code": "es",
        "name": "Spanish",
        "nativeName": "Español",
        "region": "Europe"
      }
    ],
    "count": 50
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Request success status |
| `data.languages` | array | Array of language objects |
| `data.languages[].code` | string | ISO 639-1 language code |
| `data.languages[].name` | string | English name of the language |
| `data.languages[].nativeName` | string | Native name of the language |
| `data.languages[].region` | string | Geographic region |
| `data.count` | number | Total number of languages |

#### Caching

- **Client-side:** Recommended to cache for 5 minutes
- **Server-side:** Static data, safe to cache indefinitely
- **Cache-Control:** `public, max-age=300`

#### Example Usage

```typescript
const response = await fetch('/api/translations/languages', {
  cache: 'force-cache' // Browser will cache
});

const { data } = await response.json();
console.log(`${data.count} languages available`);
```

---

### 2. Translate Transcript

Translates an asset's transcript to one or more target languages.

#### Request

```http
POST /api/translations/transcript HTTP/1.1
Host: your-domain.com
Content-Type: application/json
Cookie: session=xxx

{
  "assetId": "clxyz123456789",
  "targetLanguages": ["hi", "es", "fr", "de"]
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `assetId` | string | Yes | ID of the asset to translate |
| `targetLanguages` | array[string] | Yes | Array of language codes (ISO 639-1) |

**Constraints:**
- `assetId`: Must be a valid CUID
- `targetLanguages`:
  - Minimum 1 language
  - Maximum 6 languages per request
  - Each code must be a valid 2-letter ISO 639-1 code
  - Duplicates will be ignored

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "assetId": "clxyz123456789",
    "translations": [
      {
        "language": "hi",
        "translationId": "cltrans001",
        "status": "created"
      },
      {
        "language": "es",
        "translationId": "cltrans002",
        "status": "existing"
      },
      {
        "language": "fr",
        "translationId": "cltrans003",
        "status": "created"
      },
      {
        "language": "de",
        "translationId": "cltrans004",
        "status": "created"
      }
    ],
    "summary": {
      "requested": 4,
      "created": 3,
      "existing": 1
    }
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Request success status |
| `data.assetId` | string | ID of the translated asset |
| `data.translations` | array | Array of translation results |
| `data.translations[].language` | string | Language code |
| `data.translations[].translationId` | string | ID of the translation record |
| `data.translations[].status` | string | "created" or "existing" |
| `data.summary.requested` | number | Number of languages requested |
| `data.summary.created` | number | Number of new translations created |
| `data.summary.existing` | number | Number of existing translations reused |

#### Translation Status

- `created`: New translation was generated
- `existing`: Translation already existed and was reused

#### Error Responses

**401 Unauthorized**
```json
{
  "success": false,
  "error": "Authentication required"
}
```

**400 Bad Request - Invalid Input**
```json
{
  "success": false,
  "error": "Invalid request body",
  "details": [
    {
      "field": "targetLanguages",
      "message": "Must contain between 1 and 6 languages"
    }
  ]
}
```

**400 Bad Request - Invalid Language Codes**
```json
{
  "success": false,
  "error": "Invalid language codes",
  "details": "Language codes must be 2-letter ISO 639-1 codes"
}
```

**403 Forbidden**
```json
{
  "success": false,
  "error": "Access denied to this asset"
}
```

**404 Not Found**
```json
{
  "success": false,
  "error": "Asset not found"
}
```

**400 Bad Request - No Transcript**
```json
{
  "success": false,
  "error": "Asset has no transcript to translate"
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": "Translation failed",
  "details": "OpenAI API error: rate limit exceeded"
}
```

#### Example Usage

```typescript
const response = await fetch('/api/translations/transcript', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    assetId: 'clxyz123456789',
    targetLanguages: ['hi', 'es', 'fr']
  }),
  cache: 'no-store'
});

const { data } = await response.json();
console.log(`Created ${data.summary.created} new translations`);
console.log(`Reused ${data.summary.existing} existing translations`);
```

#### Performance Considerations

- **Processing Time:** ~10-30 seconds depending on transcript length and number of languages
- **Concurrent Requests:** Limited by OpenAI API rate limits
- **Recommendation:** Request multiple languages in one call rather than separate calls

---

### 3. Get Asset Translations

Retrieves all translations for a specific asset.

#### Request

```http
GET /api/assets/clxyz123456789/translations HTTP/1.1
Host: your-domain.com
Cookie: session=xxx
```

#### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Asset ID (CUID) |

#### Response

**Status:** `200 OK`

```json
{
  "success": true,
  "data": {
    "assetId": "clxyz123456789",
    "sourceLanguage": "en",
    "translations": [
      {
        "id": "cltrans001",
        "language": "hi",
        "transcript": "यह एक वीडियो ट्रांसक्रिप्शन का उदाहरण है। हम विभिन्न विषयों पर चर्चा करते हैं।",
        "segments": [
          {
            "id": 1,
            "start": 0,
            "end": 5.5,
            "text": "यह एक वीडियो ट्रांसक्रिप्शन का उदाहरण है।"
          },
          {
            "id": 2,
            "start": 5.5,
            "end": 10.2,
            "text": "हम विभिन्न विषयों पर चर्चा करते हैं।"
          }
        ],
        "translatedFrom": "en",
        "translatedAt": "2025-01-15T10:30:00.000Z"
      },
      {
        "id": "cltrans002",
        "language": "es",
        "transcript": "Este es un ejemplo de transcripción de video. Discutimos varios temas.",
        "segments": null,
        "translatedFrom": "en",
        "translatedAt": "2025-01-15T10:31:00.000Z"
      }
    ],
    "count": 2
  }
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Request success status |
| `data.assetId` | string | ID of the asset |
| `data.sourceLanguage` | string | Original language of the asset |
| `data.translations` | array | Array of translation objects |
| `data.translations[].id` | string | Translation record ID |
| `data.translations[].language` | string | Target language code |
| `data.translations[].transcript` | string | Full translated transcript |
| `data.translations[].segments` | array\|null | Translated segments with timing |
| `data.translations[].translatedFrom` | string | Source language code |
| `data.translations[].translatedAt` | string | ISO 8601 timestamp |
| `data.count` | number | Total number of translations |

#### Segment Object Structure

```typescript
{
  id: number;        // Segment ID
  start: number;     // Start time in seconds
  end: number;       // End time in seconds
  text: string;      // Translated segment text
}
```

#### Error Responses

**401 Unauthorized**
```json
{
  "success": false,
  "error": "Authentication required"
}
```

**404 Not Found**
```json
{
  "success": false,
  "error": "Asset not found"
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": "Failed to fetch translations"
}
```

#### Example Usage

```typescript
const response = await fetch(`/api/assets/${assetId}/translations`, {
  cache: 'no-store'
});

const { data } = await response.json();

// Access translations by language
const hindiTranslation = data.translations.find(t => t.language === 'hi');

// Check if segments are available
if (hindiTranslation.segments) {
  console.log('Segment-level translation available');
}
```

---

## Common Patterns

### 1. Check for Existing Translations Before Creating

```typescript
// 1. Fetch existing translations
const existing = await fetch(`/api/assets/${assetId}/translations`);
const { data } = await existing.json();

// 2. Determine which languages need translation
const existingLanguages = data.translations.map(t => t.language);
const targetLanguages = ['hi', 'es', 'fr'];
const neededLanguages = targetLanguages.filter(
  lang => !existingLanguages.includes(lang)
);

// 3. Only request needed translations
if (neededLanguages.length > 0) {
  await fetch('/api/translations/transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      assetId,
      targetLanguages: neededLanguages
    })
  });
}
```

### 2. Batch Translation Workflow

```typescript
// Translate to multiple languages with progress tracking
async function translateWithProgress(
  assetId: string,
  languages: string[],
  onProgress: (progress: number) => void
) {
  // Chunk languages into batches of 6 (API limit)
  const batches = [];
  for (let i = 0; i < languages.length; i += 6) {
    batches.push(languages.slice(i, i + 6));
  }

  // Process each batch
  for (let i = 0; i < batches.length; i++) {
    const response = await fetch('/api/translations/transcript', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assetId,
        targetLanguages: batches[i]
      })
    });

    const progress = ((i + 1) / batches.length) * 100;
    onProgress(progress);
  }
}
```

### 3. Error Handling with Retry

```typescript
async function translateWithRetry(
  assetId: string,
  targetLanguages: string[],
  maxRetries = 3
) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const response = await fetch('/api/translations/transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, targetLanguages })
      });

      if (!response.ok) {
        const error = await response.json();

        // Don't retry on client errors (4xx)
        if (response.status >= 400 && response.status < 500) {
          throw new Error(error.error);
        }

        throw new Error(error.error);
      }

      return await response.json();
    } catch (error) {
      attempt++;

      if (attempt >= maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

## Rate Limiting

**Current Status:** Not implemented (planned for Phase 8)

**Planned Limits:**
- 10 translation requests per minute per user
- 100 translation requests per hour per user
- 50 languages fetch requests per minute per IP

**Headers (Future):**
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1642723200
```

## Webhooks (Future)

Planned webhook support for long-running translation jobs:

```json
POST https://your-webhook-url.com/translation-complete
Content-Type: application/json

{
  "event": "translation.completed",
  "assetId": "clxyz123456789",
  "translationId": "cltrans001",
  "language": "hi",
  "status": "success",
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```

## Best Practices

### 1. Cache Language List
```typescript
// Good: Cache languages client-side
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
let cachedLanguages = null;
let cacheTime = 0;

async function getLanguages() {
  const now = Date.now();
  if (cachedLanguages && now - cacheTime < CACHE_DURATION) {
    return cachedLanguages;
  }

  const response = await fetch('/api/translations/languages');
  const { data } = await response.json();

  cachedLanguages = data.languages;
  cacheTime = now;

  return cachedLanguages;
}
```

### 2. Handle Existing Translations
```typescript
// Always check for existing translations
const response = await fetch('/api/translations/transcript', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ assetId, targetLanguages: ['hi', 'es'] })
});

const { data } = await response.json();

// Handle mixed results
data.translations.forEach(t => {
  if (t.status === 'existing') {
    console.log(`${t.language}: Reused existing translation`);
  } else {
    console.log(`${t.language}: Created new translation`);
  }
});
```

### 3. Show Progress for Multiple Languages
```typescript
// Don't request all at once if > 6 languages
const targetLanguages = ['hi', 'es', 'fr', 'de', 'ja', 'ko', 'zh', 'ar'];

// Split into batches of 6
for (let i = 0; i < targetLanguages.length; i += 6) {
  const batch = targetLanguages.slice(i, i + 6);

  await fetch('/api/translations/transcript', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ assetId, targetLanguages: batch })
  });

  const progress = Math.min(((i + 6) / targetLanguages.length) * 100, 100);
  updateProgressBar(progress);
}
```

### 4. Validate Language Codes Client-Side
```typescript
const VALID_LANGUAGE_CODES = /^[a-z]{2}$/;

function validateLanguageCodes(languages: string[]): boolean {
  if (languages.length < 1 || languages.length > 6) {
    return false;
  }

  return languages.every(code => VALID_LANGUAGE_CODES.test(code));
}
```

## TypeScript Types

```typescript
// Language
interface Language {
  code: string;
  name: string;
  nativeName: string;
  region: string;
}

// Translation Request
interface TranslateTranscriptParams {
  assetId: string;
  targetLanguages: string[];
}

// Translation Response
interface TranslateTranscriptResponse {
  assetId: string;
  translations: Array<{
    language: string;
    translationId: string;
    status: 'created' | 'existing';
  }>;
  summary: {
    requested: number;
    created: number;
    existing: number;
  };
}

// Translation Object
interface Translation {
  id: string;
  language: string;
  transcript: string;
  segments?: Array<{
    id: number;
    start: number;
    end: number;
    text: string;
  }> | null;
  translatedFrom: string;
  translatedAt: string;
}

// Asset Translations Response
interface AssetTranslationsResponse {
  assetId: string;
  sourceLanguage: string;
  translations: Translation[];
  count: number;
}

// API Response Wrapper
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}
```

## Changelog

### v1.0.0 (January 2025)
- Initial release
- GET /api/translations/languages
- POST /api/translations/transcript
- GET /api/assets/:id/translations
- Support for 50+ languages
- Segment-level translation
- Automatic translation reuse

---

**Last Updated:** January 2025
**API Version:** 1.0.0
**Support:** [GitHub Issues](https://github.com/your-org/your-repo/issues)
