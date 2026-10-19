# Phase 01: Spatial Hierarchy, Movable Containers & Sample Todo Cleanup

> **Branch:** `feature/phase-01-location-hierarchy`
> **Status:** Completed (`[ ]` Not Started | `[~]` In Progress | `[x]` Completed)
> **PRD Reference:** `docs/PRD.md` — Sections 4.1 (`Spatial Hierarchy & Movable Containers`), 4.3.1 (`Identifiers & QR Encoding`), 4.8.2 (`Household User Accounts & "Secret / Gift Mode"`), and 5 (`UX & Responsive Design Principles`)
> **Target Execution:** Run `/execute-phase` with your implementation model to execute this plan step-by-step.

---

## 1. Scope & Objectives

This phase establishes the spatial backbone of **WhereHouse** (Milestone 1, Slice 1) and replaces the starter template's sample `Todo` vertical slice with the **Spatial Hierarchy & Movable Containers** system:

1. **Sample `Todo` Vertical Slice Cleanup:**
   - Remove `TodoItem`, `ITodoService`, `TodoService`, `TodosController`, `TodoIntegrationTests`, and the Angular `TodoService` / `TodoDialogComponent` across all layers.
   - Retain `ConfirmDialogComponent` (`src/app/features/dashboard/confirm-delete-dialog/confirm-delete-dialog.component.ts`) for destructive action confirmation.
2. **Flexible Nested Location & Container Tree (`LocationNode`):**
   - Arbitrary-depth self-referencing hierarchy (`ParentId`) supporting both **Fixed Locations** (rooms, garages, closets, shelving units, shelves, drawers) and **Movable Containers** (bins, totes, toolboxes, cases, organizers).
   - Automatic human-readable short code generation (`LOC-001`, `LOC-002`... for Fixed Locations; `BIN-001`, `BIN-002`... for Movable Containers) alongside custom short code support.
3. **Container Relocation Inheritance & Cycle Prevention:**
   - Moving a Movable Container (or Location) updates only its `ParentId`. All nested child containers automatically resolve their updated `FullPath` (`House > Basement > Under-Stairs > Winter Camping Bin #4`) and `Breadcrumbs` without item-by-item edits.
   - Cycle detection prevents moving a node into itself or any of its own descendants.
4. **Container Visual Appearance Metadata:**
   - Support `ContainerStyle` (e.g., `27-Gal Heavy Duty Tote`, `Clear Shoebox`, `Pelican Case`), `PrimaryColor`, `AccentColor`, and `ColorLabel` (e.g., `Black Base / Yellow Lid`) rendered as visual badges in the UI.
5. **"Secret / Gift Mode" (`IsPrivate`) Privacy Enforcement:**
   - Any location or container marked `IsPrivate = true` (and its entire nested subtree) is strictly visible only to its `OwnerId`. Non-owners receive `403 Forbidden` on direct ID access and never see private nodes in tree or list queries.
6. **Responsive Spatial Explorer UI (`WhereHouse.Client`):**
   - Replace the sample tasks dashboard with the WhereHouse **Locations & Containers Explorer**: collapsible tree sidebar on desktop, breadcrumb trail, filterable sub-locations & movable containers grid with visual color badges, Create/Edit Location & Container dialog, Move/Reparent dialog, and mobile-first (`360px`) responsiveness.

### Explicitly Out of Scope for Phase 01 (Deferred to Subsequent Phases)
- Categories, Attribute Templates, and the 4 Item Archetypes (Phase 02).
- File Attachments (Photos, Receipts, Manuals) & Smart Search (Phase 03).
- QR PDF Label Printing & Camera Scanner (Milestone 2).

---

## 2. File Inventory (Create / Modify / Delete)

### 2.1 Files to Delete (Sample `Todo` Cleanup)
- `WhereHouse.Core/Todos/ITodoService.cs`
- `WhereHouse.Core/Todos/TodoModels.cs`
- `WhereHouse.Data/Entities/TodoItem.cs`
- `WhereHouse.Data/Configurations/TodoItemConfiguration.cs`
- `WhereHouse.Data/Services/TodoService.cs`
- `WhereHouse.API/Controllers/TodosController.cs`
- `Tests/WhereHouse.API.IntegrationTests/TodoIntegrationTests.cs`
- `WhereHouse.Client/src/app/core/models/todo.models.ts`
- `WhereHouse.Client/src/app/core/services/todo/todo.service.ts`
- `WhereHouse.Client/src/app/core/services/todo/todo.service.spec.ts`
- `WhereHouse.Client/src/app/features/dashboard/todo-dialog/todo-dialog.component.ts`
- `WhereHouse.Client/src/app/features/dashboard/todo-dialog/todo-dialog.component.spec.ts`

