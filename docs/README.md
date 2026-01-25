# Clippers Documentation

Welcome to the Clippers project documentation. This folder contains product-level and feature-specific documentation.

---

## 📁 Documentation Structure

The project has two documentation locations:

### 1. **Root Docs** (`/docs/`) - This Folder
Product-level documentation and feature guides:
- Product requirements
- Feature-specific guides (Agent Editor)
- Assets

### 2. **Web App Docs** (`/apps/web/docs/`)
Technical architecture and development guides:
- [Architecture Guide](../apps/web/docs/ARCHITECTURE.md) - Clean Architecture, SOLID principles
- [Refactoring Summary](../apps/web/docs/REFACTORING_SUMMARY.md) - Quick start & code examples
- [README](../apps/web/docs/README.md) - Documentation index

---

## 📚 Available Documentation

### Product Requirements
**[PRD_Clippers.md](./PRD_Clippers.md)** (3.4 KB)
- Product vision and goals
- Target personas
- Feature specifications
- User journeys

---

### Agent Editor
**[AGENT_EDITOR_GUIDE.md](./AGENT_EDITOR_GUIDE.md)** (4.6 KB)
- Agent Editor feature guide
- How to use the AI-powered video editor
- Agent orchestration system

**[DEBUGGING_AGENT_EDITOR.md](./DEBUGGING_AGENT_EDITOR.md)** (6.7 KB)
- Troubleshooting guide
- Common issues and solutions
- Debug techniques for agent system

---

### Assets
**[assets/](./assets/)**
- Images, diagrams, and visual assets
- Reference materials

---

## 🏗️ For Developers

### Architecture & Code
For technical architecture, design patterns, and code documentation:

👉 **Go to [apps/web/docs/](../apps/web/docs/)**

Key documents:
- **[ARCHITECTURE.md](../apps/web/docs/ARCHITECTURE.md)** - Complete architecture guide
  - Clean Architecture (4 layers)
  - Design patterns (Repository, DI, Use Case, Value Objects)
  - SOLID principles
  - Data flows and testing

- **[REFACTORING_SUMMARY.md](../apps/web/docs/REFACTORING_SUMMARY.md)** - Quick reference
  - Code examples
  - Before/after comparisons
  - Migration guide
  - Contributing guidelines

### Quick Commands
```bash
# Development
pnpm dev                      # Start dev server
pnpm build                    # Build for production

# Testing
pnpm test:unit                # Run Jest unit tests
pnpm test:unit:coverage       # Coverage report
pnpm test                     # E2E tests (Playwright)

# Code Quality
pnpm lint                     # Run ESLint
pnpm format                   # Format with Prettier
```

---

## 🎯 Quick Links

### New to the Project?
1. Read [PRD_Clippers.md](./PRD_Clippers.md) - Understand the product
2. Read [apps/web/docs/README.md](../apps/web/docs/README.md) - Technical overview
3. Read [apps/web/docs/REFACTORING_SUMMARY.md](../apps/web/docs/REFACTORING_SUMMARY.md) - Quick start

### Working with Agent Editor?
1. Read [AGENT_EDITOR_GUIDE.md](./AGENT_EDITOR_GUIDE.md) - Feature guide
2. Read [DEBUGGING_AGENT_EDITOR.md](./DEBUGGING_AGENT_EDITOR.md) - Troubleshooting

### Understanding the Architecture?
1. Read [apps/web/docs/ARCHITECTURE.md](../apps/web/docs/ARCHITECTURE.md) - Full guide
2. See design patterns and data flows
3. Understand SOLID principles application

---

## 📊 Current Architecture

The codebase follows **Clean Architecture** with 4 layers:

```
Presentation Layer (Next.js, React, React Query)
          ↓
Application Layer (Use Cases - Business Workflows)
          ↓
Domain Layer (Services, Value Objects, Interfaces)
          ↓
Infrastructure Layer (Prisma Repositories, DI Container)
```

**Key Achievements:**
- ✅ 88% code reduction in main route (939 → 107 lines)
- ✅ Repository Pattern with Dependency Injection
- ✅ React Query for automatic caching
- ✅ Comprehensive test infrastructure (Jest)
- ✅ SOLID principles throughout

For detailed architecture documentation, see [apps/web/docs/ARCHITECTURE.md](../apps/web/docs/ARCHITECTURE.md)

---

## 🗂️ Documentation Organization

```
clippers/
│
├── docs/                              ← You are here (Product-level)
│   ├── README.md
│   ├── PRD_Clippers.md                ← Product requirements
│   ├── AGENT_EDITOR_GUIDE.md          ← Feature guide
│   ├── DEBUGGING_AGENT_EDITOR.md      ← Debugging guide
│   └── assets/                        ← Visual assets
│
└── apps/web/
    ├── docs/                          ← Technical architecture
    │   ├── README.md                  ← Tech docs index
    │   ├── ARCHITECTURE.md            ← Architecture guide
    │   └── REFACTORING_SUMMARY.md     ← Quick reference
    │
    ├── lib/                           ← Application code
    │   ├── application/use-cases/     ← Business workflows
    │   ├── domain/                    ← Business logic
    │   ├── infrastructure/            ← Database & DI
    │   ├── hooks/queries/             ← React Query
    │   └── api/                       ← API client
    │
    ├── app/api/                       ← API routes
    ├── components/                    ← React components
    └── __tests__/                     ← Unit tests
```

---

## 🤝 Contributing

### Documentation Guidelines

1. **Product-level docs** → Add to `/docs/` (this folder)
2. **Technical/architecture docs** → Add to `/apps/web/docs/`
3. **Feature guides** → Add to `/docs/`
4. **Code patterns** → Add to `/apps/web/docs/`

### Naming Conventions
- Product docs: `DESCRIPTIVE_NAME.md`
- Technical docs: `ARCHITECTURE.md`, `REFACTORING_SUMMARY.md`
- Feature guides: `FEATURE_NAME_GUIDE.md`

---

## 📝 License

[Your License Here]

---

**Last Updated:** November 9, 2024

For questions about:
- **Product features** → See docs in this folder
- **Technical architecture** → See [apps/web/docs/](../apps/web/docs/)
- **Agent Editor** → See [AGENT_EDITOR_GUIDE.md](./AGENT_EDITOR_GUIDE.md)
