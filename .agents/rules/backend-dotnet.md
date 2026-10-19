# Backend (.NET 10 & EF Core) Conventions

## 1. C# 14 & Project Style
- **Target Framework:** `net10.0` with `<Nullable>enable</Nullable>` and `<ImplicitUsings>enable</ImplicitUsings>`.
- Use **file-scoped namespaces** (`namespace WhereHouse.Data.Services;`).
- Prefer **`sealed` classes** for services, controllers, EF configurations, and interceptors unless inheritance is explicitly designed.
- Use **primary constructors** for dependency injection (e.g., `public sealed class TodoService(WhereHouseDbContext dbContext) : ITodoService`).
- Use **immutable positional `record`s** for DTOs and Request payloads in `WhereHouse.Core`.
- Format all C# code using **CSharpier** (`dotnet csharpier format .`).

## 2. API Controllers & Routing (`WhereHouse.API`)
- **Route Prefix:** `Program.cs` maps controllers via `app.MapGroup("/api").MapControllers()`. Always use relative route templates on controllers (e.g., `[Route("items")]` or `[Route("location-nodes")]`, **never** `[Route("api/items")]`).
- **Authentication & User Resolution:**
  - Default to `[Authorize]` at the controller level.
  - Resolve the authenticated user's `Guid` from `ClaimTypes.NameIdentifier` or `"sub"` claim (or inject `IUserContext`).
- **OpenAPI / Scalar Annotations:**
  - Always decorate endpoints with `[ProducesResponseType(typeof(...), StatusCodes.Status200OK)]` (and `400`, `403`, `404`, `201`, `204` as applicable) so `/api/scalar` and `/api/openapi/v1.json` stay accurate.
- **Domain Exceptions (`WhereHouse.Core.Exceptions`):**
  - Throw `ForbiddenException` from services when a user attempts to access a resource they do not have permission for (e.g., another user's private/secret item) and return `Forbid()` (`403`) in the controller.
  - Return `null` or `false` from services when an entity is not found, and map to `NotFound()` (`404`) in the controller.

## 3. Entity Framework Core (`WhereHouse.Data`)
- **Auditing (`IAuditable`):**
  - Domain entities must implement `IAuditable` (`CreatedAt`, `CreatedBy`, `ModifiedAt`, `ModifiedBy`).
  - **Do not manually set** `CreatedAt`/`ModifiedAt`/`CreatedBy`/`ModifiedBy` in service methods—`AuditSaveChangesInterceptor` populates them automatically on `SaveChanges` / `SaveChangesAsync`.
- **Entity Configurations:**
  - Place all schema rules (table name, keys, max lengths, indexes, cascade behavior) in `WhereHouse.Data/Configurations/<Entity>Configuration.cs` implementing `IEntityTypeConfiguration<T>`.
  - Do not clutter entity classes with `[MaxLength]` or `[Table]` attributes; keep entity classes clean POCOs.
- **Query Performance:**
  - Always use `.AsNoTracking()` on read-only queries (`Get*` methods).
  - Always pass `CancellationToken` to EF Core async methods (`ToListAsync`, `FirstOrDefaultAsync`, `SaveChangesAsync`).