### 2.2 Files to Create
- `WhereHouse.Core/Locations/LocationModels.cs`
- `WhereHouse.Core/Locations/ILocationService.cs`
- `WhereHouse.Data/Entities/LocationNode.cs`
- `WhereHouse.Data/Configurations/LocationNodeConfiguration.cs`
- `WhereHouse.Data/Services/LocationService.cs`
- `WhereHouse.API/Controllers/LocationsController.cs`
- `Tests/WhereHouse.Core.UnitTests/LocationShortCodeTests.cs`
- `Tests/WhereHouse.API.IntegrationTests/LocationIntegrationTests.cs`
- `WhereHouse.Client/src/app/core/models/location.models.ts`
- `WhereHouse.Client/src/app/core/services/location/location.service.ts`
- `WhereHouse.Client/src/app/core/services/location/location.service.spec.ts`
- `WhereHouse.Client/src/app/features/dashboard/location-dialog/location-dialog.component.ts`
- `WhereHouse.Client/src/app/features/dashboard/location-dialog/location-dialog.component.spec.ts`
- `WhereHouse.Client/src/app/features/dashboard/move-location-dialog/move-location-dialog.component.ts`
- `WhereHouse.Client/src/app/features/dashboard/move-location-dialog/move-location-dialog.component.spec.ts`

### 2.3 Files to Modify
- `WhereHouse.Data/Entities/User.cs`
- `WhereHouse.Data/WhereHouseDbContext.cs`
- `WhereHouse.Data/DataServiceCollectionExtensions.cs`
- `Tests/WhereHouse.API.IntegrationTests/OpenApiIntegrationTests.cs`
- `WhereHouse.Client/src/app/features/dashboard/dashboard.component.ts`
- `WhereHouse.Client/src/app/features/dashboard/dashboard.component.html`
- `WhereHouse.Client/src/app/features/dashboard/dashboard.component.scss`
- `WhereHouse.Client/src/app/features/dashboard/dashboard.component.spec.ts`

---

## 3. Domain & Database Design (`WhereHouse.Core` & `WhereHouse.Data`)

### 3.1 Enums & DTOs (`WhereHouse.Core/Locations/LocationModels.cs`)

```csharp
using System.ComponentModel.DataAnnotations;

namespace WhereHouse.Core.Locations;

public enum LocationNodeType
{
    FixedLocation = 0,
    MovableContainer = 1,
}

public sealed record LocationBreadcrumbDto(
    Guid Id,
    string Name,
    string ShortCode,
    LocationNodeType NodeType
);

public sealed record LocationNodeDto(
    Guid Id,
    Guid? ParentId,
    string Name,
    string? Description,
    LocationNodeType NodeType,
    string ShortCode,
    string? Icon,
    string? ContainerStyle,
    string? PrimaryColor,
    string? AccentColor,
    string? ColorLabel,
    bool IsPrivate,
    Guid OwnerId,
    string FullPath,
    IReadOnlyList<LocationBreadcrumbDto> Breadcrumbs,
    int ChildCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset ModifiedAt
);

public sealed record LocationTreeNodeDto(
    Guid Id,
    Guid? ParentId,
    string Name,
    LocationNodeType NodeType,
    string ShortCode,
    string? Icon,
    string? ContainerStyle,
    string? PrimaryColor,
    string? AccentColor,
    string? ColorLabel,
    bool IsPrivate,
    Guid OwnerId,
    string FullPath,
    IReadOnlyList<LocationTreeNodeDto> Children
);

public sealed record CreateLocationNodeRequest(
    [Required, MaxLength(150)] string Name,
    LocationNodeType NodeType = LocationNodeType.FixedLocation,
    Guid? ParentId = null,
    [MaxLength(1000)] string? Description = null,
    [MaxLength(32)] string? ShortCode = null,
    [MaxLength(64)] string? Icon = null,
    [MaxLength(100)] string? ContainerStyle = null,
    [MaxLength(32)] string? PrimaryColor = null,
    [MaxLength(32)] string? AccentColor = null,
    [MaxLength(100)] string? ColorLabel = null,
    bool IsPrivate = false
);

public sealed record UpdateLocationNodeRequest(
    [Required, MaxLength(150)] string Name,
    LocationNodeType NodeType,
    [MaxLength(1000)] string? Description = null,
    [MaxLength(64)] string? Icon = null,
    [MaxLength(100)] string? ContainerStyle = null,
    [MaxLength(32)] string? PrimaryColor = null,
    [MaxLength(32)] string? AccentColor = null,
    [MaxLength(100)] string? ColorLabel = null,
    bool IsPrivate = false
);

public sealed record MoveLocationNodeRequest(Guid? NewParentId);
```

