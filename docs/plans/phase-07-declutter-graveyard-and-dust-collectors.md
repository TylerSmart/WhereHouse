# Phase 07: Declutter Staging, The "Graveyard" Archive & Dust Collector Insights

> **Branch:** `feature/phase-07-declutter-graveyard-and-dust-collectors`
> **Status:** Planned (`[ ]` Not Started | `[~]` In Progress | `[x]` Completed)
> **PRD Reference:** `docs/prd.md` — Sections 4.5 (`Lifecycle State Transitions`), 4.7.1 (`The "Graveyard / Archive" System`), 4.7.2 (`"Staging to Sell / Donate" Workflow`), 4.7.3 (`"Dust Collector" Insights`), 4.8.1 (`Smart Search Graveyard Section`), and 4.8.2 (`"Secret / Gift Mode" Privacy`)
> **Target Execution:** Run `/execute-phase` with your implementation model to execute this plan step-by-step.

---

## 1. Scope & Objectives

This phase completes **Milestone 3 (Movement & Projects)** by delivering the complete **Asset Disposition Lifecycle**—**Declutter Staging (`StagedToSell` / `StagedToDonate`)**, **The "Graveyard / Archive" System**, and **"Dust Collector" Insights**:

1. **The "Graveyard / Archive" System (`ILifecycleService`, `LifecycleController`, PRD 4.7.1):**
   - Prevents searching the house for an item that was sold, donated, or thrown away months or years ago.
   - Archiving an item transitions its `Status` to `ItemStatus.Archived` (`5`) with a required `DispositionReason`:
     - `Sold` (`0`) — with optional `SalePrice` (`decimal?`) and buyer/platform note (`DispositionNote`).
     - `Donated` (`1`) — with optional recipient note (`DispositionNote`, e.g., *"Goodwill on Main St"*).
     - `Recycled` (`2`) — *Recycled / Scrapped*, with optional note.
     - `BrokenTrashed` (`3`) — *Broken / Trashed*, with optional note.
     - `Consumed` (`4`) — *Consumed / Depleted*, with optional note.
   - Preserves the item's `HomeLocationId` as its *"Last Known / Previous Location"* while recording `ArchivedAt`, `ArchivedByUserId`, and `ArchivedByUsername`, and clearing any active checkout or staging metadata.
   - **Active Bin & Count Exclusion:** Archived items are automatically excluded from default active bin/dashboard queries (`GET /api/items` when `status` is omitted) and from `LocationNodeDto.ItemCount` calculations so active bin counts stay accurate.
   - **Smart Search Graveyard Integration (PRD 4.7.1 & 4.8.1):** Enhances the collapsible **"Found in Graveyard (Archived)"** section in `SmartSearchDialogComponent` to display the disposition reason, archive date, sale price / note, and previous home location (e.g., *"Linksys WRT Router — Donated on 2026-04-12 (Previously in Basement > Bin 03)"*), plus a 1-click **"Restore to Home Bin"** action.
   - **Restore from Graveyard:** Allows restoring any archived item back to `ItemStatus.InPlace`, clearing disposition metadata and updating `LastTouchedAt`.

2. **"Staging to Sell / Donate" Workflow (`DeclutterStagingSummaryDto`, PRD 4.7.2):**
   - Items can be staged as `ItemStatus.StagedToSell` (`3`) or `ItemStatus.StagedToDonate` (`4`) with an optional `StagingTargetPrice` (`decimal?`) and `StagingListingNotes` (`string?`), recording `StagedAt`.
   - **Dedicated Declutter Staging View:**
     - Lists all `StagedToSell` and `StagedToDonate` items across the household (or filtered by a specific container such as a physical *"Donate Box"*).
     - Calculates total potential resale value (`TotalTargetResaleValue`) and estimated donation value (`TotalEstimatedDonationValue`).
     - Supports **Single & Bulk Transitions**: Users can select multiple staged items and bulk-transition them to `Archived` (`POST /api/lifecycle/bulk-archive`, e.g., marking a batch of donated items as `Donated` after a Goodwill drop-off, or marking sold items as `Sold` with their target asking prices automatically applied as `SalePrice`), or bulk-unstage them back to `InPlace` (`POST /api/lifecycle/bulk-unstage`).

3. **"Dust Collector" Insights (`DustCollectorInsightsDto`, PRD 4.7.3):**
   - Analyzes active (`InPlace`) items across the household whose `LastTouchedAt` timestamp is older than a configurable threshold (`> 6 Months / 180 days`, `> 1 Year / 365 days`, `> 2 Years / 730 days`, or custom days).
   - Groups untouched items by **Location / Container (`HomeLocationFullPath`)** so users can declutter one closet or bin at a time, displaying `DaysUntouched` and estimated value per item and per container.
   - Provides 1-click actions on each Dust Collector to **Stage to Sell**, **Stage to Donate**, **Archive**, or **Mark Touched / Still Using** (`POST /api/lifecycle/items/{id}/touch`, which resets `LastTouchedAt` to `UtcNow`).

