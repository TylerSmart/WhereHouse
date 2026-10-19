# Commands, Testing & Formatting Rules

> **Token-Saving Notice:** Use the exact commands below. Do not guess CLI flags.

## 1. Mandatory Test-and-Fix Loop (Definition of Done)

On **every** code implementation, you MUST:
1. **Write/Update Tests** across all affected layers:
   - **Backend Unit Tests:** `Tests/WhereHouse.Core.UnitTests` & `Tests/WhereHouse.Infrastructure.UnitTests` for domain/service/infrastructure logic.
   - **API Integration Tests:** `Tests/WhereHouse.API.IntegrationTests` (using `WhereHouseWebApplicationFactory`) for every new or modified controller endpoint, auth rule, or `IsPrivate` query filter.
   - **Frontend Unit Tests:** `.spec.ts` files in `WhereHouse.Client` for new/updated services, components, guards, and pipes.
   - **Playwright E2E Tests:** `Tests/WhereHouse.Client.E2ETests` for end-to-end user-facing feature flows (note: only run full browser E2E when the target feature's UI + API slice is ready, rather than on backend-only changes).
2. **Execute & Fix Until Green:**
   - Run the build, linter, and test suites after every implementation.
   - If any compilation error, lint warning, or test failure occurs, diagnose, fix, and re-run iteratively until **all** builds and tests pass before completing your task.

---

## 2. Building & Running Tests (.NET 10 Microsoft.Testing.Platform)

This solution uses **.NET 10** and **MSTest.Sdk v4 (`Microsoft.Testing.Platform`)**.
- **IMPORTANT:** `dotnet test` in `.NET 10` with `Microsoft.Testing.Platform` requires `--project` when targeting a specific `.csproj` (passing a positional path without `--project` will fail with exit code 5).
- **Visual Studio Lock Tip:** If `WhereHouse.API` is currently running in Visual Studio, building `WhereHouse.API` directly may fail due to file locks on `WhereHouse.API.exe`. You can still build `WhereHouse.Core`, `WhereHouse.Data`, `WhereHouse.Infrastructure`, and run unit tests at any time.

```powershell
# Build entire solution (from repo root)
dotnet build WhereHouse.slnx

# Run unit tests (fast, no Docker required)
dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj
dotnet test --project Tests/WhereHouse.Infrastructure.UnitTests/WhereHouse.Infrastructure.UnitTests.csproj

# Run API integration tests (uses EF Core InMemory DB via WhereHouseWebApplicationFactory — no Docker required!)
dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj

# Run Playwright E2E tests
dotnet test --project Tests/WhereHouse.Client.E2ETests/WhereHouse.Client.E2ETests.csproj
```

---

## 3. Frontend Build, Lint & Unit Tests (`WhereHouse.Client`)

Run all `npm` commands with working directory set to `WhereHouse.Client`:

```powershell
# Build Angular app
npm run build

# Lint TypeScript & HTML templates
npm run lint
npm run lint:fix

# Format frontend files with Prettier
npm run format
npm run format:check

# Run Angular unit tests (single run, non-interactive)
npm test -- --watch=false
```

---

## 4. Mandatory Entity Framework Core Migrations Workflow

Whenever you add or modify any EF Core entity (`WhereHouse.Data/Entities/`), configuration (`WhereHouse.Data/Configurations/`), or `WhereHouseDbContext`, **you MUST create and apply the EF Core migration yourself** as part of the task.

- **CRITICAL (`--project WhereHouse.Data` only):** `WhereHouse.Data` includes `WhereHouseDbContextFactory` (`IDesignTimeDbContextFactory<WhereHouseDbContext>`). Always run `dotnet ef` targeting **only** `--project WhereHouse.Data` (do **not** pass `--startup-project WhereHouse.API`). This avoids rebuilding `WhereHouse.API` and works even while the user has `WhereHouse.API` running in Visual Studio!

```powershell
# 1. Ensure local Docker SQL Server is running (if not already up)
.\scripts\ensure-local-infra.ps1

# 2. Generate the migration (from repo root)
dotnet ef migrations add <MigrationName> --project WhereHouse.Data

# 3. Apply the migration immediately to local SQL Server
dotnet ef database update --project WhereHouse.Data

# 4. Format the generated migration files with CSharpier
dotnet csharpier format WhereHouse.Data/Migrations
```

---

## 5. Code Formatting (Pre-Commit Requirement)

Before finishing a task or committing changes, always format backend and frontend code:

```powershell
# Format C# code (from repo root)
dotnet csharpier format .

# Format & lint Angular code (from WhereHouse.Client)
npm run format
npm run lint:fix
```