Also include a pure static helper `LocationShortCodeGenerator` in `WhereHouse.Core/Locations/LocationModels.cs` (so it can be directly unit-tested in `WhereHouse.Core.UnitTests`):
- `public static string GetPrefix(LocationNodeType nodeType) => nodeType == LocationNodeType.MovableContainer ? "BIN" : "LOC";`
- `public static string NormalizeShortCode(string rawCode) => rawCode.Trim().ToUpperInvariant();`
- `public static string GenerateNextShortCode(LocationNodeType nodeType, IEnumerable<string> existingCodes)`:
  - Determines prefix (`"LOC"` or `"BIN"`).
  - Scans `existingCodes` matching `"{prefix}-<int>"` (case-insensitive), finds the highest positive integer `<int>`, and returns `$"{prefix}-{(max + 1):D3}"` (e.g., `"LOC-001"`, `"BIN-001"`, `"BIN-042"`).

### 3.2 Service Interface (`WhereHouse.Core/Locations/ILocationService.cs`)

```csharp
namespace WhereHouse.Core.Locations;

public interface ILocationService
{
    Task<IReadOnlyList<LocationTreeNodeDto>> GetLocationTreeAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<LocationNodeDto>> GetLocationNodesAsync(
        Guid userId,
        Guid? parentId = null,
        bool includeAllDepths = false,
        string? search = null,
        CancellationToken cancellationToken = default
    );

    Task<LocationNodeDto?> GetLocationNodeByIdAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );

    Task<LocationNodeDto> CreateLocationNodeAsync(
        Guid userId,
        CreateLocationNodeRequest request,
        CancellationToken cancellationToken = default
    );

    Task<LocationNodeDto?> UpdateLocationNodeAsync(
        Guid userId,
        Guid id,
        UpdateLocationNodeRequest request,
        CancellationToken cancellationToken = default
    );

    Task<LocationNodeDto?> MoveLocationNodeAsync(
        Guid userId,
        Guid id,
        MoveLocationNodeRequest request,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteLocationNodeAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );
}
```

### 3.3 Entities (`WhereHouse.Data/Entities/`)

#### `WhereHouse.Data/Entities/LocationNode.cs`
```csharp
using WhereHouse.Core.Locations;

namespace WhereHouse.Data.Entities;

public sealed class LocationNode : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? ParentId { get; set; }

    public LocationNode? Parent { get; set; }

    public ICollection<LocationNode> Children { get; set; } = new List<LocationNode>();

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public LocationNodeType NodeType { get; set; } = LocationNodeType.FixedLocation;

    public string ShortCode { get; set; } = string.Empty;

    public string? Icon { get; set; }

    public string? ContainerStyle { get; set; }

    public string? PrimaryColor { get; set; }

    public string? AccentColor { get; set; }

    public string? ColorLabel { get; set; }

    public bool IsPrivate { get; set; }

    public Guid OwnerId { get; set; }

    public User Owner { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
```

#### `WhereHouse.Data/Entities/User.cs`
- Replace `public ICollection<TodoItem> TodoItems { get; set; } = new List<TodoItem>();` with:
  ```csharp
  public ICollection<LocationNode> OwnedLocations { get; set; } = new List<LocationNode>();
  ```

### 3.4 EF Core Fluent Configuration (`WhereHouse.Data/Configurations/LocationNodeConfiguration.cs`)

- Table name: `"LocationNodes"`
- Primary Key: `l => l.Id`
- Property constraints:
  - `Name`: `.IsRequired().HasMaxLength(150)`
  - `Description`: `.HasMaxLength(1000)`
  - `ShortCode`: `.IsRequired().HasMaxLength(32)`
  - `Icon`: `.HasMaxLength(64)`
  - `ContainerStyle`: `.HasMaxLength(100)`
  - `PrimaryColor`: `.HasMaxLength(32)`
  - `AccentColor`: `.HasMaxLength(32)`
  - `ColorLabel`: `.HasMaxLength(100)`
  - `CreatedBy`: `.IsRequired().HasMaxLength(256)`
  - `ModifiedBy`: `.IsRequired().HasMaxLength(256)`
- Indexes:
  - `builder.HasIndex(l => l.ShortCode).IsUnique();`
  - `builder.HasIndex(l => l.ParentId);`
  - `builder.HasIndex(l => l.OwnerId);`
