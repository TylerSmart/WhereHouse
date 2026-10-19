# Architecture & WhereHouse Domain Rules

## 1. Adding a New Vertical Slice (Checklist)

When implementing a new feature across the stack, follow the existing vertical-slice pattern (see the sample `Todo` slice for reference):

1. **`WhereHouse.Core/<Feature>/`**:
   - Define immutable C# `record` DTOs and Request models (with `DataAnnotations` validation attributes on Request records).
   - Define `I<Feature>Service` interface with async methods accepting `CancellationToken cancellationToken = default`.
2. **`WhereHouse.Data/`**:
   - Create entity in `Entities/<Entity>.cs` implementing `IAuditable`.
   - Create EF configuration in `Configurations/<Entity>Configuration.cs` implementing `IEntityTypeConfiguration<Entity>` (automatically discovered via `ApplyConfigurationsFromAssembly`).
   - Add `public DbSet<Entity> <Entities> => Set<Entity>();` to `WhereHouseDbContext`.
   - Implement `<Feature>Service` in `WhereHouse.Data/Services/` and register `services.AddScoped<I<Feature>Service, <Feature>Service>();` in `DataServiceCollectionExtensions.AddDataServices`.
   - **Create & apply the EF Core migration** (`dotnet ef migrations add <Name> --project WhereHouse.Data` and `dotnet ef database update --project WhereHouse.Data`), then format `WhereHouse.Data/Migrations` with CSharpier.
3. **`WhereHouse.API/Controllers/`**:
   - Create `<Feature>Controller` with `[ApiController]`, `[Authorize]`, and relative `[Route("<feature-kebab>")]` (do **not** prefix with `api/`—`Program.cs` mounts all controllers under `app.MapGroup("/api")`).
4. **`WhereHouse.Client/src/app/`**:
   - Add TypeScript interfaces in `core/models/<feature>.models.ts`.
   - Add `@Service()` HTTP service in `core/services/<feature>/<feature>.service.ts` using `apiUrl('/<feature-kebab>')`.
   - Add standalone feature components under `features/<feature>/` and register routes in `app.routes.ts`.
5. **Automated Tests & Verification Loop (Required on Every Implementation)**:
   - Add/update `.NET` Unit Tests (`WhereHouse.Core.UnitTests` / `WhereHouse.Infrastructure.UnitTests`), `.NET` API Integration Tests (`WhereHouse.API.IntegrationTests` via `WhereHouseWebApplicationFactory`), Angular `.spec.ts` unit tests, and Playwright E2E tests (`WhereHouse.Client.E2ETests` for end-to-end user flows).
   - Run all relevant builds, linters, and test suites; fix any errors and re-run until everything compiles and passes cleanly.

---

## 2. Core WhereHouse Domain Invariants (`docs/PRD.md`)

- **Nested Location Tree (`LocationNode`):**
  - Self-referencing hierarchy (`ParentId`).
  - Nodes are either **Fixed Locations** (Room, Closet, Rack, Shelf) or **Movable Containers** (Bin, Tote, Toolbox).
  - Moving a Movable Container updates only its `ParentId`; all child containers and items inside it automatically inherit the new location path.
- **Four Item Archetypes:**
  1. `Unique` (1-of-1 serialized/distinct assets)
  2. `Quantity` (stackable/consumable items with `CurrentQuantity`, `Unit`, and optional `MinQuantity` low-stock threshold)
  3. `Kit` (composite bundle whose checkout checks out all member items and warns if any child is broken/missing/loaned)
  4. `Nested` (parent item linked to child accessories/parts)
- **Permanent Home vs. Real-Time Status:**
  - Checking an item out (`InUse` or `LoanedOut`) **must never overwrite** its `HomeLocationId`.
  - Lifecycle states: `InPlace`, `InUse`, `LoanedOut`, `StagedToSell`, `StagedToDonate`, `Archived` (`Sold`, `Donated`, `Recycled`, `BrokenTrashed`, `Consumed`).
- **"Secret / Gift Mode" Privacy (`IsPrivate`):**
  - Items or Containers marked `IsPrivate = true` are strictly visible **only** to their `OwnerId` (and explicitly shared users).
  - Every query (search, bin contents, item counts, QR scan, dashboard widgets) **must** filter out private records when queried by other household users.
