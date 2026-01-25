# Clippers Web Application - Architecture Documentation

## Overview

This document describes the architecture of the Clippers web application after the Phase 1 & 2 refactoring implementing SOLID principles and Clean Architecture.

## Architecture Layers

The application follows **Clean Architecture** with four distinct layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  (Next.js App Router, React Components, API Routes)         │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                   Application Layer                          │
│         (Use Cases, Business Workflow Orchestration)         │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    Domain Layer                              │
│  (Business Logic, Services, Value Objects, Interfaces)       │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│                 Infrastructure Layer                         │
│    (Database, External Services, Repository Implementations) │
└─────────────────────────────────────────────────────────────┘
```

### 1. Presentation Layer

**Location**: `app/`, `components/`

**Responsibilities**:
- User interface components (React)
- API routes (Next.js App Router)
- Request validation (Zod schemas)
- Response formatting
- User interaction handling

**Key Files**:
- `app/api/repurpose/auto-highlights/route.ts` - Auto-highlights API endpoint (107 lines, down from 939)
- `components/repurpose/clip-list.tsx` - Clip listing with React Query
- `components/repurpose/export-panel.tsx` - Export management UI

### 2. Application Layer

**Location**: `lib/application/use-cases/`

**Responsibilities**:
- Orchestrate business workflows
- Coordinate between services
- Enforce business rules
- Transaction management
- Error handling

**Key Files**:
- `GenerateAutoHighlightsUseCase.ts` (276 lines) - Orchestrates the entire auto-highlights generation workflow

**Use Case Pattern**:
```typescript
class GenerateAutoHighlightsUseCase {
  async execute(input: Input): Promise<Output> {
    // 1. Validate permissions
    // 2. Get or create dependencies
    // 3. Execute business logic
    // 4. Persist results
    // 5. Return formatted output
  }
}
```

### 3. Domain Layer

**Location**: `lib/domain/`

**Responsibilities**:
- Core business logic
- Domain services
- Value objects
- Repository interfaces (contracts)
- Domain entities

**Subdirectories**:

#### Services (`lib/domain/services/`)
Contains business logic that doesn't belong to a single entity:

- **TranscriptionService.ts** (157 lines)
  - Transcribe audio/video files
  - Parse existing transcripts
  - Probe media duration

- **AIAnalysisService.ts** (85 lines)
  - Generate highlight suggestions via AI
  - Determine optimal clip count based on duration

- **ClipExtractionService.ts** (334 lines)
  - Extract clips from AI suggestions
  - Normalize clip durations
  - Deduplicate overlapping clips
  - Snap to transcript boundaries

#### Value Objects (`lib/domain/value-objects/`)
Immutable objects representing domain concepts:

- **TimeRange.vo.ts**
  - Encapsulates time ranges with validation
  - Methods: `durationMs`, `overlaps()`, `contains()`

- **ViralityScore.vo.ts**
  - Encapsulates virality scoring (0-100)
  - Methods: `grade` (S/A/B/C/D/F), `color`, `isHighQuality()`

#### Repository Interfaces (`lib/domain/repositories/`)
Define contracts for data access (Dependency Inversion Principle):

- `IProjectRepository.ts`
- `IClipRepository.ts`
- `IAssetRepository.ts`
- `IExportRepository.ts`

### 4. Infrastructure Layer

**Location**: `lib/infrastructure/`

**Responsibilities**:
- Database access (Prisma)
- External API integration
- File storage
- Message queues
- Dependency Injection configuration

**Subdirectories**:

#### Repositories (`lib/infrastructure/repositories/`)
Concrete implementations of repository interfaces:

- **PrismaProjectRepository.ts** - Project CRUD with Prisma
- **PrismaClipRepository.ts** - Clip operations with pagination
- **PrismaAssetRepository.ts** - Asset management
- **PrismaExportRepository.ts** - Export tracking

#### Services (`lib/infrastructure/services/`)
Infrastructure-level services:

- **VideoStorageService.ts** - Video upload and storage (local/S3)

#### Dependency Injection (`lib/infrastructure/di/`)

- **types.ts** - DI container symbols
- **container.ts** - InversifyJS configuration

```typescript
container.bind(TYPES.IProjectRepository).to(PrismaProjectRepository);
container.bind(TYPES.GenerateAutoHighlightsUseCase).to(GenerateAutoHighlightsUseCase);
```

## Design Patterns

### 1. Repository Pattern
**Problem**: Direct database coupling makes testing difficult and violates DIP.

**Solution**: Abstract data access behind interfaces.

```typescript
// Domain (interface)
interface IProjectRepository {
  findById(id: string): Promise<Project | null>;
  create(data: CreateProjectData): Promise<Project>;
}

