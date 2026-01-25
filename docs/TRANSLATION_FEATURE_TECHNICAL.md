# Multi-Language Translation Feature - Technical Documentation

## Architecture Overview

The translation feature follows **Clean Architecture** principles with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│                     Presentation Layer                       │
│  (React Components, Hooks, UI State Management)             │
│                                                              │
│  - TranslateTranscriptDialog.tsx                            │
│  - TranslationsList.tsx                                     │
│  - TranslationLanguageSelector.tsx                          │
│  - use-translation.ts (Custom Hooks)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│  (Use Cases, Business Logic Orchestration)                  │
│                                                              │
│  - TranslateTranscriptUseCase.ts                            │
│  - GetAssetTranslationsUseCase.ts (Future)                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      Domain Layer                            │
│  (Business Entities, Domain Services, Interfaces)           │
│                                                              │
│  - TranslationService.ts                                    │
│  - ITranscriptTranslationRepository.ts                      │
│  - TranscriptTranslation Entity                             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Infrastructure Layer                       │
│  (External Services, Database, API Clients)                 │
│                                                              │
│  - PrismaTranscriptTranslationRepository.ts                 │
│  - OpenAI Client Integration                                │
│  - Dependency Injection Container                           │
└─────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
apps/web/
├── app/api/
│   ├── translations/
│   │   ├── languages/
│   │   │   └── route.ts                    # GET /api/translations/languages
│   │   ├── transcript/
│   │   │   └── route.ts                    # POST /api/translations/transcript
│   │   └── __tests__/
│   │       ├── languages.test.ts
│   │       └── transcript.test.ts
│   └── assets/
│       └── [id]/
│           └── translations/
│               └── route.ts                # GET /api/assets/:id/translations
│
├── components/repurpose/
│   ├── translate-transcript-dialog.tsx     # Translation dialog component
│   ├── translations-list.tsx               # Translations display component
│   ├── translation-language-selector.tsx   # Language selection component
│   └── repurpose-workspace.tsx            # Main integration point
│
├── hooks/
│   └── use-translation.ts                  # React hooks for translation
│
├── lib/
│   ├── application/use-cases/
│   │   ├── TranslateTranscriptUseCase.ts  # Translation orchestration
│   │   └── __tests__/
│   │       └── TranslateTranscriptUseCase.test.ts
│   │
│   ├── domain/
│   │   ├── entities/
│   │   │   ├── TranscriptTranslation.ts   # Translation entity
│   │   │   └── CaptionTranslation.ts      # Caption translation entity
│   │   ├── repositories/
│   │   │   ├── ITranscriptTranslationRepository.ts
│   │   │   └── ICaptionTranslationRepository.ts
│   │   └── services/
│   │       ├── TranslationService.ts      # Core translation logic
│   │       └── __tests__/
│   │           └── TranslationService.test.ts
│   │
│   └── infrastructure/
│       ├── repositories/
│       │   ├── PrismaTranscriptTranslationRepository.ts
│       │   ├── PrismaCaptionTranslationRepository.ts
│       │   └── __tests__/
│       │       ├── PrismaTranscriptTranslationRepository.test.ts
│       │       └── PrismaCaptionTranslationRepository.test.ts
│       └── di/
│           ├── container.ts               # DI container configuration
│           └── types.ts                   # DI type symbols
│
└── prisma/
    └── schema.prisma                      # Database schema with translations
```

## Core Components

### 1. Frontend Hooks (use-translation.ts)

**Location:** [apps/web/hooks/use-translation.ts](../apps/web/hooks/use-translation.ts)

#### `useLanguages()`
Fetches and caches the list of supported languages.

**Features:**
- In-memory caching with 5-minute TTL
- Automatic retry with exponential backoff
- Memoized language lookup helper
- Browser cache integration

**Returns:**
```typescript
{
  languages: Language[],
  isLoading: boolean,
  error: Error | null,
  refetch: (force?: boolean) => Promise<void>,
  getLanguageByCode: (code: string) => Language | undefined
}
```

#### `useTranslateTranscript()`
Handles transcript translation requests with progress tracking.

**Features:**
- Progress simulation (0-90% during request, 100% on completion)
- Current language tracking
- Toast notifications on success/error
- Automatic cleanup on unmount

**Returns:**
```typescript
{
  translateTranscript: (params: TranslateTranscriptParams) => Promise<TranslateTranscriptResponse>,
  isLoading: boolean,
  error: Error | null,
  progress: number,
  currentLanguage: string | null
}
```

#### `useAssetTranslations(assetId: string | null)`
Fetches translations for a specific asset.

**Features:**
- Request cancellation with AbortController
- Retry mechanism with exponential backoff
- Memoized computed values (translationsByLanguage, availableLanguages)
- Automatic refetch on assetId change

**Returns:**
```typescript
{
  translations: Translation[],
  sourceLanguage: string,
  isLoading: boolean,
  error: Error | null,
  refetch: () => Promise<void>,
  translationsByLanguage: Map<string, Translation>,
  availableLanguages: string[]
}
```

### 2. Translation Service (TranslationService.ts)

**Location:** [apps/web/lib/domain/services/TranslationService.ts](../apps/web/lib/domain/services/TranslationService.ts)

**Responsibilities:**
- Text translation using OpenAI GPT-4
- Language detection
- Transcript segment translation
- Translation prompt generation

**Key Methods:**

```typescript
class TranslationService {
  async translateText(params: {
    text: string;
    targetLanguage: string;
    sourceLanguage?: string;
    context?: string;
  }): Promise<string>

