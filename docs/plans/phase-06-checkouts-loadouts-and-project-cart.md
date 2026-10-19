# Phase 06: Check-In / Check-Out State Machine, External Loans, Reusable Loadouts & Project Cart

> **Branch:** `feature/phase-06-checkouts-loadouts-and-project-cart`
> **Status:** [x] Completed
> **PRD Reference:** `docs/prd.md` — Sections 4.2.1 #3 (`Kit Business Logic`), 4.3.4 #3 (`Scan-to-Checkout / Return`), 4.5.1 (`Permanent Home Location vs. Current Status`), 4.5.2 (`Reusable "Loadouts" & Consumable Reconciliation`), 4.5.3 (`Ad-Hoc "Project Cart"`), and 4.8.2 (`"Secret / Gift Mode" Privacy`)
> **Target Execution:** Run `/execute-phase` with your implementation model to execute this plan step-by-step.

---

## 1. Scope & Objectives

This phase initiates **Milestone 3 (Movement & Projects)** by delivering the complete **Check-In / Check-Out & External Loan Engine**, **Reusable Loadouts (Packing Lists with Room-by-Room Pick Lists & Consumable Reconciliation)**, and the **Ad-Hoc Project Cart**:

1. **Permanent Home Location vs. Real-Time Checkout / Loan Status (`ICheckoutService`, `CheckoutsController`):**
   - Checking an item out (`InUse` for a household project or `LoanedOut` to an external borrower with an optional due date) **never overwrites** its `HomeLocationId`.
   - Stores active checkout metadata directly on `InventoryItem` (`CheckedOutByUserId`, `CheckedOutByUsername`, `CheckedOutToBorrower`, `CheckedOutBorrowerContact`, `CheckoutNote`, `CheckedOutAt`, `CheckoutDueAt`, `ActiveLoadoutId`, `ActiveLoadoutName`) and appends an immutable audit record to `CheckoutLogs`.
   - **Parent Bin Dimmed / Badged State:** Checked-out items remain visible inside their home bin on the Dashboard and in Scanner "X-Ray" views with high-visibility badges (*"In Use by alice (Kitchen Remodel)"* or *"Loaned to Mike (Due: Nov 1, 2026)"*, plus an *"OVERDUE"* alert badge when past due).
   - **Kit Cascade Checkout & Return (PRD 4.2.1 #3):** Checking out a `Kit` item (`ItemType.Kit`) automatically cascades the checkout to all accessible member `ChildItems` that are currently `InPlace`. Returning a `Kit` automatically returns its checked-out `ChildItems` back to `InPlace`.
   - **Scan-to-Checkout / Return (PRD 4.3.4 #3):** Enhances `ScannerDialogComponent` with a dedicated **Checkout / Return** tab and 1-tap `Grab Item` / `Loan Out` / `Return to Home Bin` actions on scanned items and container X-Ray lists.

2. **Reusable "Loadouts" / Packing Lists (`ILoadoutService`, `LoadoutsController`, `LoadoutsDialogComponent`):**
   - Users can create named, reusable **Loadout Templates** (e.g., *Weekend Camping Trip*, *Range Day*, *Drywall Repair Kit*) containing specific tracked items (`Unique` / `Kit`) and/or required quantities of stackable items (`Quantity`).
   - **Pre-Flight Check & Room-by-Room Pick List:**
     - Evaluates every item in the Loadout and flags warnings if any member item is `Broken`, `LoanedOut`, already `InUse` elsewhere, `Archived`, or has `CurrentQuantity < RequiredQuantity`.
     - Groups items by **Location / Container (`HomeLocationFullPath`)** so the user walks through the house/garage once, opening each bin only once.
   - **Batch Checkout:** 1-click *"Check Out Loadout"* transitions all available items in the Loadout to `InUse` (tagged with `Loadout: <Name>`) and marks the Loadout as `ActiveCheckout`.
   - **Pack-Back / Return Checklist & Consumable Reconciliation (PRD 4.5.2 #4–5):**
     - Distinguishes between **Returnable Multiples** (`IsConsumable = false`, e.g., `6x Tent Stakes`) and **Consumables** (`IsConsumable = true`, e.g., `AA Batteries`, `Zip Ties`).
     - During Pack-Back, users check off returned items (or scan their QR/Barcode) and adjust `QuantityUsed` vs `QuantityReturned` for consumables (`Used All` / `Returned All` shortcuts).
     - Deducts `QuantityUsed` from the item's `CurrentQuantity` in its home bin (automatically triggering `IsLowStock` if `CurrentQuantity <= MinQuantity`).
     - Any item left unchecked during Pack-Back stays `InUse` (*Out of Place*) until returned.

3. **Ad-Hoc "Project Cart" (`ProjectCart` in `DashboardComponent` & `LoadoutsDialogComponent`):**
   - While browsing or searching across the app, users can click **"Add to Project Cart"** on any item card.
   - The Project Cart generates an instant **Room-by-Room Pick List**, checks all cart items out together under an optional project label (via `POST /api/checkouts/batch-checkout`), allows saving the cart as a reusable Loadout, and provides a 1-click batch return checklist (`POST /api/checkouts/batch-return`).

4. **Out of Scope for Phase 06 (Deferred to Phase 07):**
   - Declutter Staging (`StagedToSell` / `StagedToDonate` dedicated view), the "Graveyard / Archive" disposition workflow (`Sold`, `Donated`, `Recycled`, `BrokenTrashed`, `Consumed`), and "Dust Collector" insights (PRD Section 4.7).

---

## 2. Domain & Database Design (`WhereHouse.Core` & `WhereHouse.Data`)

### 2.1 Enums & Models (`WhereHouse.Core/Checkouts/` & `WhereHouse.Core/Loadouts/`)

1. **Create `WhereHouse.Core/Checkouts/CheckoutModels.cs`:**
   ```csharp
   using System.ComponentModel.DataAnnotations;
   using WhereHouse.Core.Items;

   namespace WhereHouse.Core.Checkouts;

   public enum CheckoutActionType
   {
       CheckOutInUse = 0,
       LoanOutExternal = 1,
       ReturnToHome = 2,
   }

   public sealed record CheckoutLogDto(
       Guid Id,
       Guid ItemId,
       string ItemShortCode,
       string ItemName,
       CheckoutActionType ActionType,
       Guid PerformedByUserId,
       string PerformedByUsername,
       string? BorrowerName,
       string? BorrowerContact,
       string? ProjectOrNote,
       Guid? LoadoutId,
       string? LoadoutName,
       decimal QuantityAffected,
       decimal? QuantityConsumed,
       DateTimeOffset OccurredAt,
       DateTimeOffset? ExpectedReturnAt,
       DateTimeOffset? ReturnedAt
   );

   public sealed record CheckoutItemRequest(
       bool IsExternalLoan = false,
       [MaxLength(150)] string? BorrowerName = null,
       [MaxLength(200)] string? BorrowerContact = null,
       [MaxLength(500)] string? ProjectOrNote = null,
       DateTimeOffset? ExpectedReturnAt = null,
       decimal? Quantity = null
   );

   public sealed record ReturnItemRequest(
       [MaxLength(500)] string? ReturnNote = null,
       decimal? QuantityUsed = null,
       ItemCondition? UpdatedCondition = null
   );

   public sealed record BatchCheckoutRequest(
       [Required, MinLength(1)] IReadOnlyList<Guid> ItemIds,
       bool IsExternalLoan = false,
       [MaxLength(150)] string? BorrowerName = null,
       [MaxLength(200)] string? BorrowerContact = null,
       [MaxLength(500)] string? ProjectOrNote = null,
       DateTimeOffset? ExpectedReturnAt = null
   );

   public sealed record BatchReturnItemEntry(
       [Required] Guid ItemId,
       decimal? QuantityUsed = null
   );

   public sealed record BatchReturnRequest(
       [Required, MinLength(1)] IReadOnlyList<BatchReturnItemEntry> Items,
       [MaxLength(500)] string? ReturnNote = null
   );

   public sealed record BatchCheckoutResultDto(
       int ProcessedCount,
       IReadOnlyList<ItemDto> Items
   );
   ```

2. **Create `WhereHouse.Core/Checkouts/ICheckoutService.cs`:**
   ```csharp
   using WhereHouse.Core.Items;

   namespace WhereHouse.Core.Checkouts;

   public interface ICheckoutService
   {
       Task<ItemDto?> CheckoutItemAsync(
           Guid userId,
           Guid itemId,
           CheckoutItemRequest request,
           CancellationToken cancellationToken = default
       );

       Task<ItemDto?> ReturnItemAsync(
           Guid userId,
           Guid itemId,
           ReturnItemRequest request,
           CancellationToken cancellationToken = default
       );

       Task<BatchCheckoutResultDto> BatchCheckoutItemsAsync(
           Guid userId,
           BatchCheckoutRequest request,
           CancellationToken cancellationToken = default
       );

       Task<BatchCheckoutResultDto> BatchReturnItemsAsync(
           Guid userId,
           BatchReturnRequest request,
           CancellationToken cancellationToken = default
       );

       Task<IReadOnlyList<ItemDto>> GetActiveCheckoutsAsync(
           Guid userId,
           bool? externalLoansOnly = null,
           bool? overdueOnly = null,
           CancellationToken cancellationToken = default
       );

       Task<IReadOnlyList<CheckoutLogDto>> GetItemCheckoutHistoryAsync(
           Guid userId,
           Guid itemId,
           CancellationToken cancellationToken = default
       );
   }
   ```

3. **Create `WhereHouse.Core/Loadouts/LoadoutModels.cs`:**
   ```csharp
   using System.ComponentModel.DataAnnotations;
   using WhereHouse.Core.Items;

   namespace WhereHouse.Core.Loadouts;

   public enum LoadoutStatus
   {
       Ready = 0,
       ActiveCheckout = 1,
   }

   public sealed record LoadoutItemDto(
       Guid Id,
       Guid LoadoutId,
       Guid ItemId,
       string ItemShortCode,
       string ItemName,
       ItemType ItemType,
       ItemStatus ItemStatus,
       ItemCondition ItemCondition,
       Guid? HomeLocationId,
       string? HomeLocationName,
       string? HomeLocationShortCode,
       string? HomeLocationFullPath,
       string? ContainerStyle,
       string? PrimaryColor,
       string? AccentColor,
       string? ColorLabel,
       decimal AvailableQuantity,
       string? Unit,
       decimal RequiredQuantity,
       bool IsConsumable,
       bool IsCurrentlyCheckedOut,
       decimal QuantityCheckedOut,
       decimal QuantityUsed,
       decimal QuantityReturned,
       bool HasPreFlightWarning,
       string? PreFlightWarningMessage,
       int SortOrder
   );

   public sealed record LoadoutPickListStopDto(
       Guid? LocationId,
       string LocationName,
       string? LocationShortCode,
       string LocationFullPath,
       string? ContainerStyle,
       string? PrimaryColor,
       string? AccentColor,
       string? ColorLabel,
       IReadOnlyList<LoadoutItemDto> Items
   );

   public sealed record LoadoutDto(
       Guid Id,
       string Name,
       string? Description,
       string? Icon,
       LoadoutStatus Status,
       DateTimeOffset? LastCheckedOutAt,
       DateTimeOffset? LastReturnedAt,
       string? ActiveCheckoutNote,
       bool IsPrivate,
       Guid OwnerId,
       int TotalItemCount,
       int CheckedOutItemCount,
       int PreFlightWarningCount,
       IReadOnlyList<string> PreFlightWarnings,
       IReadOnlyList<LoadoutItemDto> Items,
       IReadOnlyList<LoadoutPickListStopDto> PickListStops,
       DateTimeOffset CreatedAt,
       DateTimeOffset ModifiedAt
   );

   public sealed record UpsertLoadoutItemRequest(
       [Required] Guid ItemId,
       decimal RequiredQuantity = 1m,
       bool IsConsumable = false,
       int SortOrder = 0
   );

   public sealed record CreateLoadoutRequest(
       [Required, MaxLength(150)] string Name,
       [MaxLength(1000)] string? Description = null,
       [MaxLength(64)] string? Icon = null,
       bool IsPrivate = false,
       IReadOnlyList<UpsertLoadoutItemRequest>? Items = null
   );

   public sealed record UpdateLoadoutRequest(
       [Required, MaxLength(150)] string Name,
       [MaxLength(1000)] string? Description = null,
       [MaxLength(64)] string? Icon = null,
       bool IsPrivate = false,
       IReadOnlyList<UpsertLoadoutItemRequest>? Items = null
   );

   public sealed record CheckoutLoadoutRequest(
       [MaxLength(500)] string? CheckoutNote = null
   );

   public sealed record PackBackLoadoutItemEntry(
       [Required] Guid ItemId,
       bool IsReturned = true,
       decimal QuantityUsed = 0m,
       decimal? QuantityReturned = null
   );

   public sealed record PackBackLoadoutRequest(
       [Required, MinLength(1)] IReadOnlyList<PackBackLoadoutItemEntry> Items,
       [MaxLength(500)] string? ReturnNote = null
   );
   ```

4. **Create `WhereHouse.Core/Loadouts/ILoadoutService.cs`:**
   ```csharp
   namespace WhereHouse.Core.Loadouts;

   public interface ILoadoutService
   {
       Task<IReadOnlyList<LoadoutDto>> GetLoadoutsAsync(
           Guid userId,
           CancellationToken cancellationToken = default
       );

       Task<LoadoutDto?> GetLoadoutByIdAsync(
           Guid userId,
           Guid id,
           CancellationToken cancellationToken = default
       );

       Task<LoadoutDto> CreateLoadoutAsync(
           Guid userId,
           CreateLoadoutRequest request,
           CancellationToken cancellationToken = default
       );

       Task<LoadoutDto?> UpdateLoadoutAsync(
           Guid userId,
           Guid id,
           UpdateLoadoutRequest request,
           CancellationToken cancellationToken = default
       );

       Task<bool> DeleteLoadoutAsync(
           Guid userId,
           Guid id,
           CancellationToken cancellationToken = default
       );

       Task<LoadoutDto?> CheckoutLoadoutAsync(
           Guid userId,
           Guid id,
           CheckoutLoadoutRequest request,
           CancellationToken cancellationToken = default
       );

       Task<LoadoutDto?> PackBackLoadoutAsync(
           Guid userId,
           Guid id,
           PackBackLoadoutRequest request,
           CancellationToken cancellationToken = default
       );
   }
   ```

5. **Update `WhereHouse.Core/Items/ItemModels.cs` (`ItemDto`):**
   - Append optional active checkout parameters to `ItemDto`:
     ```csharp
     Guid? CheckedOutByUserId = null,
     string? CheckedOutByUsername = null,
     string? CheckedOutToBorrower = null,
     string? CheckedOutBorrowerContact = null,
     string? CheckoutNote = null,
     DateTimeOffset? CheckedOutAt = null,
     DateTimeOffset? CheckoutDueAt = null,
     bool IsOverdueLoan = false,
     Guid? ActiveLoadoutId = null,
     string? ActiveLoadoutName = null
     ```

### 2.2 Entities & EF Core Configurations (`WhereHouse.Data/`)

1. **Update `WhereHouse.Data/Entities/InventoryItem.cs`:**
   - Add active checkout properties and navigation collections:
     ```csharp
     public Guid? CheckedOutByUserId { get; set; }

     public string? CheckedOutByUsername { get; set; }

     public string? CheckedOutToBorrower { get; set; }

     public string? CheckedOutBorrowerContact { get; set; }

     public string? CheckoutNote { get; set; }

     public DateTimeOffset? CheckedOutAt { get; set; }

     public DateTimeOffset? CheckoutDueAt { get; set; }

     public Guid? ActiveLoadoutId { get; set; }

     public string? ActiveLoadoutName { get; set; }

     public ICollection<CheckoutLog> CheckoutLogs { get; set; } = new List<CheckoutLog>();

     public ICollection<LoadoutItem> LoadoutMemberships { get; set; } = new List<LoadoutItem>();
     ```
2. **Update `WhereHouse.Data/Configurations/InventoryItemConfiguration.cs`:**
   - Configure string lengths:
     - `CheckedOutByUsername`: `HasMaxLength(150)`
     - `CheckedOutToBorrower`: `HasMaxLength(150)`
     - `CheckedOutBorrowerContact`: `HasMaxLength(200)`
     - `CheckoutNote`: `HasMaxLength(500)`
     - `ActiveLoadoutName`: `HasMaxLength(150)`
   - Add index on `ActiveLoadoutId`.
3. **Update `WhereHouse.Data/Entities/User.cs`:**
   - Add `public ICollection<Loadout> OwnedLoadouts { get; set; } = new List<Loadout>();`.
4. **Create `WhereHouse.Data/Entities/CheckoutLog.cs` & `WhereHouse.Data/Configurations/CheckoutLogConfiguration.cs`:**
   - Table `"CheckoutLogs"`, PK `Id`.
   - `PerformedByUsername` (`IsRequired().HasMaxLength(150)`), `BorrowerName` (`HasMaxLength(150)`), `BorrowerContact` (`HasMaxLength(200)`), `ProjectOrNote` (`HasMaxLength(500)`), `LoadoutName` (`HasMaxLength(150)`).
   - `QuantityAffected` & `QuantityConsumed` (`HasPrecision(18, 2)`).
   - `CreatedBy` & `ModifiedBy` (`IsRequired().HasMaxLength(256)`).
   - Indexes on `ItemId`, `PerformedByUserId`, `LoadoutId`, and `OccurredAt`.
   - FK `HasOne(c => c.Item).WithMany(i => i.CheckoutLogs).HasForeignKey(c => c.ItemId).OnDelete(DeleteBehavior.Cascade)`.
5. **Create `WhereHouse.Data/Entities/Loadout.cs` & `WhereHouse.Data/Configurations/LoadoutConfiguration.cs`:**
   - Table `"Loadouts"`, PK `Id`.
   - `Name` (`IsRequired().HasMaxLength(150)`), `Description` (`HasMaxLength(1000)`), `Icon` (`HasMaxLength(64)`), `ActiveCheckoutNote` (`HasMaxLength(500)`).
   - `CreatedBy` & `ModifiedBy` (`IsRequired().HasMaxLength(256)`).
   - Indexes on `OwnerId` and `Status`.
   - FK `HasOne(l => l.Owner).WithMany(u => u.OwnedLoadouts).HasForeignKey(l => l.OwnerId).OnDelete(DeleteBehavior.Restrict)`.
6. **Create `WhereHouse.Data/Entities/LoadoutItem.cs` & `WhereHouse.Data/Configurations/LoadoutItemConfiguration.cs`:**
   - Table `"LoadoutItems"`, PK `Id`.
   - `RequiredQuantity`, `QuantityCheckedOut`, `QuantityUsed`, `QuantityReturned` (`HasPrecision(18, 2)`).
   - `CreatedBy` & `ModifiedBy` (`IsRequired().HasMaxLength(256)`).
   - Indexes on `LoadoutId`, `ItemId`, and composite `(LoadoutId, ItemId)`.
   - FK `HasOne(li => li.Loadout).WithMany(l => l.Items).HasForeignKey(li => li.LoadoutId).OnDelete(DeleteBehavior.Cascade)`.
   - FK `HasOne(li => li.Item).WithMany(i => i.LoadoutMemberships).HasForeignKey(li => li.ItemId).OnDelete(DeleteBehavior.Restrict)` (and in `ItemService.DeleteItemAsync`, remove any `LoadoutItems` referencing the deleted `ItemId` before removing the item, preventing SQL Server multiple cascade paths!).
7. **Update `WhereHouse.Data/WhereHouseDbContext.cs`:**
   - Add `public DbSet<CheckoutLog> CheckoutLogs => Set<CheckoutLog>();`
   - Add `public DbSet<Loadout> Loadouts => Set<Loadout>();`
   - Add `public DbSet<LoadoutItem> LoadoutItems => Set<LoadoutItem>();`

### 2.3 Service Implementations (`WhereHouse.Data/Services/`)

1. **Update `ItemService.cs` & `SearchService.cs`:**
   - In `ItemService.DeleteItemAsync`: remove any `dbContext.LoadoutItems.Where(li => li.ItemId == id)` before removing `item`.
   - In `ItemService.MapToDto` and `SearchService.MapItemToDto`: map `CheckedOutByUserId`, `CheckedOutByUsername`, `CheckedOutToBorrower`, `CheckedOutBorrowerContact`, `CheckoutNote`, `CheckedOutAt`, `CheckoutDueAt`, `IsOverdueLoan` (`item.Status == ItemStatus.LoanedOut && item.CheckoutDueAt.HasValue && item.CheckoutDueAt.Value < DateTimeOffset.UtcNow`), `ActiveLoadoutId`, and `ActiveLoadoutName`.

2. **Create `WhereHouse.Data/Services/CheckoutService.cs` (`ICheckoutService`):**
   - Injects `WhereHouseDbContext` and `IItemService`.
   - Resolves the acting user's username from `dbContext.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == userId)`.
   - **`CheckoutItemAsync(userId, itemId, request)`:**
     - Loads `InventoryItem` with `Include(i => i.ChildItems)`.
     - Returns `null` if not found; throws `ForbiddenException` if inaccessible (`IsPrivate && OwnerId != userId` or in another user's private location).
     - Validates that if `request.IsExternalLoan == true` and `string.IsNullOrWhiteSpace(request.BorrowerName)`, throws `ArgumentException("Borrower name is required for external loans.")`.
     - **Permanent Home Invariant:** Never modifies `item.HomeLocationId`!
     - Sets `item.Status = request.IsExternalLoan ? ItemStatus.LoanedOut : ItemStatus.InUse`, `item.CheckedOutByUserId = userId`, `item.CheckedOutByUsername = username`, `item.CheckedOutToBorrower = request.IsExternalLoan ? request.BorrowerName?.Trim() : null`, `item.CheckedOutBorrowerContact = request.IsExternalLoan ? request.BorrowerContact?.Trim() : null`, `item.CheckoutNote = request.ProjectOrNote?.Trim()`, `item.CheckedOutAt = now`, `item.CheckoutDueAt = request.ExpectedReturnAt`, `item.LastTouchedAt = now`.
     - Appends a `CheckoutLog` record (`CheckOutInUse` or `LoanOutExternal`).
     - **Kit Cascade Checkout (PRD 4.2.1 #3):** If `item.ItemType == ItemType.Kit`, iterates over accessible `item.ChildItems` that are currently `ItemStatus.InPlace`, sets them to the same checkout status (`InUse` or `LoanedOut`), populates their checkout metadata (with note `$"Kit: {item.Name}"` if no note was provided), and writes a `CheckoutLog` entry for each child item!
     - Saves changes and returns `await itemService.GetItemByIdAsync(userId, itemId, cancellationToken)`.
   - **`ReturnItemAsync(userId, itemId, request)`:**
     - Loads `InventoryItem` with `Include(i => i.ChildItems)`.
     - Returns `null` if not found; throws `ForbiddenException` if inaccessible.
     - If `request.QuantityUsed.HasValue && request.QuantityUsed.Value > 0 && item.ItemType == ItemType.Quantity`:
       - Deducts `item.CurrentQuantity = Math.Max(0, item.CurrentQuantity - request.QuantityUsed.Value)`.
     - If `request.UpdatedCondition.HasValue`: updates `item.Condition = request.UpdatedCondition.Value`.
     - Transitions `item.Status = ItemStatus.InPlace` and clears `CheckedOutByUserId`, `CheckedOutByUsername`, `CheckedOutToBorrower`, `CheckedOutBorrowerContact`, `CheckoutNote`, `CheckedOutAt`, `CheckoutDueAt`, `ActiveLoadoutId`, `ActiveLoadoutName`, and updates `item.LastTouchedAt = now`.
     - Also finds any active `CheckoutLog` for `itemId` where `ReturnedAt == null` and sets `ReturnedAt = now`, plus appends a `CheckoutLog` with `ActionType = CheckoutActionType.ReturnToHome`, `QuantityConsumed = request.QuantityUsed`, and `ProjectOrNote = request.ReturnNote`.
     - **Kit Cascade Return:** If `item.ItemType == ItemType.Kit`, automatically returns all accessible `item.ChildItems` that are `InUse` or `LoanedOut` back to `ItemStatus.InPlace` (clearing their checkout metadata and logging their return).
     - Saves changes and returns `await itemService.GetItemByIdAsync(userId, itemId, cancellationToken)`.
   - **`BatchCheckoutItemsAsync` & `BatchReturnItemsAsync`:**
     - Loops through the requested item IDs, calling `CheckoutItemAsync` / `ReturnItemAsync` for each accessible item, and returns `BatchCheckoutResultDto`.
   - **`GetActiveCheckoutsAsync`:**
     - Queries items where `Status == ItemStatus.InUse || Status == ItemStatus.LoanedOut`, filters by `IsItemAccessible`, applies optional `externalLoansOnly` and `overdueOnly` filters, and returns mapped `ItemDto`s ordered by `CheckoutDueAt ?? CheckedOutAt`.
   - **`GetItemCheckoutHistoryAsync`:**
     - Verifies the item exists and is accessible to `userId` (throws `NotFoundException` if missing, `ForbiddenException` if private to another user), then returns `CheckoutLogDto` records for `ItemId == itemId` ordered by `OccurredAt` descending.

3. **Create `WhereHouse.Data/Services/LoadoutService.cs` (`ILoadoutService`):**
   - Injects `WhereHouseDbContext` and `ICheckoutService`.
   - **Privacy Invariant:** A `Loadout` with `IsPrivate == true` is visible/modifiable **only** when `loadout.OwnerId == userId`. Furthermore, any `LoadoutItem` referencing another user's private `InventoryItem` is excluded/rejected with `ForbiddenException`.
   - **Pre-Flight Check & Room-by-Room Pick List Builder (`MapLoadoutToDto`):**
     - For each `LoadoutItem` (with `Item` and `Item.HomeLocation` loaded):
       - Checks Pre-Flight Warnings (when `loadout.Status == LoadoutStatus.Ready` or when evaluating readiness):
         1. If `item.Condition == ItemCondition.Broken`: warning `"Item is marked Broken"`.
         2. Else if `item.Status == ItemStatus.LoanedOut`: warning `$"Loaned out to {item.CheckedOutToBorrower ?? "borrower"}"`.
         3. Else if `item.Status == ItemStatus.InUse && item.ActiveLoadoutId != loadout.Id`: warning `$"Already in use ({item.CheckoutNote ?? item.CheckedOutByUsername ?? "active"})"`.
         4. Else if `item.Status == ItemStatus.Archived`: warning `"Item is Archived"`.
         5. Else if `item.ItemType == ItemType.Quantity && item.CurrentQuantity < li.RequiredQuantity && !li.IsCurrentlyCheckedOut`: warning `$"Insufficient stock: {item.CurrentQuantity} available, {li.RequiredQuantity} required"`.
       - Resolves `HomeLocationFullPath` (e.g., `"Garage > West Rack > Shelf 2 > BIN-014"`) and visual container metadata (`ContainerStyle`, `PrimaryColor`, `AccentColor`, `ColorLabel`).
     - Groups `LoadoutItemDto`s by `HomeLocationId` and orders groups by `LocationFullPath` to build `PickListStops` (`LoadoutPickListStopDto`), so the user walks room-by-room and opens each bin once!
   - **`CheckoutLoadoutAsync(userId, id, request)`:**
     - Verifies Loadout exists and is accessible.
     - For each `LoadoutItem` whose `InventoryItem` is accessible, not `Broken`, and not `Archived`:
       - Marks `li.IsCurrentlyCheckedOut = true`, `li.QuantityCheckedOut = li.RequiredQuantity`, `li.QuantityUsed = 0`, `li.QuantityReturned = 0`, `li.CheckedOutAt = now`, `li.ReturnedAt = null`.
       - Updates `item.Status = ItemStatus.InUse`, `item.CheckedOutByUserId = userId`, `item.CheckedOutByUsername = username`, `item.CheckoutNote = string.IsNullOrWhiteSpace(request.CheckoutNote) ? $"Loadout: {loadout.Name}" : $"{loadout.Name} — {request.CheckoutNote.Trim()}"`, `item.CheckedOutAt = now`, `item.ActiveLoadoutId = loadout.Id`, `item.ActiveLoadoutName = loadout.Name`, `item.LastTouchedAt = now`.
       - Appends a `CheckoutLog` entry linking `LoadoutId = loadout.Id` and `LoadoutName = loadout.Name`.
       - If `item.ItemType == ItemType.Kit`, also cascades `InUse` to accessible `InPlace` child items of that kit.
     - Sets `loadout.Status = LoadoutStatus.ActiveCheckout`, `loadout.LastCheckedOutAt = now`, `loadout.ActiveCheckoutNote = request.CheckoutNote?.Trim()`.
     - Saves and returns updated `LoadoutDto`.
   - **`PackBackLoadoutAsync(userId, id, request)`:**
     - Processes each `PackBackLoadoutItemEntry` in `request.Items`:
       - Finds matching `LoadoutItem` (`li`) and its `InventoryItem` (`item`).
       - If `entry.IsReturned`:
         - Records `li.QuantityUsed = Math.Max(0, entry.QuantityUsed)`.
         - Records `li.QuantityReturned = entry.QuantityReturned ?? Math.Max(0, li.QuantityCheckedOut - li.QuantityUsed)`.
         - Marks `li.IsCurrentlyCheckedOut = false`, `li.ReturnedAt = now`.
         - **Consumable Deduction (PRD 4.5.2 #5):** If `(li.IsConsumable || item.ItemType == ItemType.Quantity) && li.QuantityUsed > 0`, deducts `item.CurrentQuantity = Math.Max(0, item.CurrentQuantity - li.QuantityUsed)`.
         - Returns `item.Status = ItemStatus.InPlace`, clears `item.CheckedOutByUserId`, `CheckedOutByUsername`, `CheckedOutToBorrower`, `CheckedOutBorrowerContact`, `CheckoutNote`, `CheckedOutAt`, `CheckoutDueAt`, `ActiveLoadoutId`, `ActiveLoadoutName`, and updates `item.LastTouchedAt = now`.
         - Appends a `CheckoutLog` (`ReturnToHome`, `QuantityConsumed = li.QuantityUsed > 0 ? li.QuantityUsed : null`, `LoadoutId = loadout.Id`, `LoadoutName = loadout.Name`).
         - If `item.ItemType == ItemType.Kit`, also returns its checked-out child items to `InPlace`.
       - If `!entry.IsReturned`:
         - Leaves `li.IsCurrentlyCheckedOut = true` and leaves `item.Status = ItemStatus.InUse` so the unreturned item stays flagged as *Out of Place*!
     - If all items in `loadout.Items` now have `IsCurrentlyCheckedOut == false`, transitions `loadout.Status = LoadoutStatus.Ready`, `loadout.LastReturnedAt = now`, `loadout.ActiveCheckoutNote = null`.
     - Saves and returns updated `LoadoutDto`.

4. **Register Services in `WhereHouse.Data/DataServiceCollectionExtensions.cs`:**
   - `services.AddScoped<ICheckoutService, CheckoutService>();`
   - `services.AddScoped<ILoadoutService, LoadoutService>();`

---

## 3. API Endpoints (`WhereHouse.API/Controllers/`)

### 3.1 `WhereHouse.API/Controllers/CheckoutsController.cs` (`[Route("checkouts")]`)

| Verb | Route (`/api/...`) | Request Body / Query | Response (`200`) | Error Cases (`400`/`403`/`404`) |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/checkouts/active` | `?externalLoansOnly=bool&overdueOnly=bool` | `200 OK` $\rightarrow$ `IReadOnlyList<ItemDto>` | `401 Unauthorized` |
| `GET` | `/checkouts/items/{itemId:guid}/history` | — | `200 OK` $\rightarrow$ `IReadOnlyList<CheckoutLogDto>` | `403`, `404` |
| `POST` | `/checkouts/items/{itemId:guid}/checkout` | `CheckoutItemRequest` | `200 OK` $\rightarrow$ `ItemDto` | `400`, `403`, `404` |
| `POST` | `/checkouts/items/{itemId:guid}/return` | `ReturnItemRequest` | `200 OK` $\rightarrow$ `ItemDto` | `400`, `403`, `404` |
| `POST` | `/checkouts/batch-checkout` | `BatchCheckoutRequest` | `200 OK` $\rightarrow$ `BatchCheckoutResultDto` | `400`, `403` |
| `POST` | `/checkouts/batch-return` | `BatchReturnRequest` | `200 OK` $\rightarrow$ `BatchCheckoutResultDto` | `400`, `403` |

### 3.2 `WhereHouse.API/Controllers/LoadoutsController.cs` (`[Route("loadouts")]`)

| Verb | Route (`/api/...`) | Request Body / Query | Response (`200`/`201`/`204`) | Error Cases (`400`/`403`/`404`) |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/loadouts` | — | `200 OK` $\rightarrow$ `IReadOnlyList<LoadoutDto>` | `401 Unauthorized` |
| `GET` | `/loadouts/{id:guid}` | — | `200 OK` $\rightarrow$ `LoadoutDto` | `403`, `404` |
| `POST` | `/loadouts` | `CreateLoadoutRequest` | `201 Created` $\rightarrow$ `LoadoutDto` | `400`, `403`, `404` |
| `PUT` | `/loadouts/{id:guid}` | `UpdateLoadoutRequest` | `200 OK` $\rightarrow$ `LoadoutDto` | `400`, `403`, `404` |
| `DELETE` | `/loadouts/{id:guid}` | — | `204 No Content` | `403`, `404` |
| `POST` | `/loadouts/{id:guid}/checkout` | `CheckoutLoadoutRequest` | `200 OK` $\rightarrow$ `LoadoutDto` | `400`, `403`, `404` |
| `POST` | `/loadouts/{id:guid}/pack-back` | `PackBackLoadoutRequest` | `200 OK` $\rightarrow$ `LoadoutDto` | `400`, `403`, `404` |

---

## 4. Angular Frontend Design (`WhereHouse.Client`)

### 4.1 TypeScript Models & Services (`src/app/core/`)

1. **Update `src/app/core/models/item.models.ts`:**
   - Add optional active checkout fields to `ItemDto`:
     ```typescript
     checkedOutByUserId?: string | null;
     checkedOutByUsername?: string | null;
     checkedOutToBorrower?: string | null;
     checkedOutBorrowerContact?: string | null;
     checkoutNote?: string | null;
     checkedOutAt?: string | null;
     checkoutDueAt?: string | null;
     isOverdueLoan?: boolean;
     activeLoadoutId?: string | null;
     activeLoadoutName?: string | null;
     ```
2. **Create `src/app/core/models/checkout-loadout.models.ts`:**
   - Constants and types for `CheckoutActionTypes` (`CheckOutInUse = 0`, `LoanOutExternal = 1`, `ReturnToHome = 2`) and `LoadoutStatuses` (`Ready = 0`, `ActiveCheckout = 1`).
   - Interfaces for `CheckoutLogDto`, `CheckoutItemRequest`, `ReturnItemRequest`, `BatchCheckoutRequest`, `BatchReturnItemEntry`, `BatchReturnRequest`, `BatchCheckoutResultDto`, `LoadoutItemDto`, `LoadoutPickListStopDto`, `LoadoutDto`, `UpsertLoadoutItemRequest`, `CreateLoadoutRequest`, `UpdateLoadoutRequest`, `CheckoutLoadoutRequest`, `PackBackLoadoutItemEntry`, and `PackBackLoadoutRequest`.
3. **Create `src/app/core/services/checkout-loadout/checkout-loadout.service.ts` (& `.spec.ts`):**
   - Decorated with `@Service()`, injecting `HttpClient` and using `apiUrl(...)`.
   - Also holds reactive **Ad-Hoc Project Cart** signal state (`cartItems = signal<ItemDto[]>([])`, `addToCart(item: ItemDto)`, `removeFromCart(itemId: string)`, `clearCart()`, `isInCart(itemId: string): boolean`) so any component (Dashboard, Smart Search, Scanner) can add/remove items to the Project Cart seamlessly!
   - HTTP Methods:
     - `getActiveCheckouts(params?: { externalLoansOnly?: boolean; overdueOnly?: boolean }): Observable<ItemDto[]>`
     - `getItemCheckoutHistory(itemId: string): Observable<CheckoutLogDto[]>`
     - `checkoutItem(itemId: string, request: CheckoutItemRequest): Observable<ItemDto>`
     - `returnItem(itemId: string, request: ReturnItemRequest): Observable<ItemDto>`
     - `batchCheckout(request: BatchCheckoutRequest): Observable<BatchCheckoutResultDto>`
     - `batchReturn(request: BatchReturnRequest): Observable<BatchCheckoutResultDto>`
     - `getLoadouts(): Observable<LoadoutDto[]>`
     - `getLoadoutById(id: string): Observable<LoadoutDto>`
     - `createLoadout(request: CreateLoadoutRequest): Observable<LoadoutDto>`
     - `updateLoadout(id: string, request: UpdateLoadoutRequest): Observable<LoadoutDto>`
     - `deleteLoadout(id: string): Observable<void>`
     - `checkoutLoadout(id: string, request: CheckoutLoadoutRequest): Observable<LoadoutDto>`
     - `packBackLoadout(id: string, request: PackBackLoadoutRequest): Observable<LoadoutDto>`

### 4.2 Feature Dialogs & Dashboard Enhancements (`src/app/features/dashboard/`)

1. **Create `CheckoutReturnDialogComponent` (`src/app/features/dashboard/checkout-return-dialog/checkout-return-dialog.component.ts` & `.spec.ts`):**
   - Supports two modes passed via `MAT_DIALOG_DATA: { item: ItemDto; mode: 'checkout' | 'return' | 'history' }`:
     - **Checkout Mode (`mode === 'checkout'`):**
       - Toggle between **"Grab for Household Project (`In Use`)"** (`handyman`) and **"Loan to External Person (`Loaned Out`)"** (`person_Remove` / `share`).
       - Project / Usage Note input (e.g., `"Kitchen Remodel"`).
       - When External Loan is selected: required **Borrower Name** input, optional **Contact Info**, and **Expected Return / Due Date** picker with quick preset chips (`+3 Days`, `+1 Week`, `+2 Weeks`, `+1 Month`).
       - If `item.itemType === ItemTypes.Kit`, displays a banner noting that all `In Place` kit member items will automatically be checked out together.
     - **Return Mode (`mode === 'return'`):**
       - Displays the item's canonical **Home Location (`homeLocationFullPath`)** so the user knows exactly which room, shelf, and bin to put it back into!
       - If `item.itemType === ItemTypes.Quantity`, displays a **"Quantity Consumed / Used During Project"** input (`0` by default) to deduct consumed stock upon return.
       - Optional Return Note and Condition update selector (`Good`, `Fair`, `Broken`).
     - **History Tab / Section:**
       - Displays recent `CheckoutLogDto` entries for the item (`OccurredAt`, `ActionType`, `PerformedByUsername`, `BorrowerName`, `ProjectOrNote`, `ReturnedAt`).

2. **Create `LoadoutsDialogComponent` (`src/app/features/dashboard/loadouts-dialog/loadouts-dialog.component.ts` & `.spec.ts`):**
   - Accepts `MAT_DIALOG_DATA: { availableItems: ItemDto[]; availableLocations: LocationNodeDto[]; initialTab?: 'loadouts' | 'active' | 'cart' }`.
   - **Tab 1: Reusable Loadouts (`backpack`):**
     - Left/Top list of saved Loadouts with status badges (`Ready` vs `Active Checkout`), item counts, and Pre-Flight Warning counts + **"New Loadout"** button.
     - Loadout Detail & Builder View:
       - Edit Name, Description, Icon, `IsPrivate` toggle, and add/remove items with `RequiredQuantity` and **`IsConsumable` toggle** (*Returnable Multiple* vs *Consumable*).
       - **Pre-Flight Check Alert Banner:** Highlights any `Broken`, `Loaned Out`, `In Use`, or `Insufficient Stock` items in the Loadout.
       - **Optimized Room-by-Room Pick List (`PickListStops`):** Groups required items by Bin/Location with visual container color swatches (`PrimaryColor`/`AccentColor` + `ContainerStyle`) so the user can pull everything bin-by-bin.
       - **"Check Out Loadout"** button (when `Status === Ready`): prompts for an optional trip/project note and checks out all available items in the Loadout.
       - **Pack-Back & Consumable Reconciliation Panel** (when `Status === ActiveCheckout`):
         - Quick QR / Barcode / ShortCode scan input to check off items as they are placed back into their home bins.
         - Checklist of Loadout items showing canonical `HomeLocationFullPath`.
         - For **Consumable / Quantity items** (`isConsumable` or `Quantity` type): inline **`Used: [ 0 ] / Returned: [ N ]`** stepper with 1-tap **"Used All"** and **"Returned All"** buttons!
         - **"Complete Pack-Back"** button calling `packBackLoadout()`.
   - **Tab 2: Active Checkouts & Loans (`outbox`):**
     - Lists all currently `InUse` and `LoanedOut` items across the household, with filter chips (`All Active`, `Household In-Use`, `External Loans`, `Overdue Loans`) and 1-tap **"Return to Home Bin"** action.
   - **Tab 3: Ad-Hoc Project Cart (`shopping_cart_checkout`):**
     - Displays items added via `checkoutLoadoutService.cartItems()`, grouped into an instant **Room-by-Room Pick List**.
     - Project Note input + **"Batch Check Out Cart"** button (`batchCheckout()`), **"Save Cart as Reusable Loadout"** button, and **"Clear Cart"** button.

3. **Update `ScannerDialogComponent` (`src/app/features/dashboard/scanner-dialog/scanner-dialog.component.ts` & `.spec.ts`):**
   - When an **Item** is scanned in X-Ray / Quick-Action view:
     - If `item.status === ItemStatuses.InPlace`: show a prominent **"Grab / Check Out Item"** button (`outbox`) that immediately checks out the item (or opens `CheckoutReturnDialogComponent`)!
     - If `item.status === ItemStatuses.InUse || item.status === ItemStatuses.LoanedOut`: show a prominent **"Return to Home Bin (`{{ item.homeLocationShortCode }}`)"** button (`move_to_inbox`) that calls `checkoutLoadoutService.returnItem()` in 1 tap!
   - When a **Container / Location** is scanned in X-Ray view (`LocationItems`):
     - Each item row in the X-Ray list shows its checkout badge if `InUse` / `LoanedOut` and a 1-tap `Grab` (when `InPlace`) or `Return` (when `InUse`/`LoanedOut`) action button!

4. **Update `DashboardComponent` (`dashboard.component.ts`, `.html`, `.scss`, `.spec.ts`):**
   - Add **"Loadouts & Loans" (`backpack`)** button and **"Project Cart" (`shopping_cart`)** badge button in the top navigation bar.
   - On item cards in `dashboard.component.html`:
     - Display a high-visibility **Checkout / Loan Status Banner** when `item.status === ItemStatuses.InUse` or `ItemStatuses.LoanedOut` (showing `CheckedOutByUsername` / `CheckedOutToBorrower`, `CheckoutNote` / `ActiveLoadoutName`, `CheckoutDueAt`, and `OVERDUE` badge if `item.isOverdueLoan`), while keeping the card visible in its Home Location (`dimmed-checked-out` styling per PRD 4.5.1).
     - Add 1-tap **"Check Out / Loan..." (`outbox`)**, **"Return to Home Bin" (`move_to_inbox`)**, and **"Add to Project Cart" (`add_shopping_cart`)** actions to the item card action bar / overflow menu.

---

## 5. Step-by-Step Execution Checklist (For Implementation Agent)

- [x] **Task 1: Backend Core & Data Layer (`WhereHouse.Core` & `WhereHouse.Data`)**
  - Update `WhereHouse.Core/Items/ItemModels.cs` (`ItemDto`) with optional active checkout fields.
  - Create `WhereHouse.Core/Checkouts/CheckoutModels.cs` and `WhereHouse.Core/Checkouts/ICheckoutService.cs`.
  - Create `WhereHouse.Core/Loadouts/LoadoutModels.cs` and `WhereHouse.Core/Loadouts/ILoadoutService.cs`.
  - Update `WhereHouse.Data/Entities/InventoryItem.cs`, `WhereHouse.Data/Configurations/InventoryItemConfiguration.cs`, and `WhereHouse.Data/Entities/User.cs`.
  - Create `WhereHouse.Data/Entities/CheckoutLog.cs`, `WhereHouse.Data/Configurations/CheckoutLogConfiguration.cs`, `WhereHouse.Data/Entities/Loadout.cs`, `WhereHouse.Data/Configurations/LoadoutConfiguration.cs`, `WhereHouse.Data/Entities/LoadoutItem.cs`, and `WhereHouse.Data/Configurations/LoadoutItemConfiguration.cs`.
  - Update `WhereHouse.Data/WhereHouseDbContext.cs` with `CheckoutLogs`, `Loadouts`, and `LoadoutItems` `DbSet`s.
  - Update `WhereHouse.Data/Services/ItemService.cs` and `WhereHouse.Data/Services/SearchService.cs` to map active checkout fields and clean up `LoadoutItems` on item deletion.
  - Implement `WhereHouse.Data/Services/CheckoutService.cs` and `WhereHouse.Data/Services/LoadoutService.cs`, and register both in `WhereHouse.Data/DataServiceCollectionExtensions.cs`.
  - Ensure local SQL Server is running, then generate, apply, and format the EF Core migration:
    ```powershell
    .\scripts\ensure-local-infra.ps1
    dotnet ef migrations add AddCheckoutsAndLoadouts --project WhereHouse.Data --startup-project WhereHouse.API
    dotnet ef database update --project WhereHouse.Data --startup-project WhereHouse.API
    dotnet csharpier format WhereHouse.Data/Migrations
    ```
  - Run unit tests in `Tests/WhereHouse.Core.UnitTests`:
    ```powershell
    dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj
    ```

- [x] **Task 2: API Controllers & Integration Tests (`WhereHouse.API` & `Tests/WhereHouse.API.IntegrationTests`)**
  - Create `WhereHouse.API/Controllers/CheckoutsController.cs` and `WhereHouse.API/Controllers/LoadoutsController.cs`.
  - Update `Tests/WhereHouse.API.IntegrationTests/OpenApiIntegrationTests.cs` to assert `"/checkouts"` and `"/loadouts"`.
  - Create `Tests/WhereHouse.API.IntegrationTests/CheckoutsAndLoadoutsIntegrationTests.cs` covering:
    1. **Single Item Check-Out, External Loan & Return:** Checking an item out (`InUse` and `LoanedOut` with due date), verifying `HomeLocationId` is preserved while checkout metadata & `IsOverdueLoan` populate, returning the item to `InPlace`, and verifying `GET /api/checkouts/items/{id}/history`.
    2. **Kit Cascade Checkout & Return (PRD 4.2.1 #3):** Checking out a `Kit` item automatically checks out its `InPlace` child items; returning the `Kit` returns its child items to `InPlace`.
    3. **Batch Checkout & Batch Return (Project Cart):** Checking out multiple items together via `POST /api/checkouts/batch-checkout` and returning them via `POST /api/checkouts/batch-return` with consumable quantity deduction.
    4. **Reusable Loadouts, Pre-Flight Check, Room-by-Room Pick List & Consumable Pack-Back:** Creating a Loadout with returnable and consumable (`IsConsumable: true`) items across multiple bins, verifying `PickListStops` grouping and Pre-Flight Check warnings, checking out the Loadout (`POST /api/loadouts/{id}/checkout`), and executing Pack-Back (`POST /api/loadouts/{id}/pack-back`) with `QuantityUsed` deducting from the home bin's `CurrentQuantity` and leaving unreturned items `InUse`.
    5. **"Secret / Gift Mode" (`IsPrivate`) Isolation:** Verifying User B cannot view, check out, or include User A's private items or private loadouts (`403 Forbidden` / omitted from `GET /api/checkouts/active` and `GET /api/loadouts`).
  - Run integration tests until 100% green:
    ```powershell
    dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj
    ```

- [x] **Task 3: Angular Client & Unit Tests (`WhereHouse.Client`)**
  - Update `src/app/core/models/item.models.ts` and create `src/app/core/models/checkout-loadout.models.ts`.
  - Create `CheckoutLoadoutService` (`src/app/core/services/checkout-loadout/checkout-loadout.service.ts` & `.spec.ts`).
  - Create `CheckoutReturnDialogComponent` (`src/app/features/dashboard/checkout-return-dialog/checkout-return-dialog.component.ts` & `.spec.ts`).
  - Create `LoadoutsDialogComponent` (`src/app/features/dashboard/loadouts-dialog/loadouts-dialog.component.ts` & `.spec.ts`).
  - Update `ScannerDialogComponent` (`scanner-dialog.component.ts` & `.spec.ts`) with 1-tap `Grab Item` and `Return to Home Bin` actions.
  - Update `DashboardComponent` (`.ts`, `.html`, `.scss`, `.spec.ts`) with Checkout/Loan status badges on item cards, 1-tap Check Out / Return / Add to Project Cart actions, and top-bar Loadouts & Project Cart triggers.
  - Run frontend lint, build, and unit tests in `WhereHouse.Client` until 100% green:
    ```powershell
    npm run lint
    npm run build
    npm test -- --watch=false
    ```

- [x] **Task 4: E2E Verification & Final Formatting**
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
  - Update `docs/plans/phase-06-checkouts-loadouts-and-project-cart.md` status to `[x] Completed`.