4. **Out of Scope for Phase 07 (Deferred to Milestone 4 / Phase 08):**
   - Full-text PDF manual indexing/search, Recurring Maintenance schedules, Action Center overview dashboard + 1-click Home Insurance Claim ZIP export, and outbound webhook/push notifications (PRD Sections 4.6 & 4.8.3).

---

## 2. Domain & Database Design (`WhereHouse.Core` & `WhereHouse.Data`)

### 2.1 Enums & Item Model Updates (`WhereHouse.Core/Items/ItemModels.cs`)

1. **Add `DispositionReason` enum and extend `ItemDto` in `WhereHouse.Core/Items/ItemModels.cs`:**
   ```csharp
   public enum DispositionReason
   {
       Sold = 0,
       Donated = 1,
       Recycled = 2,
       BrokenTrashed = 3,
       Consumed = 4,
   }
   ```
   Update `ItemDto` in `WhereHouse.Core/Items/ItemModels.cs` by appending optional staging and archive fields at the end of the positional record (preserving backward compatibility with all existing callers):
   ```csharp
   public sealed record ItemDto(
       Guid Id,
       string ShortCode,
       string Name,
       string? Description,
       IReadOnlyList<string> Aliases,
       IReadOnlyList<string> Tags,
       ItemType ItemType,
       ItemStatus Status,
       ItemCondition Condition,
       Guid? HomeLocationId,
       string? HomeLocationName,
       string? HomeLocationShortCode,
       string? HomeLocationFullPath,
       Guid? CategoryId,
       string? CategoryName,
       Guid? ParentItemId,
       string? ParentItemName,
       string? Brand,
       string? ModelNumber,
       string? SerialNumber,
       decimal CurrentQuantity,
       string? Unit,
       decimal? MinQuantity,
       bool IsLowStock,
       bool IsIncompleteKit,
       IReadOnlyList<string> IncompleteKitWarnings,
       DateTimeOffset? PurchaseDate,
       string? Retailer,
       decimal? PurchasePrice,
       decimal? EstimatedReplacementValue,
       DateTimeOffset? ReturnWindowEndDate,
       DateTimeOffset? WarrantyExpirationDate,
       string? WarrantyNotes,
       bool IsPrivate,
       Guid OwnerId,
       IReadOnlyList<ItemAttributeValueDto> AttributeValues,
       IReadOnlyList<ItemChildSummaryDto> ChildItems,
       DateTimeOffset LastTouchedAt,
       DateTimeOffset CreatedAt,
       DateTimeOffset ModifiedAt,
       int AttachmentCount = 0,
       Guid? PrimaryPhotoAttachmentId = null,
       string? BarcodeNumber = null,
       Guid? CheckedOutByUserId = null,
       string? CheckedOutByUsername = null,
       string? CheckedOutToBorrower = null,
       string? CheckedOutBorrowerContact = null,
       string? CheckoutNote = null,
       DateTimeOffset? CheckedOutAt = null,
       DateTimeOffset? CheckoutDueAt = null,
       bool IsOverdueLoan = false,
       Guid? ActiveLoadoutId = null,
       string? ActiveLoadoutName = null,
       decimal? StagingTargetPrice = null,
       string? StagingListingNotes = null,
       DateTimeOffset? StagedAt = null,
       DispositionReason? DispositionReason = null,
       string? DispositionNote = null,
       decimal? SalePrice = null,
       DateTimeOffset? ArchivedAt = null,
       Guid? ArchivedByUserId = null,
       string? ArchivedByUsername = null
   );
   ```

### 2.2 Lifecycle Models & Service Contract (`WhereHouse.Core/Lifecycle/`)

1. **Create `WhereHouse.Core/Lifecycle/LifecycleModels.cs`:**
   ```csharp
   using System.ComponentModel.DataAnnotations;
   using WhereHouse.Core.Items;

   namespace WhereHouse.Core.Lifecycle;

   public sealed record StageItemRequest(
       bool IsToSell = true,
       decimal? TargetPrice = null,
       [MaxLength(1000)] string? ListingNotes = null
   );

   public sealed record ArchiveItemRequest(
       [Required] DispositionReason DispositionReason,
       [MaxLength(1000)] string? DispositionNote = null,
       decimal? SalePrice = null
   );

   public sealed record BulkArchiveRequest(
       [Required, MinLength(1)] IReadOnlyList<Guid> ItemIds,
       [Required] DispositionReason DispositionReason,
       [MaxLength(1000)] string? DispositionNote = null,
       decimal? SalePrice = null
   );

   public sealed record BulkUnstageRequest(
       [Required, MinLength(1)] IReadOnlyList<Guid> ItemIds
   );

   public sealed record BulkLifecycleResultDto(
       int ProcessedCount,
       IReadOnlyList<ItemDto> Items
   );

   public sealed record DeclutterStagingSummaryDto(
       int TotalStagedCount,
       int StagedToSellCount,
       int StagedToDonateCount,
       decimal TotalTargetResaleValue,
       decimal TotalEstimatedDonationValue,
       IReadOnlyList<ItemDto> Items
   );

   public sealed record DustCollectorItemDto(
       ItemDto Item,
       int DaysUntouched,
       decimal EstimatedValue
   );

   public sealed record DustCollectorLocationGroupDto(
       Guid? LocationId,
       string LocationName,
       string? LocationShortCode,
       string LocationFullPath,
       int ItemCount,
       decimal GroupEstimatedValue,
       IReadOnlyList<DustCollectorItemDto> Items
   );

   public sealed record DustCollectorInsightsDto(
       int MinUntouchedDays,
       DateTimeOffset CutoffDate,
       int TotalItemsCount,
       decimal TotalEstimatedValue,
       IReadOnlyList<DustCollectorLocationGroupDto> LocationGroups
   );

   public sealed record GraveyardSummaryDto(
       int TotalArchivedCount,
       int SoldCount,
       int DonatedCount,
       int RecycledCount,
       int BrokenTrashedCount,
       int ConsumedCount,
       decimal TotalSaleProceeds,
       decimal TotalDonatedEstimatedValue,
       IReadOnlyList<ItemDto> Items
   );
   ```