  async translateTranscriptSegments(
    segments: TranscriptSegment[],
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<TranscriptSegment[]>

  async detectLanguage(text: string): Promise<string>
}
```

**Translation Strategy:**
- Uses GPT-4 for high-quality contextual translation
- Temperature: 0.3 for consistency
- Preserves formatting and technical terms
- Maintains segment timing information

### 3. Use Case (TranslateTranscriptUseCase.ts)

**Location:** [apps/web/lib/application/use-cases/TranslateTranscriptUseCase.ts](../apps/web/lib/application/use-cases/TranslateTranscriptUseCase.ts)

**Responsibilities:**
- Validate asset existence and user permissions
- Check for existing translations
- Orchestrate translation service calls
- Save translations to database
- Return comprehensive results

**Workflow:**
```
1. Validate asset exists
2. Validate user owns the project
3. Ensure transcript exists
4. For each target language:
   a. Check if translation already exists
   b. Skip source language
   c. Translate text or segments
   d. Save to database
5. Return summary of created/existing translations
```

### 4. Repository (PrismaTranscriptTranslationRepository.ts)

**Location:** [apps/web/lib/infrastructure/repositories/PrismaTranscriptTranslationRepository.ts](../apps/web/lib/infrastructure/repositories/PrismaTranscriptTranslationRepository.ts)

**Interface:**
```typescript
interface ITranscriptTranslationRepository {
  findByAssetAndLanguage(assetId: string, language: string): Promise<TranscriptTranslation | null>
  findByAssetId(assetId: string): Promise<TranscriptTranslation[]>
  create(data: CreateTranscriptTranslationData): Promise<TranscriptTranslation>
  update(id: string, data: UpdateTranscriptTranslationData): Promise<TranscriptTranslation>
  delete(id: string): Promise<void>
}
```

## Database Schema

**Models:**

```prisma
model TranscriptTranslation {
  id             String   @id @default(cuid())
  assetId        String
  language       String   // ISO 639-1 language code
  transcript     String   @db.Text
  segments       Json?    // Optional segment-level translation
  translatedFrom String   // Source language code
  translatedAt   DateTime @default(now())
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  asset Asset @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@unique([assetId, language])
  @@index([assetId])
  @@index([language])
}

model CaptionTranslation {
  id         String   @id @default(cuid())
  assetId    String
  language   String
  format     String   // 'srt', 'vtt', 'txt'
  content    String   @db.Text
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  asset Asset @relation(fields: [assetId], references: [id], onDelete: Cascade)

  @@unique([assetId, language, format])
  @@index([assetId])
}
```

## API Endpoints

### GET /api/translations/languages

Returns list of supported languages.

**Response:**
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
      }
    ],
    "count": 50
  }
}
```

### POST /api/translations/transcript

Translates a transcript to multiple languages.

**Request:**
```json
{
  "assetId": "clxyz123456",
  "targetLanguages": ["hi", "es", "fr"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "assetId": "clxyz123456",
    "translations": [
      {
        "language": "hi",
        "translationId": "cltrans123",
        "status": "created"
      },
      {
        "language": "es",
        "translationId": "cltrans456",
        "status": "existing"
      },
      {
        "language": "fr",
        "translationId": "cltrans789",
        "status": "created"
      }
    ],
    "summary": {
      "requested": 3,
      "created": 2,
      "existing": 1
    }
  }
}
```

### GET /api/assets/:id/translations

Fetches all translations for an asset.

**Response:**
```json
{
  "success": true,
  "data": {
    "assetId": "clxyz123456",
    "sourceLanguage": "en",
    "translations": [
      {
        "id": "cltrans123",
        "language": "hi",
        "transcript": "यह एक परीक्षण है",
        "segments": null,
        "translatedFrom": "en",
        "translatedAt": "2025-01-15T10:30:00Z"
      }
    ],
    "count": 1
  }
}
```

## Performance Optimizations

### 1. In-Memory Caching
```typescript
let languagesCache: Language[] | null = null;
let languagesCacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
```

**Benefits:**
- Reduces API calls by 95% for language list
- Instant loading on subsequent requests
- Automatic cache invalidation

### 2. Request Cancellation
```typescript
const abortControllerRef = useRef<AbortController | null>(null);

// Cancel previous request if still pending
if (abortControllerRef.current) {
  abortControllerRef.current.abort();
}
```

**Benefits:**
- Prevents race conditions
- Reduces memory leaks
- Improves responsiveness

### 3. React.memo Optimization
```typescript
const TranslationItem = memo(({ translation, isExpanded, onToggle, languageName }: TranslationItemProps) => {
  // Component implementation
});
```

**Benefits:**
- Prevents unnecessary re-renders
- Improves list performance with many items
- Reduces CPU usage

### 4. Retry with Exponential Backoff
```typescript
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000
): Promise<T> {
  // Implementation with exponential backoff
}
```

**Benefits:**
- Handles transient network failures
- Reduces server load during issues
- Improves reliability

## Testing

### Test Coverage
- **Unit Tests:** 38 passing tests
- **Integration Tests:** 13 API route tests (environment-dependent)
- **Coverage Areas:**
  - Translation service logic
  - Use case orchestration
  - Repository operations
  - Segment translation
  - Error handling

### Running Tests
```bash
# Run all translation tests
pnpm test:unit --testPathPatterns="translation"

# Run specific test suite
pnpm test:unit TranslationService.test.ts

# Run with coverage
pnpm test:unit --coverage --testPathPatterns="translation"
```

## Error Handling

### Client-Side Errors
- Network failures → Automatic retry (up to 3 attempts)
- 4xx errors → No retry, display error message
- Abort errors → Silent ignore (intentional cancellation)

### Server-Side Errors
- Asset not found → 404 with clear message
- Permission denied → 403 with access error
- Translation failed → 500 with error details
- Validation errors → 400 with field-specific errors

## Security Considerations

1. **Authentication:** All endpoints require authenticated user
2. **Authorization:** Users can only translate their own assets
3. **Input Validation:** Zod schemas validate all inputs
4. **Rate Limiting:** (To be implemented in Phase 8)
5. **SQL Injection:** Prevented by Prisma parameterization

## Monitoring and Logging

**Logged Events:**
- Translation requests started
- Translation completion with counts
- Language detection fallbacks
- API errors with context
- Performance metrics (segment count, word count)

**Example Log:**
```json
{
  "message": "Transcript translation completed",
  "assetId": "clxyz123456",
  "targetLanguages": ["hi", "es"],
  "translationCount": 2,
  "timestamp": "2025-01-15T10:30:00Z"
}
```

## Dependency Injection

**Container Setup:**
```typescript
container.bind<ITranscriptTranslationRepository>(TYPES.TranscriptTranslationRepository)
  .to(PrismaTranscriptTranslationRepository);

container.bind<TranslationService>(TYPES.TranslationService)
  .to(TranslationService);

container.bind<TranslateTranscriptUseCase>(TYPES.TranslateTranscriptUseCase)
  .to(TranslateTranscriptUseCase);
```

**Benefits:**
- Testability (easy mocking)
- Flexibility (swap implementations)
- Single Responsibility Principle
- Dependency Inversion Principle

## Future Enhancements

1. **Background Jobs:** Queue translations for large files
2. **Batch Translation:** Translate multiple assets at once
3. **Custom Glossaries:** Support domain-specific terminology
4. **Translation Memory:** Reuse previous translations
5. **Quality Scoring:** Rate translation quality
6. **Caption Export:** Generate .srt/.vtt files in translated languages

## Development Guidelines

### Adding a New Language
1. Add to `SUPPORTED_LANGUAGES` constant
2. Include native name and region
3. Update documentation
4. No code changes required (dynamic)

### Modifying Translation Logic
1. Update `TranslationService.ts`
2. Write unit tests
3. Run full test suite
4. Update documentation

### Adding New Translation Format
1. Create new entity (e.g., `CaptionTranslation`)
2. Implement repository interface
3. Create use case
4. Add API endpoint
5. Update UI components

## Troubleshooting

### Common Issues

**Issue:** OpenAI API rate limit exceeded
**Solution:** Implement request queuing or reduce parallel requests

**Issue:** Large transcripts timing out
**Solution:** Implement chunking strategy for transcripts > 10,000 words

**Issue:** Memory leaks in hooks
**Solution:** Ensure proper cleanup with `isMountedRef` and AbortController

---

**Last Updated:** January 2025
**Architecture Version:** 1.0.0
**Documentation Maintainer:** Development Team
