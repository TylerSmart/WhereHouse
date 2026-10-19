# Phase 11: Container Cover Photos, Shared "Secret / Gift Mode" Access, Household Directory & Vault UX Presets

> **Branch:** `feature/phase-11-cover-photos-household-sharing-and-ux-polish`
> **Status:** [ ] Not Started
> **PRD Reference:** `docs/prd.md` — Sections 2 (`Household Admin / Managing Household Users`), 4.1.3 (`Container Visual Appearance Tags — Cover Photo`), 4.2.1 (`Kits & Nested Items Component Visibility`), 4.6.2 (`Return Window & Warranty Quick Presets`), 4.8.1 (`Smart Search — Owner Filter`), and 4.8.2 (`"Secret / Gift Mode" Shared with Explicitly Selected Users`)
> **Target Execution:** Run `/execute-phase` with your implementation model to execute this plan step-by-step.

---

## 1. Scope & Objectives

This phase closes out the remaining fine-grained functional and UX specifications across **PRD Sections 2, 4.1.3, 4.2.1, 4.6.2, 4.8.1, and 4.8.2**:

1. **Container & Location Cover Photos (`PRD 4.1.3`):**
   - Extends `LocationNode` with optional cover photo storage (`CoverPhotoFileName`, `CoverPhotoContentType`, `CoverPhotoData`) and exposes `HasCoverPhoto`, `CoverPhotoFileName`, and `CoverPhotoContentType` on `LocationNodeDto` and `LocationTreeNodeDto`.
   - Adds endpoints on `LocationsController`:
     - `PUT /api/locations/{id}/cover-photo` (`multipart/form-data`, up to 10 MB image upload)
     - `GET /api/locations/{id}/cover-photo` (returns raw image bytes with content type)
     - `DELETE /api/locations/{id}/cover-photo` (removes cover photo)
   - Updates `LocationDialogComponent`, `DashboardComponent`, and `ScannerDialogComponent` so users can upload, preview, and remove a photo of a physical container or shelf position and view it on bin cards and the selected location banner.

