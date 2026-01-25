# Clippers Documentation

Welcome to the Clippers application documentation. This directory contains comprehensive guides about the architecture, patterns, and best practices used in this codebase.

## 📚 Available Documentation

### [ARCHITECTURE.md](./ARCHITECTURE.md)
**Comprehensive Architecture Guide** (13 KB)

The complete guide to understanding the codebase architecture, including:
- Clean Architecture layers (Presentation → Application → Domain → Infrastructure)
- Design patterns (Repository, Dependency Injection, Use Case, Value Objects)
- Data flow diagrams
- State management with React Query
- API standards and error handling
- Testing strategy
- SOLID principles application
- Code metrics and improvements

**Start here if you want to:**
- Understand the overall system architecture
- Learn about design patterns used
- See data flow through the application
- Understand SOLID principles implementation

---

### [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md)
**Quick Start & Practical Guide** (9.4 KB)

A practical guide with code examples and quick references:
- Quick start guide
- How to use the DI container
- How to use React Query hooks
- Before/after code comparisons
- Migration guide (old patterns → new patterns)
- Testing commands
- Contributing guidelines

**Start here if you want to:**
- Get up and running quickly
- See practical code examples
- Learn how to extend the system
- Understand how to migrate old code

---

## 🚀 Quick Links

### Architecture Overview
```
Presentation Layer (API Routes, Components, React Query)
          ↓
Application Layer (Use Cases - Business Workflows)
          ↓
Domain Layer (Services, Value Objects, Interfaces)
          ↓
Infrastructure Layer (Repositories, Database, DI Container)
```

### Key Achievements
- ✅ **88% code reduction** in auto-highlights route (939 → 107 lines)
- ✅ **Clean Architecture** with 4 distinct layers
- ✅ **Dependency Injection** using InversifyJS
- ✅ **Repository Pattern** for data access abstraction
- ✅ **React Query** for automatic caching and state management
- ✅ **SOLID Principles** applied throughout
- ✅ **Comprehensive testing** infrastructure with Jest

### Commands
```bash
# Development
pnpm dev                      # Start dev server
pnpm build                    # Build for production

# Testing
pnpm test:unit                # Run Jest unit tests
pnpm test:unit:watch          # Watch mode
pnpm test:unit:coverage       # Coverage report
pnpm test                     # E2E tests (Playwright)

# Code Quality
pnpm lint                     # Run ESLint
pnpm format                   # Format with Prettier
```

---

## 📖 Recommended Reading Order

### For New Developers
1. **Start with**: [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md)
   - Get the big picture
   - See code examples
   - Understand quick patterns

2. **Then read**: [ARCHITECTURE.md](./ARCHITECTURE.md)
   - Deep dive into architecture
   - Understand design decisions
   - Learn all patterns

### For Existing Developers
1. **Quick Reference**: [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md)
   - Find code examples
   - Copy-paste patterns
   - Migration guide

2. **Design Decisions**: [ARCHITECTURE.md](./ARCHITECTURE.md)
   - Understand "why" behind patterns
   - See full data flows
   - Reference for complex scenarios

---

## 🏗️ Architecture at a Glance

### Layers
- **Presentation**: Next.js routes, React components, React Query hooks
- **Application**: Use cases (GenerateAutoHighlightsUseCase)
- **Domain**: Services, Value Objects, Repository interfaces
- **Infrastructure**: Prisma repositories, DI container, external services

### Key Patterns
- **Repository Pattern**: Abstract data access
- **Dependency Injection**: Loose coupling with InversifyJS
- **Use Case Pattern**: Orchestrate business workflows
- **Value Objects**: Encapsulate domain concepts (TimeRange, ViralityScore)

### Files Structure
```
apps/web/
├── docs/                          ← You are here
│   ├── README.md
│   ├── ARCHITECTURE.md
│   └── REFACTORING_SUMMARY.md
│
├── lib/
│   ├── application/use-cases/     ← Business workflows
│   ├── domain/                    ← Business logic & interfaces
│   │   ├── repositories/
│   │   ├── services/
│   │   └── value-objects/
│   ├── infrastructure/            ← Database & external services
│   │   ├── repositories/
│   │   ├── services/
│   │   └── di/
│   ├── hooks/queries/             ← React Query hooks
│   └── api/                       ← API client & responses
│
├── app/api/                       ← API routes
└── components/                    ← React components
```

---

## 🤝 Contributing

When adding new features, follow the established patterns:

1. **Create repository interface** in `lib/domain/repositories/`
2. **Implement repository** in `lib/infrastructure/repositories/`
3. **Register in DI container** in `lib/infrastructure/di/container.ts`
4. **Create use case** in `lib/application/use-cases/`
5. **Update API route** to use the use case
6. **Add tests** in respective `__tests__/` directories

See [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md#contributing) for detailed guidelines.

---

## 📊 Metrics

- **Code Files**: 26 new files following Clean Architecture
- **Test Files**: 6 comprehensive unit test suites
- **Code Reduction**: 88% in main route (939 → 107 lines)
- **Test Coverage Target**: 50% (branches, functions, lines, statements)

---

## 🆘 Need Help?

1. Check [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) for quick answers
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed explanations
3. Look at existing code examples in `lib/application/use-cases/`
4. Run tests to see patterns in action: `pnpm test:unit`

---

## 📝 License

[Your License Here]