2. **Create `WhereHouse.Core/Lifecycle/ILifecycleService.cs`:**
   ```csharp
   using WhereHouse.Core.Items;

   namespace WhereHouse.Core.Lifecycle;

   public interface ILifecycleService
   {
       Task<ItemDto?> StageItemAsync(
           Guid userId,
           Guid itemId,
           StageItemRequest request,
           CancellationToken cancellationToken = default
       );

       Task<ItemDto?> UnstageItemAsync(
           Guid userId,
           Guid itemId,
           CancellationToken cancellationToken = default
       );

       Task<ItemDto?> ArchiveItemAsync(
           Guid userId,
           Guid itemId,
           ArchiveItemRequest request,
           CancellationToken cancellationToken = default
       );

       Task<ItemDto?> RestoreArchivedItemAsync(
           Guid userId,
           Guid itemId,
           CancellationToken cancellationToken = default
       );

       Task<ItemDto?> TouchItemAsync(
           Guid userId,
           Guid itemId,
           CancellationToken cancellationToken = default
       );

       Task<BulkLifecycleResultDto> BulkArchiveItemsAsync(
           Guid userId,
           BulkArchiveRequest request,
           CancellationToken cancellationToken = default
       );

       Task<BulkLifecycleResultDto> BulkUnstageItemsAsync(
           Guid userId,
           BulkUnstageRequest request,
           CancellationToken cancellationToken = default
       );

       Task<DeclutterStagingSummaryDto> GetStagedItemsAsync(
           Guid userId,
           ItemStatus? statusFilter = null,
           Guid? locationId = null,
           bool includeSubtreeLocations = true,
           CancellationToken cancellationToken = default
       );

       Task<GraveyardSummaryDto> GetGraveyardItemsAsync(
           Guid userId,
           DispositionReason? dispositionReason = null,
           string? search = null,
           CancellationToken cancellationToken = default
       );

       Task<DustCollectorInsightsDto> GetDustCollectorsAsync(
           Guid userId,
           int minUntouchedDays = 365,
           Guid? locationId = null,
           bool includeSubtreeLocations = true,
           Guid? categoryId = null,
           CancellationToken cancellationToken = default
       );
   }
   ```

### 2.3 Entity & EF Core Configuration Updates (`WhereHouse.Data`)

1. **Update `WhereHouse.Data/Entities/InventoryItem.cs`:**
   - Add Declutter Staging & Graveyard Archive properties:
     ```csharp
     public decimal? StagingTargetPrice { get; set; }

     public string? StagingListingNotes { get; set; }

     public DateTimeOffset? StagedAt { get; set; }

     public DispositionReason? DispositionReason { get; set; }

     public string? DispositionNote { get; set; }

     public decimal? SalePrice { get; set; }

     public DateTimeOffset? ArchivedAt { get; set; }

     public Guid? ArchivedByUserId { get; set; }

     public string? ArchivedByUsername { get; set; }
     ```

2. **Update `WhereHouse.Data/Configurations/InventoryItemConfiguration.cs`:**
   - Add column rules and indexes:
     ```csharp
     builder.Property(i => i.StagingTargetPrice).HasPrecision(18, 2);
     builder.Property(i => i.StagingListingNotes).HasMaxLength(1000);
     builder.Property(i => i.DispositionNote).HasMaxLength(1000);
     builder.Property(i => i.SalePrice).HasPrecision(18, 2);
     builder.Property(i => i.ArchivedByUsername).HasMaxLength(150);

     builder.HasIndex(i => i.DispositionReason);
     builder.HasIndex(i => i.LastTouchedAt);
     ```

### 2.4 Service Business Logic & Privacy Invariants (`WhereHouse.Data/Services/`)

1. **Update `WhereHouse.Data/Services/ItemService.cs`:**
   - In `GetItemsAsync`:
     - When `status.HasValue` is `true`, filter `query = query.Where(i => i.Status == status.Value);`.
     - When `status.HasValue` is `false` (default active view), filter `query = query.Where(i => i.Status != ItemStatus.Archived);` so archived items are hidden from active bin views and dashboard grids (PRD 4.7.1).
   - In `MapToDto`:
     - Map `item.StagingTargetPrice`, `item.StagingListingNotes`, `item.StagedAt`, `item.DispositionReason`, `item.DispositionNote`, `item.SalePrice`, `item.ArchivedAt`, `item.ArchivedByUserId`, and `item.ArchivedByUsername`.

