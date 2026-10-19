# Using This Repository as a Project Template

This guide walks you through turning **WhereHouse** into a brand-new full-stack `.NET 10 + Angular 22` project—including a single automated PowerShell script to rename every namespace, file, folder, Docker container, configuration key, and **randomize the external Docker host port** so your deployed apps never collide on your NAS or server.

---

## Table of Contents

1. [1. Create a New Repository from the Template](#1-create-a-new-repository-from-the-template)
2. [2. Naming & Randomized Port Conventions](#2-naming--randomized-port-conventions)
3. [3. Option A: Automated Rename & Port Randomization Script (Recommended)](#3-option-a-automated-rename--port-randomization-script-recommended)
4. [4. Option B: Manual Find & Replace Steps](#4-option-b-manual-find--replace-steps)
5. [5. Post-Rename Verification Checklist](#5-post-rename-verification-checklist)
6. [6. Replacing the Sample `Todo` Vertical Slice](#6-replacing-the-sample-todo-vertical-slice)

---

## 1. Create a New Repository from the Template

1. On GitHub, open your **WhereHouse** repository settings and check **Template repository** (under *General*).
2. Click **Use this template** -> **Create a new repository** (or fork/clone and point `git remote set-url origin` to your new repo).
3. Clone your new repository locally:
   ```powershell
   git clone https://github.com/<your-username>/<your-new-repo>.git
   cd <your-new-repo>
   ```

---

## 2. Naming & Randomized Port Conventions

Across the codebase, the template name appears in four casing styles, plus a **randomized host port (`51793`)** used for production Docker / TrueNAS deployments so that multiple self-hosted apps never compete for the same host port.

| Placeholder | Type | Example Replacement | Where It Is Used |
|---|---|---|---|
| `WhereHouse` | **PascalCase** | `InvoiceTracker` | C# namespaces, `.csproj` / `.esproj` / `.slnx` files, project directories, `WhereHouseDbContext`, `appsettings.json` keys, UI brand title |
| `whereHouse` | **camelCase** | `invoiceTracker` | Local C# / TypeScript variable names (e.g., `whereHouseConnectionString`) |
| `where-house` | **kebab-case** | `invoice-tracker` | Docker container names (`where-house-api`, `where-house-sqlserver`), `localStorage` keys (`where-house-token`, `where-house-theme`), log file prefix |
| `wherehouse` | **lowercase** | `invoicetracker` | GHCR Docker image path (`ghcr.io/<owner>/invoicetracker`), TrueNAS dataset paths (`/mnt/tank/invoicetracker`), Nginx config filenames |
| `51793` | **Randomized Host Port** | *(Auto-generated, e.g. `54821`)* | Host port mapped to container port `8080` (`"<RANDOM_PORT>:8080"`) in [`README.md`](../README.md) and [`docs/deployment/`](deployment/) so each app deployed to your NAS/server gets a unique port |

> [!TIP]
> **Local Development Ports**:
> During local development, the Angular dev server (`4200`), .NET API (`5041` HTTP / `7127` HTTPS), and local SQL Server Docker container (`14333`) only run while you are actively coding. If you ever want to run two projects side-by-side in local development at the exact same time, you can also change `5041` (in `launchSettings.json` and `proxy.conf.json`) and `14333` (in `docker-compose.yml` and `appsettings.Development.json`).

---

## 3. Option A: Automated Rename & Port Randomization Script (Recommended)

Run the following PowerShell snippet from the **root of your cloned repository**. Set `$PascalName`, `$CamelName`, `$KebabName`, and `$LowerName` at the top—the script will automatically generate a random host port in the ephemeral range (`49152..65535`) to replace `51793` and rename every file and directory:

```powershell
# ==============================================================================
# 1. Set your new project names in all 4 casing styles + randomized host port:
# ==============================================================================
$PascalName  = "MyNewProject"                           # Replaces WhereHouse
$CamelName   = "myNewProject"                           # Replaces whereHouse
$KebabName   = "my-new-project"                         # Replaces where-house
$LowerName   = "mynewproject"                           # Replaces wherehouse
$AppHostPort = (Get-Random -Minimum 49152 -Maximum 65535).ToString() # Replaces 51793

Write-Host "Initializing $PascalName with randomized Docker host port: $AppHostPort" -ForegroundColor Cyan

# ==============================================================================
# 2. Clean build artifacts and node_modules before renaming
# ==============================================================================
Get-ChildItem -Recurse -Directory -Include bin,obj,dist,.angular,node_modules |
    Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

# ==============================================================================
# 3. Replace text contents across all tracked text files (case-sensitive)
# ==============================================================================
$files = git ls-files | Where-Object {
    $_ -notmatch '\.(ico|png|jpg|jpeg|gif|svg|woff2?)$' -and (Test-Path $_)
}

foreach ($file in $files) {
    $path = Resolve-Path $file
    $content = [System.IO.File]::ReadAllText($path)
    $updated = $content `
        .Replace('WhereHouse', $PascalName) `
        .Replace('whereHouse', $CamelName) `
        .Replace('where-house', $KebabName) `
        .Replace('wherehouse', $LowerName) `
        .Replace('51793', $AppHostPort)

    if ($content -cne $updated) {
        [System.IO.File]::WriteAllText($path, $updated, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "Updated contents: $file"
    }
}

# ==============================================================================
# 4. Rename files containing 'WhereHouse' in their filename
# ==============================================================================
Get-ChildItem -Recurse -File -Filter "*WhereHouse*" |
    Where-Object { $_.FullName -notmatch '\\(node_modules|\.git|bin|obj|dist)\\' } |
    ForEach-Object {
        $newFileName = $_.Name.Replace('WhereHouse', $PascalName)
        Rename-Item -LiteralPath $_.FullName -NewName $newFileName
        Write-Host "Renamed file: $($_.Name) -> $newFileName"
    }

# ==============================================================================
# 5. Rename project and test directories (deepest paths first)
# ==============================================================================
Get-ChildItem -Recurse -Directory -Filter "*WhereHouse*" |
    Where-Object { $_.FullName -notmatch '\\(node_modules|\.git|bin|obj|dist)\\' } |
    Sort-Object { $_.FullName.Length } -Descending |
    ForEach-Object {
        $newDirName = $_.Name.Replace('WhereHouse', $PascalName)
        Rename-Item -LiteralPath $_.FullName -NewName $newDirName
        Write-Host "Renamed directory: $($_.Name) -> $newDirName"
    }

Write-Host "`nDone! Assigned randomized host port: $AppHostPort (mapped to container port 8080)." -ForegroundColor Green
Write-Host "Run 'git status' to review the renamed project." -ForegroundColor Green
```

---

## 4. Option B: Manual Find & Replace Steps

If you prefer using VS Code or Visual Studio's global **Find and Replace** (`Ctrl+Shift+H`) with **Match Case (`Aa`)** enabled:

1. **Find**: `WhereHouse` -> **Replace**: `YourProjectName`
2. **Find**: `whereHouse` -> **Replace**: `yourProjectName`
3. **Find**: `where-house` -> **Replace**: `your-project-name`
4. **Find**: `wherehouse` -> **Replace**: `yourprojectname`
5. **Find**: `51793` -> **Replace**: a newly generated random port (run `Get-Random -Minimum 49152 -Maximum 65535` in PowerShell so this app uses a unique port on your NAS/server)
6. Rename the following files:
   - `WhereHouse.slnx` -> `YourProjectName.slnx`
   - `WhereHouse.slnLaunch` -> `YourProjectName.slnLaunch`
   - `WhereHouse.API/WhereHouse.API.csproj` -> `YourProjectName.API.csproj`
   - `WhereHouse.Client/WhereHouse.Client.esproj` -> `YourProjectName.Client.esproj`
   - `WhereHouse.Core/WhereHouse.Core.csproj` -> `YourProjectName.Core.csproj`
   - `WhereHouse.Data/WhereHouse.Data.csproj` -> `YourProjectName.Data.csproj`
   - `WhereHouse.Data/WhereHouseDbContext.cs` -> `YourProjectNameDbContext.cs`
   - `WhereHouse.Data/WhereHouseDbContextFactory.cs` -> `YourProjectNameDbContextFactory.cs`
   - `WhereHouse.Data/Migrations/WhereHouseDbContextModelSnapshot.cs` -> `YourProjectNameDbContextModelSnapshot.cs`
   - `WhereHouse.Infrastructure/WhereHouse.Infrastructure.csproj` -> `YourProjectName.Infrastructure.csproj`
   - `Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj` -> `YourProjectName.API.IntegrationTests.csproj`
   - `Tests/WhereHouse.API.IntegrationTests/WhereHouseWebApplicationFactory.cs` -> `YourProjectNameWebApplicationFactory.cs`
   - `Tests/WhereHouse.Client.E2ETests/WhereHouse.Client.E2ETests.csproj` -> `YourProjectName.Client.E2ETests.csproj`
   - `Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj` -> `YourProjectName.Core.UnitTests.csproj`
   - `Tests/WhereHouse.Infrastructure.UnitTests/WhereHouse.Infrastructure.UnitTests.csproj` -> `YourProjectName.Infrastructure.UnitTests.csproj`
7. Rename the 9 project folders (`WhereHouse.API`, `WhereHouse.Client`, `WhereHouse.Core`, `WhereHouse.Data`, `WhereHouse.Infrastructure`, and the 4 folders under `Tests/`).

---

## 5. Post-Rename Verification Checklist

After running the rename script:

1. **Generate a fresh UserSecretsId** (optional) in `<YourProjectName>.API/<YourProjectName>.API.csproj`.
2. **Verify Backend Build & Tests**:
   ```powershell
   dotnet test
   ```
3. **Verify Frontend Dependencies, Lint, Build, & Unit Tests**:
   ```powershell
   cd <YourProjectName>.Client
   npm install
   npm run lint
   npm run build
   npm test -- --watch=false
   ```
4. **Stage and Commit**:
   ```powershell
   git add -A
   git commit -m "chore: initialize project from WhereHouse"
   ```

---

## 6. Replacing the Sample `Todo` Vertical Slice

The template includes a minimal end-to-end **`TodoItem`** CRUD feature so you have a working reference pattern across every layer. When you are ready to build your own domain features, you can either modify or remove these files:

| Layer | Files in the Sample `Todo` Slice |
|---|---|
| **Core (Contracts & DTOs)** | `WhereHouse.Core/Todos/TodoModels.cs`, `WhereHouse.Core/Todos/ITodoService.cs` |
| **Data (EF Core Entity & Service)** | `WhereHouse.Data/Entities/TodoItem.cs`, `WhereHouse.Data/Configurations/TodoItemConfiguration.cs`, `WhereHouse.Data/Services/TodoService.cs` (+ `DbSet<TodoItem>` in `WhereHouseDbContext.cs` and registration in `DataServiceCollectionExtensions.cs`) |
| **API (Controller)** | `WhereHouse.API/Controllers/TodosController.cs` |
| **Integration Tests** | `Tests/WhereHouse.API.IntegrationTests/TodoIntegrationTests.cs` |
| **Angular Client** | `WhereHouse.Client/src/app/core/models/todo.models.ts`, `WhereHouse.Client/src/app/core/services/todo/`, `WhereHouse.Client/src/app/features/dashboard/todo-dialog/`, `WhereHouse.Client/src/app/features/dashboard/` |

After adding your own entities to `DbContext`, generate a new migration:

```powershell
dotnet ef migrations add YourNewMigration --project <YourProjectName>.Data --startup-project <YourProjectName>.API
```