// Infrastructure (implementation)
class PrismaProjectRepository implements IProjectRepository {
  async findById(id: string) {
    return prisma.project.findUnique({ where: { id } });
  }
}
```

**Benefits**:
- Easy to mock for testing
- Can swap Prisma for another ORM
- Enforces consistent data access patterns

### 2. Dependency Injection
**Problem**: Hard-coded dependencies make code rigid and untestable.

**Solution**: Use InversifyJS for IoC container.

```typescript
@injectable()
class GenerateAutoHighlightsUseCase {
  constructor(
    @inject(TYPES.IProjectRepository) private projectRepo: IProjectRepository,
    @inject(TYPES.AIAnalysisService) private aiService: AIAnalysisService
  ) {}
}
```

**Benefits**:
- Loose coupling
- Easy to test with mocks
- Single Responsibility Principle

### 3. Use Case Pattern
**Problem**: Complex business logic scattered across routes.

**Solution**: Encapsulate workflows in use case classes.

**Before** (939 lines in route):
```typescript
export async function POST(request: Request) {
  // 900+ lines of business logic mixed with HTTP handling
}
```

**After** (107 lines in route, 276 in use case):
```typescript
export async function POST(request: Request) {
  const useCase = container.get<GenerateAutoHighlightsUseCase>(TYPES.GenerateAutoHighlightsUseCase);
  const result = await useCase.execute(input);
  return ApiResponseBuilder.successResponse(result);
}
```

### 4. Value Objects
**Problem**: Primitive obsession and scattered validation logic.

**Solution**: Encapsulate values with behavior.

```typescript
const score = new ViralityScore(85);
score.grade; // "A"
score.color; // "#10B981"
score.isHighQuality(); // true
```

## Data Flow

### Auto-Highlights Generation Flow

```
┌─────────────┐
│  API Route  │ - Authenticate user
│  (route.ts) │ - Validate request body
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│ GenerateAutoHighlightsUseCase│
└─────┬───────────────────────┘
      │
      ├─► 1. Validate asset & permissions (ProjectRepository, AssetRepository)
      │
      ├─► 2. Get or create transcription (TranscriptionService)
      │
      ├─► 3. Generate AI highlights (AIAnalysisService)
      │
      ├─► 4. Extract & normalize clips (ClipExtractionService)
      │
      ├─► 5. Delete existing clips (ClipRepository)
      │
      ├─► 6. Analyze virality (AIAnalysisService)
      │
      ├─► 7. Create clips in database (ClipRepository)
      │
      └─► 8. Calculate analytics & return
```

## State Management

### React Query Integration

**Before**: Manual fetch + useState
```typescript
const [project, setProject] = useState(null);
const loadProject = async () => {
  const res = await fetch(`/api/projects/${id}`);
  setProject(await res.json());
};
useEffect(() => { loadProject() }, [id]);
```

**After**: React Query
```typescript
const { data: project } = useProject(projectId);
// Automatic caching, background refetching, error handling
```

**Benefits**:
- Automatic caching (1 minute stale time)
- Background refetching
- Optimistic updates with rollback
- Loading and error states
- DevTools for debugging

**Key Hooks**:
- `useProject(id)` - Fetch single project
- `useProjects(userId)` - Fetch user's projects
- `useClips(projectId)` - Fetch project clips
- `useCreateClip()` - Create clip mutation
- `useUpdateClip()` - Update clip mutation

## API Standards

### Standardized Response Format

All API routes use `ApiResponseBuilder`:

```typescript
// Success
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "requestId": "uuid"
  }
}

// Error
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid input",
    "details": { ... }
  },
  "meta": { ... }
}
```

### Error Handling

Centralized error handling with typed errors:

```typescript
throw AppError.notFound('Project not found');
throw AppError.badRequest('Invalid clip duration');
throw AppError.unauthorized('Authentication required');
```

## Testing Strategy

### Unit Tests
- **Repositories**: Mock Prisma client
- **Services**: Mock dependencies
- **Use Cases**: Mock all dependencies
- **Value Objects**: Test business logic

### Integration Tests
- **API Routes**: Test full request/response cycle
- **Database**: Use test database

### Test Files**:
- `lib/infrastructure/repositories/__tests__/`
- `lib/domain/services/__tests__/`
- `lib/application/use-cases/__tests__/`

## Metrics

### Code Reduction
- **Auto-highlights route**: 939 lines → 107 lines (88% reduction)
- **Responsibilities**: 1 file → 10+ files (proper separation)

### Files Created (26 total)
- 4 Repository interfaces
- 4 Repository implementations
- 4 Domain services
- 2 Value objects
- 1 Use case
- 2 DI configuration files
- 4 React Query hooks
- 2 API infrastructure files
- 1 Error boundary
- 2 Documentation files

### Lines of Code
- **Total added**: ~3,500 lines
- **Total removed/refactored**: ~900 lines
- **Net**: +2,600 lines (better organized, maintainable)

## Configuration

### TypeScript Decorators

Required for InversifyJS:

```json
// tsconfig.json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### Dependency Injection

```typescript
// apps/web/lib/infrastructure/di/container.ts
import 'reflect-metadata';
import { Container } from 'inversify';

const container = new Container({
  defaultScope: 'Singleton',
  skipBaseClassChecks: true,
});

// Bind all dependencies
bindRepositories();
bindServices();
bindUseCases();
```

## Best Practices

### 1. Dependency Direction
Always point inward: Infrastructure → Domain, never Domain → Infrastructure

### 2. Single Responsibility
Each class has one reason to change

### 3. Interface Segregation
No client should depend on methods it doesn't use

### 4. Dependency Inversion
Depend on abstractions, not concretions

### 5. Open/Closed Principle
Open for extension, closed for modification

## Future Improvements

1. **Add more use cases**: Refactor other large routes
2. **Domain Events**: Implement event-driven architecture
3. **CQRS**: Separate read/write models for complex queries
4. **Specification Pattern**: For complex query logic
5. **Integration Tests**: Full end-to-end workflow tests
6. **Performance Monitoring**: Add observability for use cases

## Related Documentation

- [Phase 1 & 2 Completion Summary](./PHASE_1_AND_2_COMPLETION.md)
- [Pending Items](./PHASE_1_AND_2_PENDING_ITEMS.md)
- [Main README](../../README.md)

## Glossary

- **DI**: Dependency Injection
- **IoC**: Inversion of Control
- **SOLID**: Single responsibility, Open/closed, Liskov substitution, Interface segregation, Dependency inversion
- **Use Case**: Application-specific business workflow
- **Repository**: Pattern for abstracting data access
- **Value Object**: Immutable object representing a domain concept
- **Clean Architecture**: Architectural pattern with concentric layers of dependencies