2. **Update `WhereHouse.Data/Services/LocationService.cs`:**
   - In `GetLocationNodesAsync` (lines 92–112) and `GetLocationNodeByIdAsync` (lines 175–186):
     - Exclude archived items (`i.Status != ItemStatus.Archived`) when calculating `ItemCount` so active container item counts only reflect non-archived items (PRD 4.7.1).

3. **Update `WhereHouse.Data/Services/SearchService.cs`:**
   - In `MapItemToDto`:
     - Pass `itm.StagingTargetPrice`, `itm.StagingListingNotes`, `itm.StagedAt`, `itm.DispositionReason`, `itm.DispositionNote`, `itm.SalePrice`, `itm.ArchivedAt`, `itm.ArchivedByUserId`, and `itm.ArchivedByUsername` to `ItemDto`.
   - In token matching (`SearchAsync`):
     - Also match tokens against `itm.DispositionNote` and `itm.StagingListingNotes` so users can search the Graveyard by recipient/buyer note (e.g., `"Goodwill"` or `"eBay"`).

4. **Create `WhereHouse.Data/Services/LifecycleService.cs` (and register in `DataServiceCollectionExtensions.cs`):**
   - **Privacy Helper:** Enforce `IsItemAccessible(item, userId, allLocations)` on every item read/mutation (`!item.IsPrivate || item.OwnerId == userId`, plus ancestral location privacy check). Throw `ForbiddenException` if a non-owner targets a private item by ID, and silently skip inaccessible items in list/bulk queries.
   - **`StageItemAsync(userId, itemId, request, ct)`:**
     - Validates `TargetPrice >= 0` if provided (throw `ArgumentException` if negative).
     - Transitions `item.Status = request.IsToSell ? ItemStatus.StagedToSell : ItemStatus.StagedToDonate`.
     - Sets `item.StagingTargetPrice = request.TargetPrice`, `item.StagingListingNotes = string.IsNullOrWhiteSpace(request.ListingNotes) ? null : request.ListingNotes.Trim()`, `item.StagedAt = DateTimeOffset.UtcNow`, and `item.LastTouchedAt = DateTimeOffset.UtcNow`.
     - Clears active checkout fields (`CheckedOutByUserId = null`, `CheckedOutByUsername = null`, `CheckedOutToBorrower = null`, `CheckedOutBorrowerContact = null`, `CheckoutNote = null`, `CheckedOutAt = null`, `CheckoutDueAt = null`, `ActiveLoadoutId = null`, `ActiveLoadoutName = null`) and clears any prior archive fields (`DispositionReason = null`, `DispositionNote = null`, `SalePrice = null`, `ArchivedAt = null`, `ArchivedByUserId = null`, `ArchivedByUsername = null`).
     - Preserves `item.HomeLocationId`.
   - **`UnstageItemAsync(userId, itemId, ct)`:**
     - Transitions `item.Status = ItemStatus.InPlace`.
     - Clears `StagingTargetPrice = null`, `StagingListingNotes = null`, `StagedAt = null`.
     - Updates `item.LastTouchedAt = DateTimeOffset.UtcNow`.
   - **`ArchiveItemAsync(userId, itemId, request, ct)`:**
     - Validates `request.SalePrice >= 0` if provided (throw `ArgumentException` if negative).
     - Resolves `username` from `dbContext.Users`.
     - Sets `item.Status = ItemStatus.Archived`.
     - Sets `item.DispositionReason = request.DispositionReason`.
     - Sets `item.DispositionNote = string.IsNullOrWhiteSpace(request.DispositionNote) ? null : request.DispositionNote.Trim()`.
     - Sets `item.SalePrice = request.DispositionReason == DispositionReason.Sold ? (request.SalePrice ?? item.StagingTargetPrice) : request.SalePrice`.
     - Sets `item.ArchivedAt = DateTimeOffset.UtcNow`, `item.ArchivedByUserId = userId`, `item.ArchivedByUsername = username`, and `item.LastTouchedAt = DateTimeOffset.UtcNow`.
     - Clears active checkout fields (`CheckedOutByUserId`, etc.) and staging fields (`StagingTargetPrice`, `StagingListingNotes`, `StagedAt`), while **preserving `item.HomeLocationId`** so the Graveyard always knows which bin/room the item previously lived in.
   - **`RestoreArchivedItemAsync(userId, itemId, ct)`:**
     - Transitions `item.Status = ItemStatus.InPlace`.
     - Clears `DispositionReason = null`, `DispositionNote = null`, `SalePrice = null`, `ArchivedAt = null`, `ArchivedByUserId = null`, `ArchivedByUsername = null`, `StagingTargetPrice = null`, `StagingListingNotes = null`, `StagedAt = null`.
     - Updates `item.LastTouchedAt = DateTimeOffset.UtcNow`.
   - **`TouchItemAsync(userId, itemId, ct)`:**
     - Updates `item.LastTouchedAt = DateTimeOffset.UtcNow` and saves changes.
   - **`BulkArchiveItemsAsync(userId, request, ct)` & `BulkUnstageItemsAsync(userId, request, ct)`:**
     - Iterates over distinct `request.ItemIds`, skips missing or inaccessible items, applies the archive or unstage transition in a batch, and returns `BulkLifecycleResultDto(processedDtos.Count, processedDtos)`.
     - When bulk archiving with `DispositionReason.Sold` and `request.SalePrice` is `null`, each item that had a `StagingTargetPrice` automatically retains `SalePrice = item.StagingTargetPrice`.
   - **`GetStagedItemsAsync(userId, statusFilter, locationId, includeSubtreeLocations, ct)`:**
     - Queries items where `Status == ItemStatus.StagedToSell || Status == ItemStatus.StagedToDonate` (narrowed by `statusFilter` if `StagedToSell` or `StagedToDonate` is passed).
     - Filters by `IsItemAccessible` and optional `locationId` (with subtree support).
     - Computes:
       - `StagedToSellCount`: count of `StagedToSell` items in the filtered list.
       - `StagedToDonateCount`: count of `StagedToDonate` items in the filtered list.
       - `TotalTargetResaleValue`: sum of `(i.StagingTargetPrice ?? i.EstimatedReplacementValue ?? i.PurchasePrice ?? 0m)` for `StagedToSell` items.
       - `TotalEstimatedDonationValue`: sum of `(i.StagingTargetPrice ?? i.EstimatedReplacementValue ?? i.PurchasePrice ?? 0m)` for `StagedToDonate` items.
     - Orders items by `StagedAt` descending, then `Name`.
   - **`GetGraveyardItemsAsync(userId, dispositionReason, search, ct)`:**
     - Queries accessible items where `Status == ItemStatus.Archived`.
     - Calculates overall Graveyard counts across all accessible archived items (or filtered set): `TotalArchivedCount`, `SoldCount`, `DonatedCount`, `RecycledCount`, `BrokenTrashedCount`, `ConsumedCount`, `TotalSaleProceeds` (sum of `SalePrice ?? 0m` for `Sold` items), and `TotalDonatedEstimatedValue` (sum of `EstimatedReplacementValue ?? PurchasePrice ?? 0m` for `Donated` items).
     - Applies optional `dispositionReason` filter and `search` text filter (matching `Name`, `ShortCode`, `Brand`, `ModelNumber`, `DispositionNote`, or `HomeLocationFullPath`).
     - Orders items by `ArchivedAt` descending, then `Name`.
   - **`GetDustCollectorsAsync(userId, minUntouchedDays, locationId, includeSubtreeLocations, categoryId, ct)`:**
     - Clamps `minUntouchedDays` to `>= 1` (default `365`).
     - Computes `cutoffDate = DateTimeOffset.UtcNow.AddDays(-minUntouchedDays)`.
     - Queries accessible items where `Status == ItemStatus.InPlace` and `LastTouchedAt <= cutoffDate` (plus optional `locationId` subtree and `categoryId` filters).
     - For each matching item, calculates `daysUntouched = Math.Max(1, (int)Math.Floor((DateTimeOffset.UtcNow - item.LastTouchedAt).TotalDays))` and `estimatedValue = (item.EstimatedReplacementValue ?? item.PurchasePrice ?? 0m)`.
     - Groups items by `HomeLocationId` into `DustCollectorLocationGroupDto` ordered by `LocationFullPath` ascending (with items inside each group ordered by `DaysUntouched` descending).

