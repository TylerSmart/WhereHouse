# Commands, Testing & Formatting Rules

> **Token-Saving Notice:** Use the exact commands below. Do not guess CLI flags.

## 1. Building & Running Tests (.NET 10 Microsoft.Testing.Platform)

This solution uses **.NET 10** and **MSTest.Sdk v4 (`Microsoft.Testing.Platform`)**.
- **IMPORTANT:** `dotnet test` in `.NET 10` with `Microsoft.Testing.Platform` requires `--project` when targeting a specific `.csproj` (passing a positional path without `--project` will fail with exit code 5).

```powershell
# Build entire solution (from repo root)
dotnet build WhereHouse.slnx

# Run unit tests (fast, no Docker required)
dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj
dotnet test --project Tests/WhereHouse.Infrastructure.UnitTests/WhereHouse.Infrastructure.UnitTests.csproj

# Run API integration tests (uses EF Core InMemory DB via WhereHouseWebApplicationFactory — no Docker required!)
dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj
```

## 2. Frontend Build, Lint & Unit Tests (`WhereHouse.Client`)

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

## 3. Code Formatting (Pre-Commit Requirement)

Before committing changes, always format backend and frontend code:

```powershell
# Format C# code (from repo root)
dotnet tool restore
dotnet csharpier format .

# Format & lint Angular code (from WhereHouse.Client)
npm run format
npm run lint:fix
```

## 4. Entity Framework Core Migrations

Run EF Core commands from the **repository root** (`d:\Personal\WhereHouse`):

```powershell
# Create a new migration after modifying entities/configurations in WhereHouse.Data
dotnet ef migrations add <MigrationName> --project WhereHouse.Data --startup-project WhereHouse.API

# Apply migrations to local Docker SQL Server (ensure Docker SQL is running via .\scripts\ensure-local-infra.ps1)
dotnet ef database update --project WhereHouse.Data --startup-project WhereHouse.API
```
