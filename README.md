# WhereHouse

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Publish Docker](https://github.com/TylerSmart/WhereHouse/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/TylerSmart/WhereHouse/actions/workflows/docker-publish.yml)

**WhereHouse** is an open-source, self-hosted **home inventory, spatial item locator, and asset lifecycle vault** designed for **TrueNAS Scale** and homelab environments.

Organize everything you own across houses, rooms, shelves, and movable bins; print and scan QR labels with your phone camera for "X-Ray" bin inspection; check out tools and reusable project loadouts without losing track of their permanent home location; and store manuals, receipts, and warranty schedules in one place.

- **[Product Requirements Document (PRD)](docs/PRD.md)** — Full domain model, user workflows, and milestone roadmap.
- **[TrueNAS Scale Deployment Guide](docs/deployment/truenas-scale.md)** — Dataset setup, Docker Compose, and Nginx Proxy Manager configuration.
- **[Contributing & Local Development Guide](docs/contributing.md)** — Local Docker SQL Server setup, EF migrations, and testing commands.

---

## Core Capabilities

- **Spatial Hierarchy & Movable Containers:** Nested location tree (`House -> Room -> Rack -> Shelf -> Bin`) with visual container appearance badges (e.g., *27-Gal Black/Yellow Tote*). Moving a bin automatically relocates everything inside it.
- **QR & Barcode Workflows:** Generate printable Avery/thermal QR label sheets, bind pre-printed blank QR stickers on the fly, scan bins for "X-Ray Vision" contents, bulk-audit shelves, and scan retail UPC barcodes.
- **Check-In / Check-Out & Reusable Loadouts:** Track `In Place`, `In Use`, and external `Loaned Out` statuses without losing an item's permanent Home Location. Build reusable trip/project **Loadouts** with optimized room-by-room Pick Lists and Pack-Back return checklists.
- **Document Vault, Warranties & Insurance Export:** Attach receipts and PDF manuals (with full-text search), track return windows and recurring maintenance schedules, and generate 1-click Home Insurance claim ZIP/PDF exports.
- **Household Accounts & "Secret / Gift Mode":** Individual household profiles with private item/bin flags to keep gifts or sensitive items hidden from other household members.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | [Angular 22](https://angular.dev/), TypeScript, Angular Material 3, RxJS, Signals |
| **Backend** | [ASP.NET Core 10](https://dotnet.microsoft.com/), [Scalar](https://scalar.com/) OpenAPI (`/api/scalar`), Serilog |
| **Data & ORM** | [Microsoft SQL Server 2022](https://www.microsoft.com/sql-server), Entity Framework Core 10 |
| **Testing** | MSTest (`Microsoft.Testing.Platform`) + `WebApplicationFactory` (InMemory DB), Vitest, Playwright (E2E) |
| **Packaging** | Docker, Docker Compose, Multi-Arch Container Images via GitHub Actions |

---

## Quick Start (Docker Compose / TrueNAS Scale)

```yaml
name: where-house-prod

services:
  api:
    image: ghcr.io/tylersmart/wherehouse:latest
    container_name: where-house-api
    restart: unless-stopped
    ports:
      - "51793:8080"
    environment:
      ASPNETCORE_ENVIRONMENT: Production
      ASPNETCORE_HTTP_PORTS: 8080
      ConnectionStrings__DefaultConnection: "Server=sqlserver;Database=WhereHouse;User Id=sa;Password=YourStrongPassword123!_MustIncludeCaps;TrustServerCertificate=True;"
      Authentication__Jwt__Secret: "ReplaceWithAStrongSecretKeyAtLeast32CharactersLong!"
      Storage__UploadsPath: "/data/uploads"
    volumes:
      - /mnt/tank/wherehouse/uploads:/data/uploads
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
      - /mnt/tank/wherehouse/db:/var/opt/mssql
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
```

---

## Local Development

1. **Start Local SQL Server (`localhost,14333`):**
   ```powershell
   .\scripts\ensure-local-infra.ps1
   ```
2. **Run Backend API (`http://localhost:5041`):**
   ```powershell
   dotnet run --project WhereHouse.API
   ```
3. **Run Angular Dev Server (`http://localhost:4200`):**
   ```powershell
   cd WhereHouse.Client
   npm start
   ```