---

## 3. API Endpoints (`WhereHouse.API/Controllers/LifecycleController.cs`)

### `LifecycleController` (`[Route("lifecycle")]`, `[Authorize]`)

| Verb | Route (`/api/...`) | Request Body / Query | Response (`200`) | Error Cases (`400`/`403`/`404`) |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/lifecycle/staged` | `?status=&locationId=&includeSubtreeLocations=true` | `DeclutterStagingSummaryDto` (`200 OK`) | `401 Unauthorized` |
| `GET` | `/lifecycle/graveyard` | `?dispositionReason=&search=` | `GraveyardSummaryDto` (`200 OK`) | `401 Unauthorized` |
| `GET` | `/lifecycle/dust-collectors` | `?minUntouchedDays=365&locationId=&includeSubtreeLocations=true&categoryId=` | `DustCollectorInsightsDto` (`200 OK`) | `401 Unauthorized` |
| `POST` | `/lifecycle/items/{id:guid}/stage` | `StageItemRequest` | `ItemDto` (`200 OK`) | `400` negative price, `403` private item, `404` item not found |
| `POST` | `/lifecycle/items/{id:guid}/unstage` | *(empty or optional)* | `ItemDto` (`200 OK`) | `403` private item, `404` item not found |
| `POST` | `/lifecycle/items/{id:guid}/archive` | `ArchiveItemRequest` | `ItemDto` (`200 OK`) | `400` invalid request, `403` private item, `404` item not found |
| `POST` | `/lifecycle/items/{id:guid}/restore` | *(empty or optional)* | `ItemDto` (`200 OK`) | `403` private item, `404` item not found |
| `POST` | `/lifecycle/items/{id:guid}/touch` | *(empty or optional)* | `ItemDto` (`200 OK`) | `403` private item, `404` item not found |
| `POST` | `/lifecycle/bulk-archive` | `BulkArchiveRequest` | `BulkLifecycleResultDto` (`200 OK`) | `400` empty item list |
| `POST` | `/lifecycle/bulk-unstage` | `BulkUnstageRequest` | `BulkLifecycleResultDto` (`200 OK`) | `400` empty item list |

---

## 4. Angular Frontend Design (`WhereHouse.Client`)

### 4.1 Models & Services (`src/app/core/`)

1. **Update `src/app/core/models/item.models.ts`:**
   - Add `DispositionReasons` const object, `DispositionReason` type, and `DISPOSITION_REASON_LABELS`:
     ```typescript
     export const DispositionReasons = {
       Sold: 0,
       Donated: 1,
       Recycled: 2,
       BrokenTrashed: 3,
       Consumed: 4,
     } as const;

     export type DispositionReason = (typeof DispositionReasons)[keyof typeof DispositionReasons];

     export const DISPOSITION_REASON_LABELS: Record<DispositionReason, string> = {
       [DispositionReasons.Sold]: 'Sold',
       [DispositionReasons.Donated]: 'Donated',
       [DispositionReasons.Recycled]: 'Recycled / Scrapped',
       [DispositionReasons.BrokenTrashed]: 'Broken / Trashed',
       [DispositionReasons.Consumed]: 'Consumed / Depleted',
     };
     ```
   - Add optional staging and archive fields to `ItemDto`:
     ```typescript
     stagingTargetPrice?: number | null;
     stagingListingNotes?: string | null;
     stagedAt?: string | null;
     dispositionReason?: DispositionReason | null;
     dispositionNote?: string | null;
     salePrice?: number | null;
     archivedAt?: string | null;
     archivedByUserId?: string | null;
     archivedByUsername?: string | null;
     ```

2. **Create `src/app/core/models/lifecycle.models.ts`:**
   - Define `StageItemRequest`, `ArchiveItemRequest`, `BulkArchiveRequest`, `BulkUnstageRequest`, `BulkLifecycleResultDto`, `DeclutterStagingSummaryDto`, `DustCollectorItemDto`, `DustCollectorLocationGroupDto`, `DustCollectorInsightsDto`, and `GraveyardSummaryDto`.

3. **Create `src/app/core/services/lifecycle/lifecycle.service.ts` (& `.spec.ts`):**
   - Decorated with `@Service()`.
   - HTTP methods wrapping `/api/lifecycle`:
     - `getStagedItems(statusFilter?: ItemStatus, locationId?: string, includeSubtreeLocations = true): Observable<DeclutterStagingSummaryDto>`
     - `getGraveyardItems(dispositionReason?: DispositionReason, search?: string): Observable<GraveyardSummaryDto>`
     - `getDustCollectors(minUntouchedDays = 365, locationId?: string, includeSubtreeLocations = true, categoryId?: string): Observable<DustCollectorInsightsDto>`
     - `stageItem(itemId: string, request: StageItemRequest): Observable<ItemDto>`
     - `unstageItem(itemId: string): Observable<ItemDto>`
     - `archiveItem(itemId: string, request: ArchiveItemRequest): Observable<ItemDto>`
     - `restoreArchivedItem(itemId: string): Observable<ItemDto>`
     - `touchItem(itemId: string): Observable<ItemDto>`
     - `bulkArchiveItems(request: BulkArchiveRequest): Observable<BulkLifecycleResultDto>`
     - `bulkUnstageItems(request: BulkUnstageRequest): Observable<BulkLifecycleResultDto>`

### 4.2 Feature Components & Dialogs (`src/app/features/dashboard/`)

1. **Create `StageArchiveDialogComponent` (`src/app/features/dashboard/stage-archive-dialog/stage-archive-dialog.component.ts` & `.spec.ts`):**
   - Opens for a specific `ItemDto` with `initialMode: 'stage' | 'archive'`.
   - **Mode Toggle Header:** Allows switching between **Stage to Sell / Donate** (`sell`) and **Send to Graveyard / Archive** (`inventory_2`).
   - **When Mode = `'stage'`:**
     - Toggle between **Stage to Sell** (`IsToSell = true`) and **Stage to Donate** (`IsToSell = false`).
     - Target Asking Price / Estimated Donation Value (`TargetPrice`, `number`, pre-filled from `item.stagingTargetPrice ?? item.estimatedReplacementValue ?? item.purchasePrice`).
     - Listing Description / Platform / Notes (`ListingNotes`, e.g., `"List on FB Marketplace"`, `"Goodwill pile"`).
     - Submit calls `lifecycleService.stageItem(item.id, req)`.
   - **When Mode = `'archive'`:**
     - Select `DispositionReason` (`Sold`, `Donated`, `Recycled / Scrapped`, `Broken / Trashed`, `Consumed / Depleted`).
     - When `DispositionReason === DispositionReasons.Sold`, show **Sale Price ($)** input (pre-filled from `item.stagingTargetPrice ?? item.salePrice`).
     - Disposition Note input (e.g., `"Sold on eBay"`, `"Donated to Habitat ReStore"`, `"Recycled at county e-waste"`).
     - Displays a notice confirming the item's last known location (`item.homeLocationFullPath`) will be preserved in the Graveyard.
     - Submit calls `lifecycleService.archiveItem(item.id, req)`.

2. **Create `DeclutterGraveyardDialogComponent` (`src/app/features/dashboard/declutter-graveyard-dialog/declutter-graveyard-dialog.component.ts` & `.spec.ts`):**
   - Comprehensive 3-tab modal (`width: '940px', maxWidth: '96vw'`):
   - **Tab 1: Declutter Staging (`sell`):**
     - Summary metric cards: **Total Staged Items**, **Target Resale Value ($)** (`StagedToSellCount` items), and **Estimated Donation Value ($)** (`StagedToDonateCount` items).
     - Filter chips: `All Staged`, `Staged to Sell`, `Staged to Donate`.
     - Multi-select checkboxes (`selectedStagedIds` signal) with **"Select All"** toggle.
     - Bulk action toolbar when `selectedStagedIds().size > 0`:
       - Disposition selector (`Sold`, `Donated`, `Recycled`, `Broken/Trashed`) + optional note + **"Archive Selected ({{ count }})"** button (`bulkArchiveItems`).
       - **"Keep / Unstage Selected"** button (`bulkUnstageItems`).
     - Per-item row actions: **"Mark Sold / Archive"**, **"Keep (Unstage)"**.
   - **Tab 2: Dust Collector Insights (`hourglass_bottom`):**
     - Threshold filter chips: **`> 6 Months (180d)`**, **`> 1 Year (365d)`** (default), **`> 2 Years (730d)`**, plus optional Location Subtree and Category filter dropdowns.
     - Summary banner showing `TotalItemsCount` untouched items and `TotalEstimatedValue` of idle inventory.
     - **Location / Container Accordion Groups (`LocationGroups`):**
       - Each container header shows `LocationFullPath`, `LocationShortCode`, item count, and `GroupEstimatedValue`.
       - Each Dust Collector row displays `Item.Name`, `Item.ShortCode`, **`{{ daysUntouched }} days untouched`** badge, `EstimatedValue`, and 1-tap action buttons:
         - **"Stage to Sell"** (`sell`)
         - **"Stage to Donate"** (`volunteer_activism`)
         - **"Archive"** (`archive`)
         - **"Still Using (Reset Timer)"** (`touch_app` — calls `lifecycleService.touchItem`)
   - **Tab 3: Graveyard Archive (`inventory_2`):**
     - Summary banner showing `TotalArchivedCount`, `TotalSaleProceeds` recouped from sales, and `TotalDonatedEstimatedValue`.
     - Filter chips by `DispositionReason` (`All`, `Sold`, `Donated`, `Recycled / Scrapped`, `Broken / Trashed`, `Consumed / Depleted`) + search input.
     - Each Graveyard row displays `ShortCode`, `Name`, disposition badge (with `SalePrice` if sold), `ArchivedAt` date, `DispositionNote`, **"Previously in: `{{ homeLocationFullPath || 'Unassigned' }}`"**, and a 1-tap **"Restore to Home Bin"** button (`restore_from_trash`).

3. **Update `SmartSearchDialogComponent` (`src/app/features/dashboard/smart-search-dialog/smart-search-dialog.component.ts` & `.spec.ts`):**
   - Inject `LifecycleService` and `MatSnackBar`.
   - In the collapsible **"Found in Graveyard / Archived"** section:
     - Display the rich disposition badge using `DISPOSITION_REASON_LABELS` (e.g., `Donated`, `Sold ($45.00)`, `Broken / Trashed`), `arch.archivedAt | date:'mediumDate'`, `arch.dispositionNote`, and `Previously in {{ arch.homeLocationFullPath || 'Unassigned' }}` (per PRD 4.7.1).
     - Add a 1-tap **"Restore to Home Bin"** icon button (`restore_from_trash`) that calls `lifecycleService.restoreArchivedItem(arch.id)` and refreshes the search results.

4. **Update `DashboardComponent` (`dashboard.component.ts`, `.html`, `.scss`, `.spec.ts`):**
   - Add a **"Declutter & Graveyard" (`recycling`)** button in the top navigation bar (and mobile menu) that opens `DeclutterGraveyardDialogComponent`.
   - On item cards in `dashboard.component.html`:
     - Display a **Declutter Staged Banner** when `item.status === ItemStatuses.StagedToSell || item.status === ItemStatuses.StagedToDonate` showing whether it is staged to sell (with `stagingTargetPrice`) or staged to donate, plus `stagingListingNotes` and a 1-tap **"Keep"** (`undo`) or **"Archive"** (`archive`) action.
     - In the item card overflow menu (`mat-menu`), add **"Stage to Sell / Donate..."** (`sell`), **"Unstage (Keep in Place)"** (when staged), and **"Archive to Graveyard..."** (`inventory_2`).

---

## 5. Step-by-Step Execution Checklist (For Implementation Agent)

- [ ] **Task 1: Backend Core & Data Layer (`WhereHouse.Core` & `WhereHouse.Data`)**
  - Update `WhereHouse.Core/Items/ItemModels.cs` with `DispositionReason` enum and optional staging/archive fields on `ItemDto`.
  - Create `WhereHouse.Core/Lifecycle/LifecycleModels.cs` and `WhereHouse.Core/Lifecycle/ILifecycleService.cs`.
  - Update `WhereHouse.Data/Entities/InventoryItem.cs` and `WhereHouse.Data/Configurations/InventoryItemConfiguration.cs` with staging and archive columns/indexes.
  - Update `WhereHouse.Data/Services/ItemService.cs` (exclude `Archived` when `status` is `null`, map new fields), `WhereHouse.Data/Services/LocationService.cs` (exclude `Archived` from `ItemCount`), and `WhereHouse.Data/Services/SearchService.cs` (map new fields and match `DispositionNote` / `StagingListingNotes`).
  - Implement `WhereHouse.Data/Services/LifecycleService.cs` and register `ILifecycleService` in `WhereHouse.Data/DataServiceCollectionExtensions.cs`.
  - Ensure local SQL Server is running, then generate, apply, and format the EF Core migration:
    ```powershell
    .\scripts\ensure-local-infra.ps1
    dotnet ef migrations add AddDeclutterAndGraveyardLifecycle --project WhereHouse.Data
    dotnet ef database update --project WhereHouse.Data
    dotnet csharpier format WhereHouse.Data/Migrations
    ```
  - Run unit tests in `Tests/WhereHouse.Core.UnitTests`:
    ```powershell
    dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj
    ```

- [ ] **Task 2: API Controller & Integration Tests (`WhereHouse.API` & `Tests/WhereHouse.API.IntegrationTests`)**
  - Create `WhereHouse.API/Controllers/LifecycleController.cs`.
  - Update `Tests/WhereHouse.API.IntegrationTests/OpenApiIntegrationTests.cs` to assert `"/lifecycle"`.
  - Create `Tests/WhereHouse.API.IntegrationTests/LifecycleIntegrationTests.cs` covering:
    1. **Staging to Sell & Donate (`PRD 4.7.2`):** Staging items as `StagedToSell` (with `TargetPrice` & `ListingNotes`) and `StagedToDonate`, verifying `GET /api/lifecycle/staged` summary calculations (`TotalTargetResaleValue`, `TotalEstimatedDonationValue`), and unstaging back to `InPlace`.
    2. **Graveyard Archive & Active Bin Exclusion (`PRD 4.7.1`):** Archiving an item with `DispositionReason.Donated` and `DispositionNote`, verifying `HomeLocationId` is preserved while `GET /api/items` (default active view) and `LocationNodeDto.ItemCount` exclude the archived item, verifying `GET /api/search` returns the item in `ArchivedItems` with full disposition metadata, and restoring the item back to `InPlace` via `POST /api/lifecycle/items/{id}/restore`.
    3. **Bulk Archive & Bulk Unstage:** Bulk archiving staged items as `DispositionReason.Sold` (verifying each item's `StagingTargetPrice` automatically becomes its `SalePrice` in `GraveyardSummaryDto.TotalSaleProceeds`) and bulk unstaging items.
    4. **Dust Collector Insights & Touch Reset (`PRD 4.7.3`):** Creating items with old `LastTouchedAt` timestamps (or querying with `minUntouchedDays`), verifying `GET /api/lifecycle/dust-collectors` groups them by location and computes `TotalEstimatedValue`, and verifying `POST /api/lifecycle/items/{id}/touch` resets `LastTouchedAt` so the item is no longer flagged.
    5. **"Secret / Gift Mode" (`IsPrivate`) Isolation:** Verifying User B cannot stage, archive, restore, touch, or view User A's private items in `staged`, `graveyard`, or `dust-collectors` endpoints (`403 Forbidden` on direct ID / omitted from summary queries).
  - Run integration tests until 100% green:
    ```powershell
    dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj
    ```

- [ ] **Task 3: Angular Client & Unit Tests (`WhereHouse.Client`)**
  - Update `src/app/core/models/item.models.ts` and create `src/app/core/models/lifecycle.models.ts`.
  - Create `LifecycleService` (`src/app/core/services/lifecycle/lifecycle.service.ts` & `.spec.ts`).
  - Create `StageArchiveDialogComponent` (`src/app/features/dashboard/stage-archive-dialog/stage-archive-dialog.component.ts` & `.spec.ts`).
  - Create `DeclutterGraveyardDialogComponent` (`src/app/features/dashboard/declutter-graveyard-dialog/declutter-graveyard-dialog.component.ts` & `.spec.ts`).
  - Update `SmartSearchDialogComponent` (`smart-search-dialog.component.ts` & `.spec.ts`) with Graveyard disposition badges, previous location, and 1-tap Restore.
  - Update `DashboardComponent` (`.ts`, `.html`, `.scss`, `.spec.ts`) with top-bar Declutter & Graveyard button, item card Staged status banner, and Stage / Unstage / Archive menu actions.
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
  - Update `docs/plans/phase-07-declutter-graveyard-and-dust-collectors.md` status to `[x] Completed`.
