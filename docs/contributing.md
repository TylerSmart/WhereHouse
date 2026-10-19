# Contributing to WhereHouse

Thank you for your interest in contributing to WhereHouse! We welcome contributions from everyone—whether you are fixing bugs, proposing new features, improving documentation, or testing out the application.

---

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How Can I Contribute?](#how-can-i-contribute)
   - [Reporting Bugs](#reporting-bugs)
   - [Suggesting Enhancements](#suggesting-enhancements)
   - [Pull Requests](#pull-requests)
3. [Local Development Environment](#local-development-environment)
   - [Prerequisites](#prerequisites)
   - [Setting Up Local Infrastructure](#setting-up-local-infrastructure)
   - [Running the Backend (API)](#running-the-backend-api)
   - [Running the Frontend (Angular)](#running-the-frontend-angular)
4. [Database Migrations (EF Core)](#database-migrations-ef-core)
5. [Code Quality & Standards](#code-quality--standards)
   - [Formatting & Linting](#formatting--linting)
   - [Running Tests](#running-tests)
6. [Commit & Branch Guidelines](#commit--branch-guidelines)

---

## Code of Conduct

We are committed to providing a welcoming, inclusive, and harassment-free environment for all contributors. Please treat fellow contributors with respect, empathy, and professional courtesy.

---

## How Can I Contribute?

### Reporting Bugs

Before creating a bug report, please check existing issues to ensure the bug hasn't already been reported. When filing a bug report, include:

- **A clear, descriptive title**.
- **Steps to reproduce** the issue step by step.
- **Expected behavior** vs. **actual behavior**.
- **Screenshots or console errors** if applicable.
- **Environment details**: Browser, operating system, and application version or commit SHA.

### Suggesting Enhancements

Feature requests are tracked as GitHub issues. When suggesting an enhancement, please explain:

- The problem or use case you are trying to solve.
- The proposed solution or behavior.
- Any alternative approaches or workarounds you considered.

### Pull Requests

1. **Fork the repository** to your own GitHub account.
2. **Clone your fork** and create a feature branch off `main` (`git checkout -b feature/my-new-feature`).
3. Make your changes following the [Code Quality & Standards](#code-quality--standards).
4. Verify that existing and new tests pass (`dotnet test` and `npm test`).
5. Commit your changes with clear, descriptive commit messages ([Conventional Commits](#commit--branch-guidelines) preferred).
6. Push to your fork and submit a Pull Request targeting `main`.

---

## Local Development Environment

### Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/download)
- [Node.js 22 LTS or newer](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (with Linux container support)

### Setting Up Local Infrastructure

For local development, Microsoft SQL Server runs in Docker on port `14333` while the .NET API and Angular client run natively on your host machine.

Run the setup script from the repository root:

```powershell
.\scripts\ensure-local-infra.ps1
```

This starts the SQL Server container (defined in `docker-compose.yml`) and ensures the `WhereHouse` database exists.

### Running the Backend (API)

```powershell
dotnet run --project WhereHouse.API
```

The API will start at `https://localhost:7080` / `http://localhost:5000` (or the ports configured in `launchSettings.json`). OpenAPI / Scalar documentation is accessible at `/scalar/v1`.

### Running the Frontend (Angular)

```powershell
cd WhereHouse.Client
npm install
npm start
```

The Angular dev server will start at `http://localhost:4200/` with hot-reload enabled.

---

## Database Migrations (EF Core)

Schema definitions live in `WhereHouseDbContext` (`WhereHouse.Data`).

Restore the EF CLI tool once per workstation:

```powershell
dotnet tool restore
```

All commands below should be executed from the repository root:

- **Add a new migration**:
  ```powershell
  dotnet ef migrations add <MigrationName> --project WhereHouse.Data --startup-project WhereHouse.API
  ```

- **Apply pending migrations**:
  ```powershell
  dotnet ef database update --project WhereHouse.Data --startup-project WhereHouse.API
  ```

- **List applied migrations**:
  ```powershell
  dotnet ef migrations list --project WhereHouse.Data --startup-project WhereHouse.API
  ```

- **Revert the last migration**:
  ```powershell
  dotnet ef database update <PreviousMigrationName> --project WhereHouse.Data --startup-project WhereHouse.API
  dotnet ef migrations remove --project WhereHouse.Data --startup-project WhereHouse.API
  ```

- **Generate raw SQL script**:
  ```powershell
  dotnet ef migrations script --project WhereHouse.Data --startup-project WhereHouse.API --output WhereHouse.sql
  ```

---

## Code Quality & Standards

### Formatting & Linting

We maintain consistent formatting via automated tooling:

- **Backend (.NET)**: Formatted using [CSharpier](https://csharpier.com/):
  ```powershell
  dotnet tool restore
  dotnet csharpier format .
  ```
- **Frontend (Angular)**: Formatted and linted using Prettier and ESLint:
  ```powershell
  cd WhereHouse.Client
  npm run lint:fix
  npm run format
  ```

### Running Tests

Ensure all test suites pass before submitting a pull request:

- **Backend Unit & Integration Tests**:
  ```powershell
  dotnet test
  ```

- **Frontend Unit Tests**:
  ```powershell
  cd WhereHouse.Client
  npm test
  ```

---

## Commit & Branch Guidelines

- **Branch Naming**:
  - `feature/<short-description>`
  - `fix/<short-description>`
  - `docs/<short-description>`
- **Commit Messages**: Follow [Conventional Commits](https://www.conventionalcommits.org/):
  - `feat: add task due date filtering`
  - `fix: resolve token refresh race condition`
  - `docs: update OIDC setup guide for Keycloak`
  - `chore: update dependencies`

---

*Thank you for contributing to WhereHouse!*
