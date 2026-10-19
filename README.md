# WhereHouse (.NET 10 + Angular 22)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Publish Docker](https://github.com/TylerSmart/WhereHouse/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/TylerSmart/WhereHouse/actions/workflows/docker-publish.yml)

**WhereHouse** is a production-ready, self-hostable full-stack starter template built with **ASP.NET Core 10**, **Entity Framework Core (SQL Server)**, and **Angular 22 (Material 3)**. It provides authentication (local JWT + external OIDC/SSO), automatic database migrations, entity auditing, customizable theming, multi-arch Docker packaging, and NAS/homelab deployment guides out of the box.

> [!IMPORTANT]
> **Starting a new project from this template?**
> Follow the **[Template Usage & Project Rename Guide](docs/template-usage.md)** for a single PowerShell script and step-by-step instructions to rename `WhereHouse` (`where-house`, `wherehouse`) to your new project's name and automatically assign a **randomized external host port** so your deployed apps never collide on your NAS.

---

## What's Included ("The Bones")

- **Authentication & Single Sign-On (SSO / OIDC)**:
  - Local email/password registration & login with PBKDF2-SHA256 password hashing and JWT bearer tokens.
  - External OIDC / OAuth 2.0 support (Google, Authentik, Keycloak, Microsoft Entra ID) with automatic account linking and user provisioning via `DualBearerAuthenticationHandler`.
- **Clean Architecture & EF Core Data Layer**:
  - Separated into `.API`, `.Core`, `.Data`, and `.Infrastructure` projects.
  - Automatic startup database creation & schema migration (`db.Database.Migrate()`).
  - Automatic `CreatedAt`/`CreatedBy`/`ModifiedAt`/`ModifiedBy` auditing via `IAuditable` and `AuditSaveChangesInterceptor`.
- **Dynamic Material 3 Theming**:
  - Light, Dark, and System theme modes with a live **Theme Customizer Dialog** supporting custom primary/secondary/tertiary color palettes and typography persisted in `localStorage`.
- **Sample End-to-End CRUD Vertical Slice (`TodoItem`)**:
  - Reference implementation spanning Entity, EF Core Configuration, Core Service Interface, Data Service with ownership checks, REST Controller (`TodosController`), OpenAPI/Scalar docs, Angular Service, Dashboard UI, and Unit/Integration Tests.
- **Unified Single-Container Deployment**:
  - Multi-stage `Dockerfile` that compiles the Angular SPA into the ASP.NET Core `wwwroot` directory and publishes multi-arch (`linux/amd64`, `linux/arm64`) images to GitHub Container Registry (GHCR).
- **Developer Experience & Quality Gates**:
  - Pre-commit hooks via Husky + `lint-staged` running ESLint, Prettier, and CSharpier automatically.
  - Local SQL Server Docker container orchestration (`scripts/ensure-local-infra.ps1`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | [Angular 22](https://angular.dev/), TypeScript, Angular Material 3, RxJS, Signals |
| **Backend** | [ASP.NET Core 10](https://dotnet.microsoft.com/), [Scalar](https://scalar.com/) OpenAPI, Serilog |
| **Data & ORM** | [Microsoft SQL Server 2022](https://www.microsoft.com/sql-server), Entity Framework Core 10 |
| **Testing** | MSTest + `WebApplicationFactory` (In-Memory DB Integration Tests), Vitest (Angular Unit Tests), Playwright (E2E) |
| **Packaging** | Docker, Docker Compose, Multi-Arch Container Images via GitHub Actions |

---

## Quick Start (Docker)

You can launch the full stack in seconds using Docker Compose:

```yaml
name: where-house-prod

services:
  api:
    image: ghcr.io/tylersmart/wherehouse:latest
    container_name: where-house-api
    restart: unless-stopped
    ports:
      # Randomized host port (51793 -> 8080) to avoid port collisions across multiple apps on your NAS/server.
      # The template initialization script (docs/template-usage.md) automatically generates a unique random port per project.
      - "51793:8080"
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ASPNETCORE_HTTP_PORTS: 8080
      ConnectionStrings__DefaultConnection: "Server=sqlserver;Database=WhereHouse;User Id=sa;Password=YourStrongPassword123!_MustIncludeCaps;TrustServerCertificate=True;"
      Authentication__Jwt__Secret: "ReplaceWithAStrongSecretKeyAtLeast32CharactersLong!"
    depends_on:
      sqlserver:
        condition: service_healthy

  sqlserver:
    image: mcr.microsoft.com/mssql/server:2022-latest
    container_name: where-house-sqlserver
    restart: unless-stopped
    environment:
      ACCEPT_EULA: "Y"
      MSSQL_SA_PASSWORD: "YourStrongPassword123!_MustIncludeCaps"
      MSSQL_PID: "Developer"
    volumes:
      - sqlserver_data:/var/opt/mssql
    healthcheck:
      test:
        [
          "CMD-SHELL",
          "/opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P 'YourStrongPassword123!_MustIncludeCaps' -C -Q 'SELECT 1' -b -o /dev/null",
        ]
      interval: 5s
      timeout: 5s
      retries: 24
      start_period: 20s

volumes:
  sqlserver_data:
```

Run:

```bash
docker compose up -d
```

Open `http://localhost:51793` (or your project's randomized host port) in your web browser.

---

## Documentation

All documentation is organized in the [`docs/`](docs/) directory using consistent `kebab-case` naming:

- 🧩 **[Template Usage & Rename Guide](docs/template-usage.md)** — How to fork/use this template, rename `WhereHouse` to your new project name, and auto-assign a randomized host port.
- 🐳 **[Production Docker Deployment Guide](docs/deployment/docker-deployment.md)** — Step-by-step production deployment with reverse proxies (Nginx, Caddy, Traefik, Cloudflare Tunnel), automated backups, and environment tuning.
- 🚀 **[TrueNAS Scale Deployment Guide](docs/deployment/truenas-scale.md)** — Native Docker Compose setup for TrueNAS Scale (Electric Eel 24.10+) and Dragonfish (24.04), ZFS datasets, and automated snapshots.
- 🔐 **[OIDC & SSO Authentication Guide](docs/deployment/oidc-authentication.md)** — Configure Single Sign-On with Google OAuth 2.0, Authentik, Keycloak, or Microsoft Entra ID.
- 🛠️ **[Contributing & Development Guide](docs/contributing.md)** — Workstation setup (.NET 10 & Angular 22), database migrations (EF Core), code styling, and test execution.

---

## License

This template is free and open-source software licensed under the **[MIT License](LICENSE)**.