- Relationships & SQL Server `DeleteBehavior` (CRITICAL — prevents SQL Server multiple cascade path errors):
  - Self-referencing parent relationship:
    ```csharp
    builder
        .HasOne(l => l.Parent)
        .WithMany(p => p.Children)
        .HasForeignKey(l => l.ParentId)
        .OnDelete(DeleteBehavior.Restrict);
    ```
  - Owner relationship:
    ```csharp
    builder
        .HasOne(l => l.Owner)
        .WithMany(u => u.OwnedLocations)
        .HasForeignKey(l => l.OwnerId)
        .OnDelete(DeleteBehavior.Restrict);
    ```

### 3.5 `WhereHouseDbContext` & DI Registration
- In `WhereHouse.Data/WhereHouseDbContext.cs`:
  - Replace `public DbSet<TodoItem> TodoItems => Set<TodoItem>();` with `public DbSet<LocationNode> LocationNodes => Set<LocationNode>();`.
- In `WhereHouse.Data/DataServiceCollectionExtensions.cs`:
  - Replace `using WhereHouse.Core.Todos;` with `using WhereHouse.Core.Locations;`.
  - Replace `services.AddScoped<ITodoService, TodoService>();` with `services.AddScoped<ILocationService, LocationService>();`.
- **EF Core Migration Name:** `AddLocationHierarchyAndRemoveTodos`

### 3.6 Service Business Logic & Privacy Invariants (`WhereHouse.Data/Services/LocationService.cs`)

1. **In-Memory Hierarchy Resolution & Privacy Filtering:**
   - Household location trees typically contain $10\text{–}2,000$ nodes. Fetching all `LocationNodes.AsNoTracking()` into a dictionary (`Dictionary<Guid, LocationNode>`) allows $O(1)$ ancestor traversal, breadcrumb building, child count calculation, and recursive privacy filtering in a single SQL query.
   - **Accessibility Rule (`IsAccessible(LocationNode node, Guid userId, IReadOnlyDictionary<Guid, LocationNode> allNodes)`):**
     - A node is accessible to `userId` if and only if:
       - `(!node.IsPrivate || node.OwnerId == userId)` **AND**
       - Every ancestor along `node.ParentId` up to the root (`ParentId == null`) exists and also satisfies `(!ancestor.IsPrivate || ancestor.OwnerId == userId)`.
     - Any node that fails `IsAccessible` is completely omitted from `GetLocationTreeAsync`, `GetLocationNodesAsync`, and `ChildCount` calculations for other users.
2. **Breadcrumb & `FullPath` Resolution:**
   - Walking from root down to the node produces `IReadOnlyList<LocationBreadcrumbDto>` (ordered from root to the node itself) and `FullPath = string.Join(" > ", breadcrumbs.Select(b => b.Name))` (e.g., `"Garage > West Wall Rack > Shelf 3 > Winter Camping Bin #4"`).
3. **`GetLocationTreeAsync(Guid userId)`:**
   - Loads all `LocationNodes.AsNoTracking()`, filters to accessible nodes, and recursively builds `LocationTreeNodeDto` starting from roots (`ParentId == null`), ordering siblings by `NodeType` (`FixedLocation` first, then `MovableContainer`), then alphabetically by `Name`.
4. **`GetLocationNodesAsync(Guid userId, Guid? parentId, bool includeAllDepths, string? search)`:**
   - If `parentId.HasValue`:
     - Verify the parent node exists in the DB; if not, throw `NotFoundException("Parent location not found.")`.
     - Verify the parent node is accessible to `userId`; if not, throw `ForbiddenException()`.
   - Filters accessible nodes:
     - If `!string.IsNullOrWhiteSpace(search)`: matches accessible nodes (across all depths, or under `parentId` subtree if `parentId` is specified) where `Name`, `ShortCode`, `Description`, `ContainerStyle`, `ColorLabel`, or `FullPath` contains `search.Trim()` (case-insensitive).
     - Else if `includeAllDepths`: returns all accessible nodes (ordered by `FullPath`).
     - Else: returns direct children where `n.ParentId == parentId` (if `parentId == null`, returns top-level root nodes).
   - Orders results by `NodeType` (`FixedLocation` first, then `MovableContainer`), then `Name`.
5. **`GetLocationNodeByIdAsync(Guid userId, Guid id)`:**
   - Loads all `LocationNodes.AsNoTracking()`.
   - If `id` does not exist in the DB, return `null` (maps to `404 NotFound`).
   - If `id` exists but `!IsAccessible(node, userId, allNodes)`, throw `ForbiddenException()` (maps to `403 Forbid`).
   - Returns mapped `LocationNodeDto`.
