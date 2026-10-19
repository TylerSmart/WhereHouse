# WhereHouse — Agent Context & Quick Reference

> **Purpose:** This file provides immediate architectural, domain, and tooling context for AI coding agents working in **WhereHouse** so you do not need to scan the codebase to understand conventions.

## 1. Tech Stack & Runtime Ports

- **Backend:** .NET 10 (`net10.0`), ASP.NET Core Web API, Entity Framework Core 10 (SQL Server in dev/prod, EF InMemory in integration tests), Serilog, Scalar OpenAPI (`/api/scalar`).
- **Frontend:** Angular 22 (`WhereHouse.Client`), Angular Material + Material Symbols Outlined (`material-symbols-outlined`), TypeScript (strict), Signals, SCSS.
- **Ports:**
  - Local SQL Server (Docker): `localhost,14333` (Database: `WhereHouse`, started via `.\scripts\ensure-local-infra.ps1`)
  - Local .NET API: `http://localhost:5041` / `https://localhost:7127`
  - Local Angular Dev Server: `http://localhost:4200` (proxies `/api` to `http://localhost:5041`)
  - Production Docker Host Port (TrueNAS Scale): `51793:8080`

---

## 2. Repository Map

| Path | Responsibility |
| :--- | :--- |
| `docs/PRD.md` | **Source of Truth** for product requirements, domain entities, and Milestones 1–4. |
| `WhereHouse.Core/` | Domain interfaces (`I*Service`, `IUserContext`), immutable `record` DTOs/Requests, and `DomainExceptions`. **Zero EF Core or HTTP dependencies.** |
| `WhereHouse.Data/` | `WhereHouseDbContext`, EF entities (`Entities/`), fluent configs (`Configurations/`), `AuditSaveChangesInterceptor`, and data-backed services (`Services/`). |
| `WhereHouse.Infrastructure/` | Auth token generation (`JwtTokenService`), external OIDC (`OidcService`), file/external integrations. |
| `WhereHouse.API/` | Thin `ControllerBase` controllers (`Controllers/`), auth handlers (`DualBearerAuthenticationHandler`), OpenAPI/Scalar setup, and SPA static hosting. |
| `WhereHouse.Client/` | Angular 22 SPA (`src/app/core/` for services/models/guards/interceptors, `src/app/features/` for lazy-loaded views). |
| `Tests/` | `WhereHouse.Core.UnitTests`, `WhereHouse.Infrastructure.UnitTests`, `WhereHouse.API.IntegrationTests`, `WhereHouse.Client.E2ETests`. |

---

## 3. Detailed Rule Files (`.agents/rules/`)

- [Architecture & Domain Rules](rules/architecture-and-domain.md): Vertical slice checklist & core WhereHouse business invariants.
- [Backend (.NET 10 & EF Core) Rules](rules/backend-dotnet.md): Controller routing, `IAuditable`, DTOs, DI registration, and error handling.
- [Frontend (Angular 22) Rules](rules/frontend-angular.md): Angular v22 `@Service()`, signals, Material conventions, and API calls.
- [Commands, Testing & Formatting Rules](rules/commands-and-testing.md): Exact CLI syntax for `.NET 10` `Microsoft.Testing.Platform`, EF migrations, CSharpier, and ESLint.

---

## 4. Two-Phase Development Skills (`.agents/skills/`)

- **`/plan-phase`** ([`.agents/skills/plan-phase/SKILL.md`](skills/plan-phase/SKILL.md)): Run with a **high-thinking model** to design the next vertical slice/phase from `docs/PRD.md` and output a zero-ambiguity blueprint in `docs/plans/phase-<NN>-<slug>.md`.
- **`/execute-phase`** ([`.agents/skills/execute-phase/SKILL.md`](skills/execute-phase/SKILL.md)): Run with a **regular/fast implementation model** to execute the latest blueprint in `docs/plans/` step-by-step (including automatic EF Core migrations and the mandatory test-and-fix loop).