2. **Household User Directory & Shared "Secret / Gift Mode" Access (`PRD Section 2 & 4.8.2`):**
   - Adds `GET /api/auth/users` (`IAuthService.GetHouseholdUsersAsync`) returning `IReadOnlyList<HouseholdUserDto>` (`Id`, `Username`, `Email`, `CreatedAt`, `OwnedItemsCount`, `ActiveCheckoutsCount`) so authenticated household members can view household members, filter by owner, and share private bins/items.
   - Extends `LocationNode` and `InventoryItem` with `SharedWithUserIdsJson` (`string?`, serialized JSON array of `Guid`s) and exposes `IReadOnlyList<Guid>? SharedWithUserIds` on DTOs and Create/Update requests.
   - Updates privacy enforcement (`PrivacyAccessHelper.CanAccess`) across `LocationService`, `ItemService`, `SearchService`, and `ScanService`: when `IsPrivate == true`, a location or item is accessible if `OwnerId == userId` **OR** `SharedWithUserIds` contains `userId` (e.g., sharing a "Holiday Gifts Bin" with a spouse while keeping it hidden from kids' accounts). Only the `OwnerId` can modify privacy settings or delete the private entity.

3. **Smart Search Owner Faceted Filter (`PRD 4.8.1`):**
   - Adds `Guid? OwnerId = null` to `SmartSearchQuery` (`WhereHouse.Core/Search/SearchModels.cs`), `SearchService.SearchAsync`, `SearchController.Search`, and the `SmartSearchDialogComponent` filter bar.

4. **Return Window & Warranty Quick Presets + Kit/Nested Component Visibility (`PRD 4.2.1 & 4.6.2`):**
   - Updates `ItemDialogComponent` to include the `returnWindowEndDate` date input, **1-tap Return Window preset buttons** (`14d`, `30d`, `60d`, `90d` from Purchase Date or today), **1-tap Warranty preset buttons** (`1 Yr`, `2 Yr`, `3 Yr`, `5 Yr`, `Lifetime`), and a **"Share Private Access With..."** multi-select when `isPrivate` is toggled on.
   - Updates `DashboardComponent` item cards to display `parentItemName` (*"Linked to: ..."*) and `childItems` summary chips on Kit and Nested parent items.

---

## 2. Domain & Database Design (`WhereHouse.Core` & `WhereHouse.Data`)

### 2.1 Privacy Access Helper (`WhereHouse.Core/Privacy/PrivacyAccessHelper.cs` — New File)

Create a zero-dependency helper in `WhereHouse.Core/Privacy/PrivacyAccessHelper.cs` for parsing `SharedWithUserIdsJson` and evaluating "Secret / Gift Mode" visibility:

```csharp
using System.Text.Json;

namespace WhereHouse.Core.Privacy;

public static class PrivacyAccessHelper
{
    public static IReadOnlyList<Guid> ParseSharedUserIds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            var list = JsonSerializer.Deserialize<List<Guid>>(json);
            return list?.Distinct().ToList() ?? [];
        }
        catch
        {
            return [];
        }
    }

    public static string? SerializeSharedUserIds(IEnumerable<Guid>? userIds, Guid ownerId)
    {
        if (userIds is null)
        {
            return null;
        }

        var cleaned = userIds.Where(id => id != Guid.Empty && id != ownerId).Distinct().ToList();
        return cleaned.Count == 0 ? null : JsonSerializer.Serialize(cleaned);
    }

    public static bool CanView(bool isPrivate, Guid ownerId, string? sharedWithUserIdsJson, Guid currentUserId)
    {
        if (!isPrivate || ownerId == currentUserId)
        {
            return true;
        }

        if (string.IsNullOrWhiteSpace(sharedWithUserIdsJson))
        {
            return false;
        }

        var sharedIds = ParseSharedUserIds(sharedWithUserIdsJson);
        return sharedIds.Contains(currentUserId);
    }
}
```

---

### 2.2 Entities & EF Configurations (`WhereHouse.Data/`)

1. **Update `WhereHouse.Data/Entities/LocationNode.cs`:**
   - Add properties:
     ```csharp
     public string? CoverPhotoFileName { get; set; }

     public string? CoverPhotoContentType { get; set; }

     public byte[]? CoverPhotoData { get; set; }

     public string? SharedWithUserIdsJson { get; set; }
     ```

2. **Update `WhereHouse.Data/Configurations/LocationNodeConfiguration.cs`:**
   - Add column length configurations:
     ```csharp
     builder.Property(x => x.CoverPhotoFileName).HasMaxLength(255);
     builder.Property(x => x.CoverPhotoContentType).HasMaxLength(128);
     builder.Property(x => x.SharedWithUserIdsJson).HasMaxLength(2000);
     ```

3. **Update `WhereHouse.Data/Entities/InventoryItem.cs`:**
   - Add property:
     ```csharp
     public string? SharedWithUserIdsJson { get; set; }
     ```

4. **Update `WhereHouse.Data/Configurations/InventoryItemConfiguration.cs`:**
   - Add column length configuration:
     ```csharp
     builder.Property(x => x.SharedWithUserIdsJson).HasMaxLength(2000);
     ```

5. **EF Core Migration:**
   - Run:
     ```powershell
     dotnet ef migrations add AddCoverPhotosAndSharedPrivacy --project WhereHouse.Data --startup-project WhereHouse.API
     ```

---

### 2.3 DTOs, Requests & Service Contracts (`WhereHouse.Core/`)

1. **Update `WhereHouse.Core/Authentication/AuthModels.cs` & `IAuthService.cs`:**
   - Add `HouseholdUserDto` to `AuthModels.cs`:
     ```csharp
     public sealed record HouseholdUserDto(
         Guid Id,
         string Username,
         string Email,
         DateTimeOffset CreatedAt,
         int OwnedItemsCount,
         int ActiveCheckoutsCount
     );
     ```
   - Add to `IAuthService`:
     ```csharp
     Task<IReadOnlyList<HouseholdUserDto>> GetHouseholdUsersAsync(
         CancellationToken cancellationToken = default
     );
     ```

2. **Update `WhereHouse.Core/Locations/LocationModels.cs` & `ILocationService.cs`:**
   - Append optional default parameters to `LocationNodeDto`, `LocationTreeNodeDto`, `CreateLocationNodeRequest`, and `UpdateLocationNodeRequest`:
     ```csharp
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
         int ItemCount,
         DateTimeOffset CreatedAt,
         DateTimeOffset ModifiedAt,
         bool HasCoverPhoto = false,
         string? CoverPhotoFileName = null,
         string? CoverPhotoContentType = null,
         IReadOnlyList<Guid>? SharedWithUserIds = null
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
         IReadOnlyList<LocationTreeNodeDto> Children,
         bool HasCoverPhoto = false,
         IReadOnlyList<Guid>? SharedWithUserIds = null
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
         bool IsPrivate = false,
         IReadOnlyList<Guid>? SharedWithUserIds = null
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
         bool IsPrivate = false,
         IReadOnlyList<Guid>? SharedWithUserIds = null
     );

     public sealed record UploadLocationCoverPhotoRequest(
         [Required, MaxLength(255)] string FileName,
         [Required, MaxLength(128)] string ContentType,
         [Required] byte[] Data
     );

     public sealed record LocationCoverPhotoDownloadDto(
         string FileName,
         string ContentType,
         byte[] Data
     );
     ```
   - Add cover photo methods to `ILocationService`:
     ```csharp
     Task<LocationNodeDto?> SetCoverPhotoAsync(
         Guid userId,
         Guid id,
         UploadLocationCoverPhotoRequest request,
         CancellationToken cancellationToken = default
     );

     Task<LocationCoverPhotoDownloadDto?> GetCoverPhotoAsync(
         Guid userId,
         Guid id,
         CancellationToken cancellationToken = default
     );

     Task<LocationNodeDto?> DeleteCoverPhotoAsync(
         Guid userId,
         Guid id,
         CancellationToken cancellationToken = default
     );
     ```

3. **Update `WhereHouse.Core/Items/ItemModels.cs`:**
   - Append `IReadOnlyList<Guid>? SharedWithUserIds = null` as the final optional parameter on `ItemDto`, `CreateItemRequest`, and `UpdateItemRequest`.

4. **Update `WhereHouse.Core/Search/SearchModels.cs`:**
   - Append `Guid? OwnerId = null` as the final optional parameter on `SmartSearchQuery`, and `bool HasCoverPhoto = false` on `LocationSearchHitDto`.

---

### 2.4 Service Implementations (`WhereHouse.Data/Services/`)

1. **`AuthService.GetHouseholdUsersAsync` (`WhereHouse.Data/Services/AuthService.cs`):**
   - Queries `dbContext.Users.AsNoTracking()` ordered by `Username`:
   - Computes `OwnedItemsCount` (non-archived, non-private items owned by that user) and `ActiveCheckoutsCount` (items currently `InUse` where `CheckedOutByUserId == u.Id`).
   - Returns `IReadOnlyList<HouseholdUserDto>`.

2. **`LocationService` (`WhereHouse.Data/Services/LocationService.cs`):**
   - Update `IsAccessible` to call `PrivacyAccessHelper.CanView(current.IsPrivate, current.OwnerId, current.SharedWithUserIdsJson, userId)`.
   - In `GetLocationNodesAsync`, update item count filtering to also check `PrivacyAccessHelper.CanView(i.IsPrivate, i.OwnerId, i.SharedWithUserIdsJson, userId)`.
   - In `CreateLocationNodeAsync` and `UpdateLocationNodeAsync`, persist `SharedWithUserIdsJson = request.IsPrivate ? PrivacyAccessHelper.SerializeSharedUserIds(request.SharedWithUserIds, node.OwnerId) : null`. Note: if `node.IsPrivate` is being changed or `SharedWithUserIds` is being modified on an existing private node, only `node.OwnerId == userId` is allowed to change privacy settings (`ForbiddenException` if a shared non-owner tries to alter `IsPrivate` or `SharedWithUserIds` or delete the node).
   - Implement `SetCoverPhotoAsync`, `GetCoverPhotoAsync`, and `DeleteCoverPhotoAsync`:
     - Validate file size (`> 0` and `<= 10 * 1024 * 1024` bytes, otherwise `DomainValidationException`) and image content type (`image/jpeg`, `image/png`, `image/webp`, `image/gif`).
     - Enforce `IsAccessible(node, userId, allNodes)` (throw `ForbiddenException` if inaccessible).
     - Populate `HasCoverPhoto = node.CoverPhotoData is { Length: > 0 }`, `CoverPhotoFileName`, `CoverPhotoContentType`, and `SharedWithUserIds = PrivacyAccessHelper.ParseSharedUserIds(node.SharedWithUserIdsJson)` in `MapToDto` and `BuildTree`.

3. **`ItemService` (`WhereHouse.Data/Services/ItemService.cs`):**
   - Update `IsItemAccessible` and `IsLocationAccessible` to use `PrivacyAccessHelper.CanView(...)`.
   - In `CreateItemAsync` and `UpdateItemAsync`, persist `SharedWithUserIdsJson = request.IsPrivate ? PrivacyAccessHelper.SerializeSharedUserIds(request.SharedWithUserIds, item.OwnerId) : null`.
   - Include `SharedWithUserIds: PrivacyAccessHelper.ParseSharedUserIds(item.SharedWithUserIdsJson)` in `MapToDto`.

4. **`SearchService` (`WhereHouse.Data/Services/SearchService.cs`) & `ScanService` (`WhereHouse.Data/Services/ScanService.cs`):**
   - Update location and item accessibility checks in `SearchService` and `ScanService` to use `PrivacyAccessHelper.CanView(...)`.
   - In `SearchService.SearchAsync`, if `query.OwnerId.HasValue`, filter items by `i.OwnerId == query.OwnerId.Value` and locations by `n.OwnerId == query.OwnerId.Value`.

---

## 3. API Endpoints (`WhereHouse.API/Controllers/`)

| Verb | Route (`/api/...`) | Request Body / Query | Response (`200`/`204`) | Error Cases (`400`/`403`/`404`) |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/auth/users` | — | `200 OK` (`IReadOnlyList<HouseholdUserDto>`) | `401 Unauthorized` |
| `PUT` | `/api/locations/{id:guid}/cover-photo` | `IFormFile file` (`multipart/form-data`) | `200 OK` (`LocationNodeDto`) | `400` invalid image/size, `403` private node, `404` not found |
| `GET` | `/api/locations/{id:guid}/cover-photo` | — | `200 OK` (`FileResult` binary stream) | `403` private node, `404` not found or no photo |
| `DELETE` | `/api/locations/{id:guid}/cover-photo` | — | `200 OK` (`LocationNodeDto`) | `403` private node, `404` not found |
| `GET` | `/api/search` | Existing params + `[FromQuery] Guid? ownerId = null` | `200 OK` (`SmartSearchResponseDto`) | `401 Unauthorized` |

---

## 4. Angular Frontend Design (`WhereHouse.Client`)

### 4.1 Models & Services (`src/app/core/`)

1. **Update `src/app/core/models/auth.models.ts` & `src/app/core/services/auth/auth.service.ts`:**
   - Add `HouseholdUserDto` interface (`id`, `username`, `email`, `createdAt`, `ownedItemsCount`, `activeCheckoutsCount`).
   - Add `getHouseholdUsers(): Observable<HouseholdUserDto[]>` to `AuthService` calling `GET /api/auth/users`.

2. **Update `src/app/core/models/location.models.ts` & `src/app/core/services/location/location.service.ts`:**
   - Add `hasCoverPhoto?: boolean`, `coverPhotoFileName?: string | null`, `coverPhotoContentType?: string | null`, and `sharedWithUserIds?: string[]` to `LocationNodeDto`, `LocationTreeNodeDto`, `CreateLocationNodeRequest`, and `UpdateLocationNodeRequest`.
   - Add `uploadCoverPhoto(id: string, file: File): Observable<LocationNodeDto>`, `deleteCoverPhoto(id: string): Observable<LocationNodeDto>`, and `getCoverPhotoDownload(id: string): Observable<Blob>` to `LocationService` (invalidating tree/list cache on upload/delete).

3. **Update `src/app/core/models/item.models.ts`:**
   - Add `sharedWithUserIds?: string[]` to `ItemDto`, `CreateItemRequest`, and `UpdateItemRequest`.

4. **Update `src/app/core/models/search.models.ts` & `src/app/core/services/search/search.service.ts`:**
   - Add `ownerId?: string | null` to `SmartSearchQuery` and pass `ownerId` in `SearchService.search(...)`.

---

### 4.2 Feature Components (`src/app/features/dashboard/`)

1. **`LocationDialogComponent` (`location-dialog.component.ts`):**
   - Pass `householdUsers?: HouseholdUserDto[]` in `LocationDialogData`.
   - When `isPrivate` is enabled, show a **"Share Secret Access With Household Members"** `mat-select [multiple]="true"` (`sharedWithUserIds` control) so the owner can grant specific family members access to the secret location/bin.
   - In Edit mode (or when editing a location/container), display a **Container / Shelf Cover Photo** section allowing the user to upload an image file (`uploadCoverPhoto`) or remove an existing cover photo (`deleteCoverPhoto`).

2. **`ItemDialogComponent` (`item-dialog.component.ts`):**
   - Pass `householdUsers?: HouseholdUserDto[]` in `ItemDialogData`.
   - In the **Purchase & Warranty Vault** section:
     - Add the **Return Window End Date** (`returnWindowEndDate`) date picker input alongside **1-tap Return Window preset buttons** (`+14d`, `+30d`, `+60d`, `+90d` calculated relative to `purchaseDate` if set, otherwise today).
     - Add **1-tap Warranty preset buttons** (`1 Yr`, `2 Yr`, `3 Yr`, `5 Yr`, `Lifetime` — where `Lifetime` sets `warrantyNotes` to `'Lifetime Warranty'` and clears expiration date, and `1–5 Yr` adds $N$ years to `purchaseDate` or today).
   - In the **Secret / Gift Mode** section:
     - When `isPrivate` is enabled, show a **"Share Secret Access With Household Members"** `mat-select [multiple]="true"` (`sharedWithUserIds` control).
   - When editing an item that has `childItems` (`data.item.childItems.length > 0`), render a read-only **Linked Kit / Nested Components** summary list showing each child item's short code, name, quantity, and status.

3. **`SmartSearchDialogComponent` (`smart-search-dialog.component.ts`):**
   - Pass `availableUsers?: HouseholdUserDto[]` in `SmartSearchDialogData` and add an **Owner** `mat-select` filter dropdown in the faceted filters panel (`ownerId` signal).

4. **`DashboardComponent` (`dashboard.component.ts`, `.html`, `.scss`):**
   - Load `householdUsers = signal<HouseholdUserDto[]>([])` via `authService.getHouseholdUsers()` in `refreshAll()` and pass to `LocationDialogComponent`, `ItemDialogComponent`, and `SmartSearchDialogComponent`.
   - On `DashboardComponent` item cards (`.item-card`), render:
     - If `item.parentItemName`, display a subtle linked parent badge (`account_tree` icon + `"Part of: {{ item.parentItemName }}"`).
     - If `item.childItems && item.childItems.length > 0`, display a compact **Components ({{ item.childItems.length }})** chip list showing the first 3 child items.
   - On `DashboardComponent` location cards and the selected node banner, show a `"Cover Photo"` indicator badge when `node.hasCoverPhoto` is true, with a button to preview/manage the photo in `LocationDialogComponent`.

---

## 5. Step-by-Step Execution Checklist (For Implementation Agent)

- [ ] **Task 1: Backend Core, Data Entities, Migration & Services (`WhereHouse.Core`, `WhereHouse.Data`)**
  - Create `WhereHouse.Core/Privacy/PrivacyAccessHelper.cs`.
  - Update `WhereHouse.Core/Authentication/AuthModels.cs` and `IAuthService.cs` with `HouseholdUserDto` and `GetHouseholdUsersAsync`.
  - Update `WhereHouse.Core/Locations/LocationModels.cs` and `ILocationService.cs` with cover photo DTOs/methods and `SharedWithUserIds`.
  - Update `WhereHouse.Core/Items/ItemModels.cs` with `SharedWithUserIds`.
  - Update `WhereHouse.Core/Search/SearchModels.cs` with `OwnerId` and `HasCoverPhoto`.
  - Update `WhereHouse.Data/Entities/LocationNode.cs`, `InventoryItem.cs`, `LocationNodeConfiguration.cs`, and `InventoryItemConfiguration.cs`.
  - Generate and apply EF Core migration:
    ```powershell
    dotnet ef migrations add AddCoverPhotosAndSharedPrivacy --project WhereHouse.Data --startup-project WhereHouse.API
    ```
  - Update `AuthService.cs`, `LocationService.cs`, `ItemService.cs`, `SearchService.cs`, and `ScanService.cs`.
  - Run unit tests:
    ```powershell
    dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj
    dotnet test --project Tests/WhereHouse.Infrastructure.UnitTests/WhereHouse.Infrastructure.UnitTests.csproj
    ```

- [ ] **Task 2: API Endpoints & Integration Tests (`WhereHouse.API` & `Tests/WhereHouse.API.IntegrationTests`)**
  - Add `GET /api/auth/users` to `WhereHouse.API/Controllers/AuthController.cs`.
  - Add `PUT /api/locations/{id:guid}/cover-photo`, `GET /api/locations/{id:guid}/cover-photo`, and `DELETE /api/locations/{id:guid}/cover-photo` to `WhereHouse.API/Controllers/LocationsController.cs`.
  - Add `[FromQuery] Guid? ownerId = null` to `WhereHouse.API/Controllers/SearchController.cs`.
  - Create `Tests/WhereHouse.API.IntegrationTests/Phase11CoverPhotosAndSharedPrivacyIntegrationTests.cs` covering:
    1. **Container Cover Photo Lifecycle (`PRD 4.1.3`):** Uploading a PNG cover photo to a movable container, verifying `HasCoverPhoto == true`, downloading the photo bytes, and deleting the cover photo.
    2. **Shared "Secret / Gift Mode" Access (`PRD 4.8.2`):** User A creates a private container and a private item shared explicitly with User B (`SharedWithUserIds = [userB.Id]`), while User C is excluded. Verify User B can view/scan/search the shared private container and item (`200 OK`), whereas User C receives `403 Forbidden` / omitted from search, and verify User B cannot delete User A's private container (`403 Forbidden`).
    3. **Household User Directory & Smart Search Owner Filter (`PRD Section 2 & 4.8.1`):** Calling `GET /api/auth/users` to list household members with item/checkout counts, and filtering `GET /api/search?ownerId=...` to return only items/locations owned by the specified user.
  - Run integration tests until 100% green:
    ```powershell
    dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj
    ```

- [ ] **Task 3: Angular Client & Unit Tests (`WhereHouse.Client`)**
  - Update `auth.models.ts`, `auth.service.ts`, `location.models.ts`, `location.service.ts`, `item.models.ts`, `search.models.ts`, and `search.service.ts` (& spec files).
  - Update `LocationDialogComponent` with cover photo upload/delete and `sharedWithUserIds` selector.
  - Update `ItemDialogComponent` with `returnWindowEndDate`, Return Window quick preset chips (`+14d`, `+30d`, `+60d`, `+90d`), Warranty quick preset chips (`1 Yr`, `2 Yr`, `3 Yr`, `5 Yr`, `Lifetime`), `sharedWithUserIds` selector, and `childItems` summary list.
  - Update `SmartSearchDialogComponent` with the `Owner` filter dropdown.
  - Update `DashboardComponent` to load household users, display Kit/Nested `childItems` & `parentItemName` badges, and show container cover photo indicators.
  - Run frontend lint, build, and unit tests in `WhereHouse.Client` until 100% green:
    ```powershell
    npm run lint
    npm run build
    npm test -- --watch=false
    ```

- [ ] **Task 4: E2E Verification & Final Formatting**
  - Run E2E test suite to verify zero regressions:
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
  - Update `docs/plans/phase-11-cover-photos-household-sharing-and-ux-polish.md` status to `[x] Completed`.