6. **`CreateLocationNodeAsync(Guid userId, CreateLocationNodeRequest request)`:**
   - Validate `Name` is not whitespace (`request.Name.Trim()`).
   - If `request.ParentId.HasValue`:
     - Verify parent exists; if not, throw `NotFoundException("Parent location not found.")`.
     - Verify parent is accessible to `userId`; if not, throw `ForbiddenException()`.
   - Resolve `ShortCode`:
     - If `!string.IsNullOrWhiteSpace(request.ShortCode)`: normalize via `LocationShortCodeGenerator.NormalizeShortCode(request.ShortCode)`. Check if any node in `dbContext.LocationNodes` already has that `ShortCode` (case-insensitive); if so, throw `ConflictException($"Short code '{normalizedCode}' is already in use.", "Duplicate short code")`.
     - Else: load existing `ShortCode` strings from `dbContext.LocationNodes` and generate via `LocationShortCodeGenerator.GenerateNextShortCode(request.NodeType, existingCodes)`.
   - Default `Icon`: if `string.IsNullOrWhiteSpace(request.Icon)`, default to `"inventory_2"` for `MovableContainer` or `"folder"` / `"place"` (`"inventory_2"` vs `"place"` — use `"inventory_2"` for `MovableContainer` and `"place"` for `FixedLocation`).
   - Create `LocationNode` with `OwnerId = userId`, save via `SaveChangesAsync`, and return `LocationNodeDto`.
7. **`UpdateLocationNodeAsync(Guid userId, Guid id, UpdateLocationNodeRequest request)`:**
   - Load all nodes to verify accessibility. If target `id` does not exist, return `null`. If `!IsAccessible`, throw `ForbiddenException()`.
   - If `node.OwnerId != userId` and `request.IsPrivate`: set `node.OwnerId = userId` so the user marking it private owns it.
   - Update `Name`, `NodeType`, `Description`, `Icon`, `ContainerStyle`, `PrimaryColor`, `AccentColor`, `ColorLabel`, and `IsPrivate`.
   - Save changes and return updated `LocationNodeDto`.
8. **`MoveLocationNodeAsync(Guid userId, Guid id, MoveLocationNodeRequest request)`:**
   - Load all nodes. If target `id` does not exist, return `null`. If `!IsAccessible(node, userId, allNodes)`, throw `ForbiddenException()`.
   - If `request.NewParentId.HasValue`:
     - If `request.NewParentId.Value == id`, throw `ConflictException("A location or container cannot be moved into itself.", "Invalid move operation")`.
     - Verify `NewParentId.Value` exists in `allNodes`; if not, throw `NotFoundException("Target parent location not found.")`.
     - Verify `IsAccessible(targetParent, userId, allNodes)`; if not, throw `ForbiddenException()`.
     - Walk up the ancestors of `targetParent`: if any ancestor has `Id == id`, throw `ConflictException("A location or container cannot be moved into one of its own descendants.", "Circular hierarchy detected")`.
   - Update tracked entity's `ParentId = request.NewParentId`, call `SaveChangesAsync`, and return the updated `LocationNodeDto` (with newly resolved `FullPath` and `Breadcrumbs`).
9. **`DeleteLocationNodeAsync(Guid userId, Guid id)`:**
   - Load all nodes. If target `id` does not exist, return `false`. If `!IsAccessible(node, userId, allNodes)`, throw `ForbiddenException()`.
   - Check if any node in `allNodes.Values` has `ParentId == id`. If so, throw `ConflictException("Cannot delete a location or container that still contains nested locations or containers. Move or delete its contents first.", "Location not empty")`.
   - Remove the node, call `SaveChangesAsync`, and return `true`.

---

## 4. API Endpoints (`WhereHouse.API/Controllers/LocationsController.cs`)

Controller attributes: `[ApiController]`, `[Route("locations")]`, `[Authorize]`.

| Verb | Route (`/api/locations...`) | Request Body / Query | Success Response | Error Cases |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/locations/tree` | — | `200 OK` (`IReadOnlyList<LocationTreeNodeDto>`) | `401 Unauthorized` |
| `GET` | `/locations` | `[FromQuery] Guid? parentId`, `[FromQuery] bool includeAllDepths = false`, `[FromQuery] string? search = null` | `200 OK` (`IReadOnlyList<LocationNodeDto>`) | `403 Forbidden`, `404 NotFound` (if `parentId` invalid/private) |
| `GET` | `/locations/{id:guid}` | — | `200 OK` (`LocationNodeDto`) | `403 Forbidden`, `404 NotFound` |
| `POST` | `/locations` | `[FromBody] CreateLocationNodeRequest` | `201 Created` (`LocationNodeDto`) | `400 BadRequest`, `403 Forbidden`, `404 NotFound`, `409 Conflict` |
| `PUT` | `/locations/{id:guid}` | `[FromBody] UpdateLocationNodeRequest` | `200 OK` (`LocationNodeDto`) | `400 BadRequest`, `403 Forbidden`, `404 NotFound` |
| `PATCH` | `/locations/{id:guid}/move` | `[FromBody] MoveLocationNodeRequest` | `200 OK` (`LocationNodeDto`) | `400 BadRequest`, `403 Forbidden`, `404 NotFound`, `409 Conflict` |
| `DELETE` | `/locations/{id:guid}` | — | `204 NoContent` | `403 Forbidden`, `404 NotFound`, `409 Conflict` |

**Controller Exception Mapping Pattern:**
- Catch `ForbiddenException` $\rightarrow$ `return Forbid();`
- Catch `NotFoundException ex` $\rightarrow$ `return NotFound(new ProblemDetails { Status = StatusCodes.Status404NotFound, Title = "Not Found", Detail = ex.Message });`
- Catch `ConflictException ex` $\rightarrow$ `return Conflict(new ProblemDetails { Status = StatusCodes.Status409Conflict, Title = ex.Title, Detail = ex.Message });`

---

## 5. Angular Frontend Design (`WhereHouse.Client`)

### 5.1 TypeScript Models (`src/app/core/models/location.models.ts`)

```typescript
export type LocationNodeType = 0 | 1;

export const LocationNodeTypes = {
  FixedLocation: 0 as LocationNodeType,
  MovableContainer: 1 as LocationNodeType,
} as const;

export interface LocationBreadcrumbDto {
  id: string;
  name: string;
  shortCode: string;
  nodeType: LocationNodeType;
}

export interface LocationNodeDto {
  id: string;
  parentId: string | null;
  name: string;
  description: string | null;
  nodeType: LocationNodeType;
  shortCode: string;
  icon: string | null;
  containerStyle: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  colorLabel: string | null;
  isPrivate: boolean;
  ownerId: string;
  fullPath: string;
  breadcrumbs: LocationBreadcrumbDto[];
  childCount: number;
  createdAt: string;
  modifiedAt: string;
}

export interface LocationTreeNodeDto {
  id: string;
  parentId: string | null;
  name: string;
  nodeType: LocationNodeType;
  shortCode: string;
  icon: string | null;
  containerStyle: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  colorLabel: string | null;
  isPrivate: boolean;
  ownerId: string;
  fullPath: string;
  children: LocationTreeNodeDto[];
}

export interface CreateLocationNodeRequest {
  name: string;
  nodeType: LocationNodeType;
  parentId?: string | null;
  description?: string | null;
  shortCode?: string | null;
  icon?: string | null;
  containerStyle?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  colorLabel?: string | null;
  isPrivate?: boolean;
}

export interface UpdateLocationNodeRequest {
  name: string;
  nodeType: LocationNodeType;
  description?: string | null;
  icon?: string | null;
  containerStyle?: string | null;
  primaryColor?: string | null;
  accentColor?: string | null;
  colorLabel?: string | null;
  isPrivate?: boolean;
}

export interface MoveLocationNodeRequest {
  newParentId: string | null;
}
```

### 5.2 Location HTTP Service (`src/app/core/services/location/location.service.ts`)
- Decorated with `@Service()` from `@angular/core`.
- Uses `inject(HttpClient)` and `apiUrl('/locations')`.
- Methods:
  - `getTree(): Observable<LocationTreeNodeDto[]>` (`GET /api/locations/tree`)
  - `getLocations(params?: { parentId?: string | null; includeAllDepths?: boolean; search?: string }): Observable<LocationNodeDto[]>` (`GET /api/locations`)
  - `getLocationById(id: string): Observable<LocationNodeDto>` (`GET /api/locations/${id}`)
  - `createLocation(request: CreateLocationNodeRequest): Observable<LocationNodeDto>` (`POST /api/locations`)
  - `updateLocation(id: string, request: UpdateLocationNodeRequest): Observable<LocationNodeDto>` (`PUT /api/locations/${id}`)
  - `moveLocation(id: string, request: MoveLocationNodeRequest): Observable<LocationNodeDto>` (`PATCH /api/locations/${id}/move`)
  - `deleteLocation(id: string): Observable<void>` (`DELETE /api/locations/${id}`)

### 5.3 Dialog Components (`src/app/features/dashboard/`)

1. **`LocationDialogComponent` (`src/app/features/dashboard/location-dialog/location-dialog.component.ts`):**
   - Supports creating or editing a `FixedLocation` or `MovableContainer`.
   - Fields:
     - **Node Type Toggle/Selector:** Fixed Location (`place`) vs. Movable Container (`inventory_2`).
     - **Name** (`required`, max 150 chars, e.g., `"Garage"`, `"West Wall Rack"`, `"Winter Camping Bin #4"`).
     - **Short Code** (optional on create with placeholder `"Auto-generated (e.g. LOC-001 or BIN-001)"`; displayed as read-only badge on edit).
     - **Icon Selector:** Quick presets (`home`, `garage`, `shelves`, `door_sliding`, `inventory_2`, `handyman`, `kitchen`, `weekend`).
     - **Description** (optional textarea, max 1000 chars).
     - **Movable Container Visual Appearance Section** (shown when `nodeType === LocationNodeTypes.MovableContainer`):
       - `containerStyle`: input with quick preset chips (`27-Gal Heavy Duty Tote`, `Clear Shoebox`, `Cardboard Box`, `Pelican Case`, `Fabric Cube`, `Tool Chest Drawer`).
       - `colorLabel`: e.g., `"Black Base / Yellow Lid"`, `"Translucent / Blue Latches"`.
       - `primaryColor` & `accentColor`: color swatches/hex inputs (e.g., `#1f2937`, `#eab308`, `#2563eb`, `#dc2626`, `#16a34a`, `#9ca3af`).
     - **Secret / Gift Mode (`isPrivate` checkbox):** *"Private / Secret Mode (hide this location and its contents from other household members)"*.

2. **`MoveLocationDialogComponent` (`src/app/features/dashboard/move-location-dialog/move-location-dialog.component.ts`):**
   - Accepts `{ node: LocationNodeDto; availableTargets: LocationNodeDto[] }` via `MAT_DIALOG_DATA` (where `availableTargets` already excludes `node.id` and any node whose `fullPath` starts with `node.fullPath + ' > '` or has `node.id` in its breadcrumbs).
   - Allows selecting `"Top-Level (Root Location)"` (`null`) or any valid target location/container (displaying its `[shortCode] fullPath`), returning `{ newParentId: string | null }` on confirm.

### 5.4 Spatial Explorer Dashboard (`src/app/features/dashboard/dashboard.component.*`)
- Transforms `DashboardComponent` into the **WhereHouse Spatial Inventory Explorer**:
  - **Signals:**
    - `treeNodes = signal<LocationTreeNodeDto[]>([])`
    - `allNodes = signal<LocationNodeDto[]>([])`
    - `selectedNodeId = signal<string | null>(null)` (`null` means viewing Top-Level / Root locations)
    - `expandedIds = signal<Set<string>>(new Set())`
    - `searchQuery = signal<string>('')`
    - `filterNodeType = signal<'all' | 'fixed' | 'container'>('all')`
    - `sidebarOpen = signal<boolean>(true)` (collapsible on mobile/desktop)
    - `isLoading = signal<boolean>(false)`
    - `errorMessage = signal<string | null>(null)`
  - **Computed Signals:**
    - `selectedNode`: finds `selectedNodeId()` in `allNodes()`.
    - `currentBreadcrumbs`: returns `selectedNode()?.breadcrumbs ?? []`.
    - `displayedNodes`:
      - When `searchQuery()` is non-empty, filters `allNodes()` across all depths by `name`, `shortCode`, `description`, `containerStyle`, `colorLabel`, or `fullPath` (plus `filterNodeType()`).
      - When `searchQuery()` is empty, returns direct children of `selectedNodeId()` from `allNodes()` (plus `filterNodeType()`).
    - `stats`: total Fixed Locations count, total Movable Containers count, and Private/Secret nodes count.
  - **Layout & UX (Desktop + `360px` Mobile):**
    - **Left Tree Sidebar:** Shows hierarchical tree starting at `"All Locations (Root)"` with expand/collapse chevrons, node type icons, short code pills (`LOC-001`, `BIN-001`), and `lock` icon for private nodes.
    - **Main Content Area:**
      - Interactive **Breadcrumb Bar** (`All Locations > Garage > West Wall Rack > Shelf 3`) for 1-click upward navigation.
      - **Selected Location/Container Header Card** (when a node is selected): displays full details, short code badge, visual container appearance badge (color swatch + style + color label), Secret/Gift mode badge, and action buttons (`Add Sub-Location`, `Add Container Here`, `Move`, `Edit`, `Delete`).
      - **Child Nodes & Containers Grid:** Cards showing each location/container inside the current level, with visual color indicator badges for Movable Containers, child count pill, full path hint when searching, and quick actions (`Open`, `Edit`, `Move`, `Delete`).

---

## 6. Step-by-Step Execution Checklist (For Implementation Agent)

- [x] **Task 1: Backend Core & Data Layer (Remove `Todo`, Add `LocationNode`)**
  - Delete the sample `Todo` files in `WhereHouse.Core/Todos/`, `WhereHouse.Data/Entities/TodoItem.cs`, `WhereHouse.Data/Configurations/TodoItemConfiguration.cs`, and `WhereHouse.Data/Services/TodoService.cs`.
  - Create `WhereHouse.Core/Locations/LocationModels.cs` and `WhereHouse.Core/Locations/ILocationService.cs`.
  - Create `WhereHouse.Data/Entities/LocationNode.cs` and `WhereHouse.Data/Configurations/LocationNodeConfiguration.cs` (using `DeleteBehavior.Restrict` on both `Parent` and `Owner`).
  - Update `WhereHouse.Data/Entities/User.cs`, `WhereHouse.Data/WhereHouseDbContext.cs`, and `WhereHouse.Data/DataServiceCollectionExtensions.cs`.
  - Implement `WhereHouse.Data/Services/LocationService.cs`.
  - Ensure local SQL Server is running, then generate, apply, and format the EF Core migration:
    ```powershell
    .\scripts\ensure-local-infra.ps1
    dotnet ef migrations add AddLocationHierarchyAndRemoveTodos --project WhereHouse.Data
    dotnet ef database update --project WhereHouse.Data
    dotnet csharpier format WhereHouse.Data/Migrations
    ```
  - Create `Tests/WhereHouse.Core.UnitTests/LocationShortCodeTests.cs` testing `LocationShortCodeGenerator` (`LOC-001`, `BIN-001`, sequential numbering, custom code normalization) and run unit tests:
    ```powershell
    dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj
    ```

- [x] **Task 2: API Controllers & Integration Tests**
  - Delete `WhereHouse.API/Controllers/TodosController.cs` and `Tests/WhereHouse.API.IntegrationTests/TodoIntegrationTests.cs`.
  - Create `WhereHouse.API/Controllers/LocationsController.cs`.
  - Update `Tests/WhereHouse.API.IntegrationTests/OpenApiIntegrationTests.cs` to assert `"/locations"` instead of `"/todos"`.
  - Create `Tests/WhereHouse.API.IntegrationTests/LocationIntegrationTests.cs` covering:
    1. Creating nested hierarchy (`House -> Garage -> Shelf 1 -> BIN-001`) and verifying auto-generated short codes (`LOC-001`, `BIN-001`), `FullPath`, `Breadcrumbs`, and `GET /api/locations/tree`.
    2. Moving a Movable Container (`PATCH /api/locations/{id}/move`) to a new parent and verifying that both the container and its nested child container automatically inherit the new `FullPath`.
    3. Preventing circular moves (moving a node into itself or its descendant returns `409 Conflict`).
    4. Preventing deletion of non-empty locations (`409 Conflict`), and allowing deletion once empty (`204 NoContent`).
    5. Enforcing "Secret / Gift Mode" (`IsPrivate = true`): verifying a private container and its nested children are hidden from another household user's tree/list queries and return `403 Forbidden` when accessed, updated, moved, or deleted by another user.
  - Run integration tests until 100% green:
    ```powershell
    dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj
    ```

- [x] **Task 3: Angular Client & Unit Tests**
  - Delete `src/app/core/models/todo.models.ts`, `src/app/core/services/todo/`, and `src/app/features/dashboard/todo-dialog/`.
  - Create `src/app/core/models/location.models.ts`.
  - Create `src/app/core/services/location/location.service.ts` and `src/app/core/services/location/location.service.spec.ts`.
  - Create `LocationDialogComponent` (`.ts` and `.spec.ts`) and `MoveLocationDialogComponent` (`.ts` and `.spec.ts`).
  - Update `DashboardComponent` (`.ts`, `.html`, `.scss`, `.spec.ts`) to implement the Spatial Inventory Explorer.
  - Run frontend lint, build, and unit tests in `WhereHouse.Client` until 100% green:
    ```powershell
    npm run lint
    npm run build
    npm test -- --watch=false
    ```

- [x] **Task 4: E2E Verification & Final Formatting**
  - Run E2E and full test suite to verify zero regressions:
    ```powershell
    dotnet test --project Tests/WhereHouse.Client.E2ETests/WhereHouse.Client.E2ETests.csproj
    ```
  - Format all backend and frontend files:
    ```powershell
    dotnet csharpier format .
    # In WhereHouse.Client:
    npm run format
    npm run lint:fix
    ```
  - Update `docs/plans/phase-01-location-hierarchy.md` status to `[x] Completed`.

