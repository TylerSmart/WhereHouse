# Phase 04: QR Code Registry, Pre-Printed Blank QR Binding, X-Ray Scanner & Label Sheet Generator

> **Branch:** `feature/phase-04-qr-labels-and-scanner`
> **Status:** Planned (`[ ]` Not Started | `[~]` In Progress | `[x]` Completed)
> **PRD Reference:** `docs/prd.md` — Sections 4.3.1 (`Identifiers & QR Encoding`), 4.3.2 (`Pre-Printed "Blank QR" Sticker Binding`), 4.3.3 (`Built-In Label Sheet Generator`), 4.3.4 (`Camera Scanning Modes: Scan-to-View X-Ray & Scan-to-Audit Bulk Move`), and 4.8.2 (`"Secret / Gift Mode" Privacy`)
> **Target Execution:** Run `/execute-phase` with your implementation model to execute this plan step-by-step.

---

## 1. Scope & Objectives

This phase begins **Milestone 2 (Camera & Physical Labeling)** by delivering the complete **QR Code & Label Printing System** and **Camera / Deep-Link Scanning Engine**:

1. **QR Code Registry & Pre-Printed "Blank QR" Sticker Binding (`QrCode` & `IQrCodeService`):**
   - Users can generate batches of **Unassigned ("Blank") QR Codes** (`QR-0001`, `QR-0002`, ...) ahead of time to print on sticker sheets and keep in a garage drawer (`POST /api/qrcodes/batch`).
   - Slapping an unassigned QR sticker onto a physical tote or tool and scanning it prompts the user to **Bind** that QR token to a new or existing `LocationNode` (`FixedLocation` / `MovableContainer`) or `InventoryItem` (`POST /api/qrcodes/{token}/bind`), or **Unbind** it later (`POST /api/qrcodes/{token}/unbind`).
   - Deleting a `LocationNode` or `InventoryItem` automatically unbinds any linked `QrCode` records back to `Unassigned` so physical stickers can be reused.
2. **Unified Scan Resolution & "X-Ray Vision" Bin Inspection (`IScanService` & `GET /api/scan/{code}`):**
   - Accepts any scanned string—whether a full deep-link URL (`https://wherehouse.yourdomain.lan/scan/BIN-042`), a canonical short code (`LOC-001`, `BIN-042`, `ITM-1049`), or a pre-printed QR token (`QR-0001`).
   - **Scan-to-View ("X-Ray Vision"):** Scanning a container or location immediately returns its full visual profile (`ContainerStyle`, `PrimaryColor`, `AccentColor`, `ColorLabel`, `FullPath`), its immediate sub-containers (`ChildLocations`), and a complete checklist of every item inside (`LocationItems`, including checkout status, quantity, low-stock alerts, and incomplete kit warnings) without opening the physical lid.
   - **Unassigned QR Detection:** Scanning an unbound `QR-xxxx` token returns `ResolutionType = ScanResolutionType.UnassignedQr`, triggering the 1-tap **"Bind Sticker to Container or Item"** workflow in the UI.
   - **"Secret / Gift Mode" (`IsPrivate`) Opaque Protection:** If a non-owner scans a private container, a child inside a private ancestor, or a private item, `GET /api/scan/{code}` returns `200 OK` with `ResolutionType = ScanResolutionType.PrivateRestricted` and an opaque restricted notice—never leaking the entity's name, description, or contents (satisfying PRD Section 4.8.2).
3. **Scan-to-Audit / Bulk Move Mode (`POST /api/scan/bulk-move-audit`):**
   - Locks a **Destination Location/Shelf** (`DestinationLocationId`) and processes a batch or continuous stream of scanned codes (`BIN-xxx`, `ITM-xxx`, or bound `QR-xxxx`).
   - Moves each scanned Movable Container (`ParentId = DestinationLocationId`, with cycle prevention) or Item (`HomeLocationId = DestinationLocationId`) into the destination and stamps `LastTouchedAt` / `LastScannedAt` (`Audited / Verified Present`). Items already housed in the destination have their `LastTouchedAt` audit timestamp refreshed (`AuditedPresent`).
4. **Built-In Label Sheet & Thermal Roll Generator (`LabelGeneratorDialogComponent`):**
   - Browser-native printable label sheet builder with deterministic SVG QR code rendering:
     - **Avery Multi-Label Sheet Presets:** `Avery 5160` (30-up, $2.625" \times 1"$), `Avery 5163` (10-up, $4" \times 2"$), and `Avery 22806` (12-up square, $2" \times 2"$) with a **"Start at Row / Column" offset selector** so partially used sticker sheets are never wasted.
     - **Thermal Printer Roll Presets:** `2" x 1"`, `2.25" x 1.25"`, and `4" x 6"` for Brother, Dymo, Rollo, and Zebra thermal printers.
     - Supports printing labels for selected existing Locations/Containers/Items **or** generating & printing a fresh batch of Pre-Printed Blank QR Stickers (`QR-xxxx`) in one click.
5. **Camera Scanner Modal & Deep-Link Route (`/scan/:code`):**
   - `ScannerDialogComponent` supporting live camera scanning (`navigator.mediaDevices.getUserMedia` + `BarcodeDetector` where supported) and instant keyboard/USB wedge/manual code entry, with tabs for **X-Ray Scan-to-View** (including inline **Bind Unassigned QR**) and **Scan-to-Audit / Bulk Move**.
   - Direct route `/scan/:code` in Angular that opens the Dashboard and automatically launches `ScannerDialogComponent` for the scanned code.

### Explicitly Out of Scope for Phase 04 (Deferred to Phase 05+)
- Rapid-Fire Batch Intake mode (`4.4.1`), Retail UPC/EAN barcode product lookup (`4.3.4 #4`), and CSV/JSON Bulk Import/Export (`4.4.3`) $\rightarrow$ **Phase 05**.
- Full Check-In / Check-Out state machine, External Loans, Reusable Loadouts, and Graveyard Disposition workflows $\rightarrow$ **Milestone 3**.

---

## 2. Domain & Database Design (`WhereHouse.Core` & `WhereHouse.Data`)

### 2.1 Enums & Token Helpers (`WhereHouse.Core/QrCodes/QrAndScanModels.cs`)

Create `WhereHouse.Core/QrCodes/QrAndScanModels.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.Core.QrCodes;

public enum QrTargetType
{
    Unassigned = 0,
    LocationNode = 1,
    Item = 2,
}

public enum ScanResolutionType
{
    NotFound = 0,
    UnassignedQr = 1,
    LocationNode = 2,
    Item = 3,
    PrivateRestricted = 4,
}

public enum BulkAuditOutcomeType
{
    MovedContainer = 0,
    MovedItem = 1,
    AuditedPresent = 2,
    SkippedPrivate = 3,
    SkippedInvalidCycle = 4,
    UnassignedQr = 5,
    NotFound = 6,
}
```

Include a static helper `QrCodeTokenHelper` in `WhereHouse.Core/QrCodes/QrAndScanModels.cs`:
- `public const string DefaultPrefix = "QR";`
- `public static string ExtractCodeFromScanInput(string? rawInput)`:
  - If `string.IsNullOrWhiteSpace(rawInput)`, throws `ArgumentException`.
  - Trims whitespace. If the input contains `/scan/` (e.g., `https://wherehouse.yourdomain.lan/scan/BIN-042?foo=bar` or `/scan/QR-0001`), extracts the path segment immediately following `/scan/` up to the next `/`, `?`, or `#`, URL-decodes it (`Uri.UnescapeDataString`), trims, and converts to `.ToUpperInvariant()`.
  - Otherwise, trims and converts `rawInput` to `.ToUpperInvariant()`.
- `public static string GenerateNextBlankToken(IEnumerable<string> existingTokens, string prefix = DefaultPrefix)`:
  - Normalizes `prefix` (`string.IsNullOrWhiteSpace(prefix) ? DefaultPrefix : prefix.Trim().ToUpperInvariant()`).
  - Scans `existingTokens` matching `^{Regex.Escape(normalizedPrefix)}-(\d+)$` (case-insensitive), finds the maximum integer `maxNumber`, and returns $"{normalizedPrefix}-{(maxNumber + 1):D4}" (4-digit zero-padded, e.g., `QR-0001`, `QR-0002`).

### 2.2 Entities (`WhereHouse.Data/Entities/`)

1. **Create `WhereHouse.Data/Entities/QrCode.cs`:**
   ```csharp
   using WhereHouse.Core.QrCodes;

   namespace WhereHouse.Data.Entities;

   public sealed class QrCode : IAuditable
   {
       public Guid Id { get; set; } = Guid.NewGuid();

       public string Token { get; set; } = string.Empty;

       public QrTargetType TargetType { get; set; } = QrTargetType.Unassigned;

       public Guid? LocationNodeId { get; set; }

       public LocationNode? LocationNode { get; set; }

       public Guid? ItemId { get; set; }

       public InventoryItem? Item { get; set; }

       public string? LabelNote { get; set; }

       public int PrintedCount { get; set; }

       public DateTimeOffset? BoundAt { get; set; }

       public Guid? BoundByUserId { get; set; }

       public User? BoundByUser { get; set; }

       public DateTimeOffset? LastScannedAt { get; set; }

       public Guid CreatedByUserId { get; set; }

       public User CreatedByUser { get; set; } = null!;

       public DateTimeOffset CreatedAt { get; set; }

       public string CreatedBy { get; set; } = "System";

       public DateTimeOffset ModifiedAt { get; set; }

       public string ModifiedBy { get; set; } = "System";
   }
   ```

2. **Update `WhereHouse.Data/Entities/LocationNode.cs`:**
   - Add navigation collection:
     ```csharp
     public ICollection<QrCode> BoundQrCodes { get; set; } = new List<QrCode>();
     ```

3. **Update `WhereHouse.Data/Entities/InventoryItem.cs`:**
   - Add navigation collection:
     ```csharp
     public ICollection<QrCode> BoundQrCodes { get; set; } = new List<QrCode>();
     ```

4. **Update `WhereHouse.Data/Entities/User.cs`:**
   - Add navigation collections:
     ```csharp
     public ICollection<QrCode> CreatedQrCodes { get; set; } = new List<QrCode>();

     public ICollection<QrCode> BoundQrCodes { get; set; } = new List<QrCode>();
     ```

### 2.3 EF Core Fluent Configuration (`WhereHouse.Data/Configurations/QrCodeConfiguration.cs`)

1. **Create `WhereHouse.Data/Configurations/QrCodeConfiguration.cs`:**
   - Table name: `"QrCodes"`
   - Primary Key: `q => q.Id`
   - Properties:
     - `Token`: `.IsRequired().HasMaxLength(64)`
     - `LabelNote`: `.HasMaxLength(200)`
     - `CreatedBy`: `.IsRequired().HasMaxLength(256)`
     - `ModifiedBy`: `.IsRequired().HasMaxLength(256)`
   - Indexes:
     - `builder.HasIndex(q => q.Token).IsUnique();`
     - `builder.HasIndex(q => q.TargetType);`
     - `builder.HasIndex(q => q.LocationNodeId);`
     - `builder.HasIndex(q => q.ItemId);`
   - Relationships (**CRITICAL SQL Server Cascade Rule** — all four relationships MUST use `DeleteBehavior.Restrict` to prevent SQL Server error 1785 multiple cascade paths):
     - `builder.HasOne(q => q.LocationNode).WithMany(l => l.BoundQrCodes).HasForeignKey(q => q.LocationNodeId).OnDelete(DeleteBehavior.Restrict);`
     - `builder.HasOne(q => q.Item).WithMany(i => i.BoundQrCodes).HasForeignKey(q => q.ItemId).OnDelete(DeleteBehavior.Restrict);`
     - `builder.HasOne(q => q.CreatedByUser).WithMany(u => u.CreatedQrCodes).HasForeignKey(q => q.CreatedByUserId).OnDelete(DeleteBehavior.Restrict);`
     - `builder.HasOne(q => q.BoundByUser).WithMany(u => u.BoundQrCodes).HasForeignKey(q => q.BoundByUserId).OnDelete(DeleteBehavior.Restrict);`

2. **Update `WhereHouse.Data/WhereHouseDbContext.cs`:**
   - Add `public DbSet<QrCode> QrCodes => Set<QrCode>();`.

3. **Update `WhereHouse.Data/Services/LocationService.cs` & `WhereHouse.Data/Services/ItemService.cs`:**
   - In `LocationService.DeleteAsync`: before removing `node`, query `dbContext.QrCodes.Where(q => q.LocationNodeId == id)` and reset each to `TargetType = QrTargetType.Unassigned`, `LocationNodeId = null`, `BoundAt = null`, `BoundByUserId = null`.
   - In `ItemService.DeleteItemAsync`: before removing `item`, query `dbContext.QrCodes.Where(q => q.ItemId == id)` and reset each to `TargetType = QrTargetType.Unassigned`, `ItemId = null`, `BoundAt = null`, `BoundByUserId = null`.

### 2.4 DTOs, Requests & Service Contracts (`WhereHouse.Core/QrCodes/`)

1. **In `WhereHouse.Core/QrCodes/QrAndScanModels.cs`, define the DTOs and Requests:**
   ```csharp
   public sealed record QrCodeDto(
       Guid Id,
       string Token,
       QrTargetType TargetType,
       Guid? LocationNodeId,
       string? LocationNodeName,
       string? LocationNodeShortCode,
       string? LocationNodeFullPath,
       Guid? ItemId,
       string? ItemName,
       string? ItemShortCode,
       string? LabelNote,
       int PrintedCount,
       DateTimeOffset? BoundAt,
       DateTimeOffset? LastScannedAt,
       Guid CreatedByUserId,
       DateTimeOffset CreatedAt,
       DateTimeOffset ModifiedAt
   );

   public sealed record GenerateQrCodeBatchRequest(
       [Range(1, 200)] int Count = 10,
       [MaxLength(16)] string? Prefix = null,
       [MaxLength(200)] string? LabelNote = null
   );

   public sealed record BindQrCodeRequest(
       QrTargetType TargetType,
       Guid TargetId,
       [MaxLength(200)] string? LabelNote = null
   );

   public sealed record ScanResolutionDto(
       string ScannedCode,
       ScanResolutionType ResolutionType,
       string Message,
       QrCodeDto? QrCode = null,
       LocationNodeDto? Location = null,
       IReadOnlyList<LocationNodeDto>? ChildLocations = null,
       IReadOnlyList<ItemDto>? LocationItems = null,
       ItemDto? Item = null
   );

   public sealed record BulkScanAuditRequest(
       [Required] Guid DestinationLocationId,
       [Required, MinLength(1)] IReadOnlyList<string> ScannedCodes
   );

   public sealed record BulkScanAuditItemResultDto(
       string ScannedCode,
       BulkAuditOutcomeType Outcome,
       string Message,
       Guid? EntityId = null,
       string? EntityName = null,
       string? EntityShortCode = null
   );

   public sealed record BulkScanAuditResponseDto(
       Guid DestinationLocationId,
       string DestinationName,
       string DestinationShortCode,
       string DestinationFullPath,
       DateTimeOffset AuditedAt,
       int MovedCount,
       int AuditedPresentCount,
       int ErrorOrSkippedCount,
       IReadOnlyList<BulkScanAuditItemResultDto> Results
   );
   ```

2. **Create `WhereHouse.Core/QrCodes/IQrCodeService.cs`:**
   ```csharp
   namespace WhereHouse.Core.QrCodes;

   public interface IQrCodeService
   {
       Task<IReadOnlyList<QrCodeDto>> GetQrCodesAsync(
           Guid userId,
           QrTargetType? targetType = null,
           CancellationToken cancellationToken = default
       );

       Task<IReadOnlyList<QrCodeDto>> GenerateBatchAsync(
           Guid userId,
           GenerateQrCodeBatchRequest request,
           CancellationToken cancellationToken = default
       );

       Task<QrCodeDto> BindQrCodeAsync(
           Guid userId,
           string tokenOrInput,
           BindQrCodeRequest request,
           CancellationToken cancellationToken = default
       );

       Task<QrCodeDto> UnbindQrCodeAsync(
           Guid userId,
           string tokenOrInput,
           CancellationToken cancellationToken = default
       );

       Task<bool> DeleteQrCodeAsync(
           Guid userId,
           Guid id,
           CancellationToken cancellationToken = default
       );
   }
   ```

3. **Create `WhereHouse.Core/QrCodes/IScanService.cs`:**
   ```csharp
   namespace WhereHouse.Core.QrCodes;

   public interface IScanService
   {
       Task<ScanResolutionDto> ResolveScanAsync(
           Guid userId,
           string rawCodeOrUrl,
           CancellationToken cancellationToken = default
       );

       Task<BulkScanAuditResponseDto> ExecuteBulkMoveAuditAsync(
           Guid userId,
           BulkScanAuditRequest request,
           CancellationToken cancellationToken = default
       );
   }
   ```

### 2.5 Service Implementations & Business Invariants (`WhereHouse.Data/Services/`)

1. **Create `WhereHouse.Data/Services/QrCodeService.cs` (`IQrCodeService`):**
   - `GetQrCodesAsync(userId, targetType)`:
     - Loads `QrCodes` (`AsNoTracking()`) with `.Include(q => q.LocationNode)` and `.Include(q => q.Item)`.
     - **Privacy Filtering:** Filters out any `QrCode` bound to a `LocationNode` that is private (`IsPrivate && OwnerId != userId`) or inside a private ancestor location not owned by `userId`, and filters out any `QrCode` bound to an `InventoryItem` that is private (`IsPrivate && OwnerId != userId`) or housed in a private location not owned by `userId`.
     - If `targetType.HasValue`, filters by `q.TargetType == targetType.Value`.
     - Orders by `q.CreatedAt` descending (`ThenBy(q => q.Token)`).
   - `GenerateBatchAsync(userId, request)`:
     - Validates `request.Count` is between `1` and `200`.
     - Queries existing `QrCodes.Select(q => q.Token)` and existing `LocationNodes.Select(l => l.ShortCode)` / `InventoryItems.Select(i => i.ShortCode)`.
     - Loops `request.Count` times, generating sequential tokens via `QrCodeTokenHelper.GenerateNextBlankToken` (e.g., `QR-0001`, `QR-0002`, ...), creating `QrCode` entities with `TargetType = QrTargetType.Unassigned`, `LabelNote = request.LabelNote?.Trim()`, `PrintedCount = 1`, `CreatedByUserId = userId`.
     - Saves changes and returns the newly generated `IReadOnlyList<QrCodeDto>` in ascending token order.
   - `BindQrCodeAsync(userId, tokenOrInput, request)`:
     - Extracts normalized token via `QrCodeTokenHelper.ExtractCodeFromScanInput(tokenOrInput)`.
     - Rejects binding if `request.TargetType == QrTargetType.Unassigned` (throws `ArgumentException`).
     - Rejects if `normalizedToken` collides with an existing `LocationNode.ShortCode` or `InventoryItem.ShortCode` (throws `ConflictException("Cannot bind a canonical short code as a blank QR token.")`).
     - Looks up `QrCode` by `Token == normalizedToken`. If it does not exist yet (e.g., user scanned a custom pre-printed `QR-xxxx` sticker not yet in the DB), creates a new `QrCode` entity with `Token = normalizedToken` and `CreatedByUserId = userId`.
     - If the `QrCode` is already bound to a *different* entity (`TargetType != QrTargetType.Unassigned`), throws `ConflictException("This QR code is already bound. Unbind it first before reassigning.")`.
     - If `request.TargetType == QrTargetType.LocationNode`:
       - Loads target `LocationNode` (`request.TargetId`). If null $\rightarrow$ throws `NotFoundException`.
       - Checks privacy (`IsLocationAccessibleByUser`): if private and not owned by `userId` $\rightarrow$ throws `ForbiddenException`.
       - Sets `qr.TargetType = QrTargetType.LocationNode`, `qr.LocationNodeId = target.Id`, `qr.ItemId = null`, `qr.BoundAt = DateTimeOffset.UtcNow`, `qr.BoundByUserId = userId`.
     - If `request.TargetType == QrTargetType.Item`:
       - Loads target `InventoryItem` (`request.TargetId`). If null $\rightarrow$ throws `NotFoundException`.
       - Checks privacy (item `IsPrivate` or home location ancestor `IsPrivate` for non-owner): if inaccessible $\rightarrow$ throws `ForbiddenException`.
       - Sets `qr.TargetType = QrTargetType.Item`, `qr.ItemId = target.Id`, `qr.LocationNodeId = null`, `qr.BoundAt = DateTimeOffset.UtcNow`, `qr.BoundByUserId = userId`.
     - If `request.LabelNote is not null`, updates `qr.LabelNote`.
     - Saves and returns `QrCodeDto`.
   - `UnbindQrCodeAsync(userId, tokenOrInput)`:
     - Extracts normalized token via `QrCodeTokenHelper.ExtractCodeFromScanInput(tokenOrInput)`.
     - Finds `QrCode` by `Token == normalizedToken`. If null $\rightarrow$ throws `NotFoundException`.
     - Verifies the user has access to the currently bound location or item (throws `ForbiddenException` if bound to another user's private entity).
     - Resets `TargetType = QrTargetType.Unassigned`, `LocationNodeId = null`, `ItemId = null`, `BoundAt = null`, `BoundByUserId = null`.
     - Saves and returns `QrCodeDto`.
   - `DeleteQrCodeAsync(userId, id)`:
     - Finds `QrCode` by `Id`. If null $\rightarrow$ returns `false`.
     - Verifies access (throws `ForbiddenException` if bound to another user's private entity).
     - Removes `QrCode`, saves, and returns `true`.

2. **Create `WhereHouse.Data/Services/ScanService.cs` (`IScanService`):**
   - Injects `WhereHouseDbContext`, `ILocationService`, `IItemService`, and `IQrCodeService`.
   - `ResolveScanAsync(userId, rawCodeOrUrl)`:
     - Extracts `code = QrCodeTokenHelper.ExtractCodeFromScanInput(rawCodeOrUrl)`.
     - **Step 1 — Check `QrCodes` table by `Token == code`:**
       - If found:
         - Updates `qr.LastScannedAt = DateTimeOffset.UtcNow` and saves changes.
         - If `qr.TargetType == QrTargetType.Unassigned`:
           - Returns `ScanResolutionDto(code, ScanResolutionType.UnassignedQr, "Unassigned QR code scanned. Bind this sticker to a container, location, or item.", QrCode: qrDto)`.
         - If `qr.TargetType == QrTargetType.LocationNode && qr.LocationNodeId.HasValue`:
           - Resolves the target LocationNode via Step 2 below (attaching `QrCode: qrDto`).
         - If `qr.TargetType == QrTargetType.Item && qr.ItemId.HasValue`:
           - Resolves the target Item via Step 3 below (attaching `QrCode: qrDto`).
     - **Step 2 — Check `LocationNodes` by `ShortCode == code` (or by `LocationNodeId` from Step 1):**
       - If matching `LocationNode` exists:
         - Checks if the location or any of its ancestors is `IsPrivate && OwnerId != userId`.
         - **Opaque Restricted Notice (`PRD 4.8.2`):** If inaccessible due to privacy, returns:
           ```csharp
           new ScanResolutionDto(
               code,
               ScanResolutionType.PrivateRestricted,
               "Restricted: This location or container is marked Private by its owner."
           )
           ```
         - Otherwise, fetches:
           - `locationDto` via `locationService.GetByIdAsync(userId, loc.Id)`
           - `allVisibleLocations` via `locationService.GetAllAsync(userId)` $\rightarrow$ filters `ChildLocations = allVisibleLocations.Where(l => l.ParentId == loc.Id).ToList()`
           - `locationItems` via `itemService.GetItemsAsync(userId, locationId: loc.Id, includeSubtreeLocations: false)`
         - Returns `ScanResolutionDto(code, ScanResolutionType.LocationNode, $"Loaded X-Ray view for {locationDto.Name} ({locationDto.ShortCode}).", qrDto, locationDto, childLocations, locationItems, null)`.
     - **Step 3 — Check `InventoryItems` by `ShortCode == code` (or by `ItemId` from Step 1):**
       - If matching `InventoryItem` exists:
         - Attempts `itemService.GetItemByIdAsync(userId, item.Id)`.
         - If `ForbiddenException` is thrown (item or its home container is private to another user), catches it and returns:
           ```csharp
           new ScanResolutionDto(
               code,
               ScanResolutionType.PrivateRestricted,
               "Restricted: This item is marked Private by its owner."
           )
           ```
         - Otherwise, if `itemDto.HomeLocationId.HasValue`, also loads `homeLocationDto = await locationService.GetByIdAsync(userId, itemDto.HomeLocationId.Value)`.
         - Updates `item.LastTouchedAt = DateTimeOffset.UtcNow` in `dbContext` and saves.
         - Returns `ScanResolutionDto(code, ScanResolutionType.Item, $"Loaded item {itemDto.Name} ({itemDto.ShortCode}).", qrDto, homeLocationDto, null, null, itemDto)`.
     - **Step 4 — Auto-Recognize `QR-xxxx` Prefix as Unassigned Blank Sticker:**
       - If no DB record matched yet, and `code.StartsWith("QR-", StringComparison.OrdinalIgnoreCase)`:
         - Automatically creates a new unassigned `QrCode` record (`Token = code`, `TargetType = QrTargetType.Unassigned`, `CreatedByUserId = userId`, `LastScannedAt = DateTimeOffset.UtcNow`), saves it, and returns `ScanResolutionType.UnassignedQr`.
     - **Step 5 — Otherwise:**
       - Returns `ScanResolutionDto(code, ScanResolutionType.NotFound, $"No location, container, item, or QR sticker matched '{code}'.")`.

   - `ExecuteBulkMoveAuditAsync(userId, request)`:
     - Validates destination location via `locationService.GetByIdAsync(userId, request.DestinationLocationId)` (if null $\rightarrow$ throws `NotFoundException`; if private to another user $\rightarrow$ `ForbiddenException` propagates).
     - Iterates through `request.ScannedCodes`:
       - Extracts `code = QrCodeTokenHelper.ExtractCodeFromScanInput(raw)`.
       - Resolves whether `code` points to a bound `QrCode`, a `LocationNode` (`ShortCode == code`), or an `InventoryItem` (`ShortCode == code`).
       - If it points to a `LocationNode`:
         - If private and not owned by `userId` $\rightarrow$ adds `BulkScanAuditItemResultDto(code, BulkAuditOutcomeType.SkippedPrivate, "Skipped: Private location.")`.
         - If `loc.Id == request.DestinationLocationId` $\rightarrow$ adds `BulkScanAuditItemResultDto(code, BulkAuditOutcomeType.AuditedPresent, "Destination location verified.", loc.Id, loc.Name, loc.ShortCode)`.
         - If `loc.ParentId == request.DestinationLocationId` $\rightarrow$ adds `BulkScanAuditItemResultDto(code, BulkAuditOutcomeType.AuditedPresent, $"Container '{loc.Name}' confirmed in {dest.Name}.", loc.Id, loc.Name, loc.ShortCode)`.
         - Otherwise calls `locationService.MoveAsync(userId, loc.Id, new MoveLocationNodeRequest(request.DestinationLocationId))`:
           - If `ConflictException` (cycle detected) $\rightarrow$ adds `BulkAuditOutcomeType.SkippedInvalidCycle`.
           - Otherwise $\rightarrow$ increments `movedCount` and adds `BulkAuditOutcomeType.MovedContainer`.
       - If it points to an `InventoryItem`:
         - If private (or in a private location) and not owned by `userId` $\rightarrow$ adds `BulkAuditOutcomeType.SkippedPrivate`.
         - If `item.HomeLocationId == request.DestinationLocationId`:
           - Updates `item.LastTouchedAt = DateTimeOffset.UtcNow`, saves, increments `auditedPresentCount`, and adds `BulkAuditOutcomeType.AuditedPresent`.
         - Otherwise:
           - Updates `item.HomeLocationId = request.DestinationLocationId` and `item.LastTouchedAt = DateTimeOffset.UtcNow`, saves, increments `movedCount`, and adds `BulkAuditOutcomeType.MovedItem`.
       - If it points to an unassigned QR $\rightarrow$ adds `BulkAuditOutcomeType.UnassignedQr`.
       - If not found $\rightarrow$ adds `BulkAuditOutcomeType.NotFound`.
     - Returns `BulkScanAuditResponseDto`.

3. **Register Services in `WhereHouse.Data/DataServiceCollectionExtensions.cs`:**
   - `services.AddScoped<IQrCodeService, QrCodeService>();`
   - `services.AddScoped<IScanService, ScanService>();`

---

## 3. API Endpoints (`WhereHouse.API/Controllers/`)

### 3.1 `QrCodesController` (`WhereHouse.API/Controllers/QrCodesController.cs`)
- Attributes: `[ApiController]`, `[Route("qrcodes")]`, `[Authorize]`

| Verb | Route (`/api/...`) | Request Body / Query | Response (`200`/`201`/`204`) | Error Cases (`400`/`403`/`404`/`409`) |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/qrcodes` | `[FromQuery] QrTargetType? targetType = null` | `200 OK` (`IReadOnlyList<QrCodeDto>`) | `401` if unauthenticated |
| `POST` | `/qrcodes/batch` | `[FromBody] GenerateQrCodeBatchRequest` | `201 Created` (`IReadOnlyList<QrCodeDto>`) | `400` if `Count < 1` or `> 200` |
| `POST` | `/qrcodes/{token}/bind` | `[FromBody] BindQrCodeRequest` | `200 OK` (`QrCodeDto`) | `400` if `TargetType == Unassigned`; `403` if target is private; `404` if target not found; `409` if already bound |
| `POST` | `/qrcodes/{token}/unbind` | — | `200 OK` (`QrCodeDto`) | `403` if private; `404` if token not found |
| `DELETE` | `/qrcodes/{id:guid}` | — | `204 No Content` | `403` if private; `404` if not found |

### 3.2 `ScanController` (`WhereHouse.API/Controllers/ScanController.cs`)
- Attributes: `[ApiController]`, `[Route("scan")]`, `[Authorize]`

| Verb | Route (`/api/...`) | Request Body / Query | Response (`200`) | Error Cases (`400`/`403`/`404`) |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/scan/{*code}` | Route catch-all `string code` (supports codes or encoded URLs) | `200 OK` (`ScanResolutionDto`) | `400` if code empty |
| `POST` | `/scan/bulk-move-audit` | `[FromBody] BulkScanAuditRequest` | `200 OK` (`BulkScanAuditResponseDto`) | `400` if empty list; `403` if destination private; `404` if destination not found |

---

## 4. Angular Frontend Design (`WhereHouse.Client`)

### 4.1 TypeScript Models (`src/app/core/models/qrcode.models.ts`)

Create `WhereHouse.Client/src/app/core/models/qrcode.models.ts`:
- `QrTargetType` (`0 | 1 | 2`) and `QrTargetTypes` const object (`Unassigned: 0`, `LocationNode: 1`, `Item: 2`).
- `ScanResolutionType` (`0 | 1 | 2 | 3 | 4`) and `ScanResolutionTypes` const object (`NotFound: 0`, `UnassignedQr: 1`, `LocationNode: 2`, `Item: 3`, `PrivateRestricted: 4`).
- `BulkAuditOutcomeType` (`0 | 1 | 2 | 3 | 4 | 5 | 6`) and `BulkAuditOutcomeTypes` const object.
- Interfaces: `QrCodeDto`, `GenerateQrCodeBatchRequest`, `BindQrCodeRequest`, `ScanResolutionDto`, `BulkScanAuditRequest`, `BulkScanAuditItemResultDto`, `BulkScanAuditResponseDto`.
- Label Sheet Preset types for the Label Generator:
  ```typescript
  export type LabelPresetId =
    | 'avery-5160'
    | 'avery-5163'
    | 'avery-22806'
    | 'thermal-2x1'
    | 'thermal-225x125'
    | 'thermal-4x6';

  export interface LabelPreset {
    id: LabelPresetId;
    name: string;
    category: 'sheet' | 'thermal';
    columns: number;
    rows: number;
    widthInches: number;
    heightInches: number;
    description: string;
  }

  export interface PrintableLabelItem {
    code: string;
    title: string;
    subtitle: string | null;
    badgeText: string | null;
    primaryColor: string | null;
    accentColor: string | null;
  }
  ```

### 4.2 Deterministic SVG QR Code Utility (`src/app/core/utils/qr-svg.ts`)

Create `WhereHouse.Client/src/app/core/utils/qr-svg.ts`:
- A lightweight, self-contained TypeScript utility `generateQrSvgDataUrl(payload: string, sizePx?: number): string` (or inline SVG matrix builder) that encodes any short code or `/scan/{code}` URL into a scannable ISO/IEC 18004 QR Code Version 1–4 (Byte mode, Error Correction Level L/M) SVG string / `data:image/svg+xml;utf8,...` URI with finder patterns, timing patterns, format bits, Reed-Solomon ECC codewords, and quiet zone.
- Zero external npm runtime bloat required; works 100% offline in air-gapped local LAN / TrueNAS environments and renders crisply at any DPI when printing Avery sheets or thermal labels.

### 4.3 Angular Services (`src/app/core/services/qrcode/`)

Create `WhereHouse.Client/src/app/core/services/qrcode/qrcode.service.ts` (and `qrcode.service.spec.ts`):
- Decorated with `@Service()`.
- Methods:
  - `getQrCodes(targetType?: QrTargetType): Observable<QrCodeDto[]>` $\rightarrow$ `GET /api/qrcodes`
  - `generateBatch(request: GenerateQrCodeBatchRequest): Observable<QrCodeDto[]>` $\rightarrow$ `POST /api/qrcodes/batch`
  - `bindQrCode(token: string, request: BindQrCodeRequest): Observable<QrCodeDto>` $\rightarrow$ `POST /api/qrcodes/${encodeURIComponent(token)}/bind`
  - `unbindQrCode(token: string): Observable<QrCodeDto>` $\rightarrow$ `POST /api/qrcodes/${encodeURIComponent(token)}/unbind`
  - `deleteQrCode(id: string): Observable<void>` $\rightarrow$ `DELETE /api/qrcodes/${id}`
  - `resolveScan(codeOrUrl: string): Observable<ScanResolutionDto>` $\rightarrow$ `GET /api/scan/${encodeURIComponent(codeOrUrl)}`
  - `bulkMoveAudit(request: BulkScanAuditRequest): Observable<BulkScanAuditResponseDto>` $\rightarrow$ `POST /api/scan/bulk-move-audit`

### 4.4 Feature Dialogs & Route Integration (`src/app/features/dashboard/`)

1. **`ScannerDialogComponent` (`src/app/features/dashboard/scanner-dialog/scanner-dialog.component.ts` & `.spec.ts`):**
   - Accepts `MAT_DIALOG_DATA: { initialCode?: string | null; availableLocations: LocationNodeDto[]; availableItems: ItemDto[] }`.
   - **Two Mode Tabs:**
     - **Tab 1: Scan-to-View ("X-Ray Vision" & Blank QR Binding):**
       - Camera toggle button (`videocam` / `videocam_off`) using `navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } })` + `BarcodeDetector` polling when supported in the browser, paired with an always-ready **Scan / Code Input Bar** (`placeholder="Scan QR / barcode or type BIN-001, ITM-001, QR-0001..."`).
       - Displays the resolved `ScanResolutionDto`:
         - **`LocationNode` ("X-Ray Vision"):** Shows container visual badge (`primaryColor` / `accentColor`, `containerStyle`, `shortCode`, `fullPath`), child containers list, and an X-Ray grid/checklist of all items inside (`LocationItems`) with quick actions (`Open Location in Dashboard`, `Print Label`).
         - **`Item`:** Shows item card details (`shortCode`, `name`, `brand`, `homeLocationFullPath`, `status`, `currentQuantity`) with quick actions (`Jump to Home Bin`, `Edit Item`).
         - **`UnassignedQr` ("Blank QR Sticker Scanned!"):** High-visibility prompt allowing the user to bind the scanned `QR-xxxx` sticker to an existing `LocationNode` or `InventoryItem` via selector dropdowns, or click **"Create New Container & Bind"** / **"Create New Item & Bind"**.
         - **`PrivateRestricted`:** Displays an opaque lock card (`lock` icon + `"Restricted: This container or item is marked Private by its owner."`).
     - **Tab 2: Scan-to-Audit / Bulk Move:**
       - Step 1: Select or scan a **Destination Location / Shelf** (`destinationLocationId`).
       - Step 2: Continuously scan or enter multiple `BIN-xxx`, `ITM-xxx`, or `QR-xxxx` codes; each scan immediately calls `qrcodeService.bulkMoveAudit` and prepends the result (`MovedContainer`, `MovedItem`, `AuditedPresent`, `SkippedPrivate`, etc.) to a live audit log table.

2. **`LabelGeneratorDialogComponent` (`src/app/features/dashboard/label-generator-dialog/label-generator-dialog.component.ts` & `.spec.ts`):**
   - Accepts `MAT_DIALOG_DATA: { availableLocations: LocationNodeDto[]; availableItems: ItemDto[]; preselectedLabels?: PrintableLabelItem[] }`.
   - **Label Source Selection:**
     - Choose existing Locations / Movable Containers, existing Items, existing Unassigned QR stickers, **or** click **"Generate Blank QR Batch (`QR-xxxx`)"** (`count` 1–60, optional `labelNote`) to mint new unassigned QR stickers on the fly and add them to the print queue.
   - **Layout & Offset Controls:**
     - Preset selector: `Avery 5160 (30-up)`, `Avery 5163 (10-up)`, `Avery 22806 (12-up Square)`, `Thermal 2"x1"`, `Thermal 2.25"x1.25"`, `Thermal 4"x6"`.
     - **"Start at Row / Column" Offset Controls** (`startRow`: `1..rows`, `startColumn`: `1..columns`) for sheet layouts—inserts `(startRow - 1) * columns + (startColumn - 1)` blank spacer cells before the first printed label so partially used Avery sheets can be reused!
     - Content toggles: ` encodeFullUrl` (encodes `{origin}/scan/{code}` vs compact `{code}`), `showSubtitle` (parent location path / brand), `showColorBadge`.
   - **Live Print Preview & Print Trigger:**
     - Renders the exact sheet grid or thermal roll cards with crisp SVG QR codes (`generateQrSvgDataUrl`), bold monospace `code`, `title`, `subtitle`, and color indicator.
     - Clicking **"Print Labels"** opens a clean print window / triggers `window.print()` with `@page` and `@media print` sizing rules matching the selected Avery or Thermal preset.

3. **Update `DashboardComponent` (`dashboard.component.ts`, `.html`, `.scss`, `.spec.ts`) & `app.routes.ts`:**
   - In `src/app/app.routes.ts`: add `{ path: 'scan/:code', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent), canActivate: [authGuard] }`.
   - In `DashboardComponent`:
     - Inject `ActivatedRoute`. In `ngOnInit()`, check `this.route.snapshot.paramMap.get('code')`; if non-empty, call `this.openScannerDialog(code)`.
     - Add **"Scan QR" (`qr_code_scanner`)** button and **"Print Labels" (`print`)** button in the top navigation bar (and mobile action bar), plus a **"Print Label"** action on Location header and Item action menu.

---

## 5. Step-by-Step Execution Checklist (For Implementation Agent)

- [ ] **Task 1: Backend Core & Data Layer (`WhereHouse.Core` & `WhereHouse.Data`)**
  - Create `WhereHouse.Core/QrCodes/QrAndScanModels.cs`, `WhereHouse.Core/QrCodes/IQrCodeService.cs`, and `WhereHouse.Core/QrCodes/IScanService.cs`.
  - Create `WhereHouse.Data/Entities/QrCode.cs`, update `LocationNode.cs`, `InventoryItem.cs`, and `User.cs` with `BoundQrCodes` / `CreatedQrCodes` navigation collections.
  - Create `WhereHouse.Data/Configurations/QrCodeConfiguration.cs` (using `DeleteBehavior.Restrict` on all foreign keys) and add `DbSet<QrCode> QrCodes` to `WhereHouseDbContext.cs`.
  - Update `LocationService.DeleteAsync` and `ItemService.DeleteItemAsync` to unbind any `QrCode` records referencing the deleted location or item before deletion.
  - Implement `WhereHouse.Data/Services/QrCodeService.cs` and `WhereHouse.Data/Services/ScanService.cs`, and register both in `WhereHouse.Data/DataServiceCollectionExtensions.cs`.
  - Ensure local SQL Server is running, then generate, apply, and format the EF Core migration:
    ```powershell
    .\scripts\ensure-local-infra.ps1
    dotnet ef migrations add AddQrCodes --project WhereHouse.Data --startup-project WhereHouse.API
    dotnet ef database update --project WhereHouse.Data --startup-project WhereHouse.API
    dotnet csharpier format WhereHouse.Data/Migrations
    ```
  - Create unit tests in `Tests/WhereHouse.Core.UnitTests/QrCodeTokenHelperTests.cs` (testing `ExtractCodeFromScanInput` with raw short codes, full `https://.../scan/BIN-042?x=1` deep-link URLs, and `GenerateNextBlankToken` sequential numbering) and run:
    ```powershell
    dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj
    ```

- [ ] **Task 2: API Controllers & Integration Tests (`WhereHouse.API` & `Tests/WhereHouse.API.IntegrationTests`)**
  - Create `WhereHouse.API/Controllers/QrCodesController.cs` and `WhereHouse.API/Controllers/ScanController.cs`.
  - Update `Tests/WhereHouse.API.IntegrationTests/OpenApiIntegrationTests.cs` to assert `"/qrcodes"` and `"/scan"`.
  - Create `Tests/WhereHouse.API.IntegrationTests/QrAndScanIntegrationTests.cs` covering:
    1. Generating a batch of Unassigned QR codes (`POST /api/qrcodes/batch`), verifying `QR-0001..QR-0005` creation, scanning `QR-0001` via `GET /api/scan/QR-0001` and verifying `ResolutionType == ScanResolutionType.UnassignedQr`.
    2. Binding `QR-0001` to a Movable Container (`POST /api/qrcodes/QR-0001/bind`) and `QR-0002` to an Item, then scanning `QR-0001` (and a deep-link URL `/api/scan/https%3A%2F%2Fwherehouse.lan%2Fscan%2FQR-0001`) to verify X-Ray resolution returns the container, its child containers, and its housed items.
    3. Unbinding `QR-0002` (`POST /api/qrcodes/QR-0002/unbind`) and verifying it reverts to `Unassigned`.
    4. Executing **Scan-to-Audit / Bulk Move** (`POST /api/scan/bulk-move-audit`) to move a container and an item into a destination shelf and verifying `MovedContainer`, `MovedItem`, and `AuditedPresent` outcomes.
    5. **"Secret / Gift Mode" (`IsPrivate`) Opaque Scan Protection:** Verifying that when User B scans User A's private container or private item (`GET /api/scan/{code}`), the response has `ResolutionType == ScanResolutionType.PrivateRestricted` with `Location == null`, `Item == null`, and `LocationItems == null`, and that User B receives `403 Forbidden` if attempting to bind/unbind User A's private entities.
  - Run integration tests until 100% green:
    ```powershell
    dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj
    ```

- [ ] **Task 3: Angular Client & Unit Tests (`WhereHouse.Client`)**
  - Create `src/app/core/models/qrcode.models.ts` and `src/app/core/utils/qr-svg.ts` (with unit tests in `qr-svg.spec.ts`).
  - Create `QrCodeService` (`src/app/core/services/qrcode/qrcode.service.ts` & `qrcode.service.spec.ts`).
  - Create `ScannerDialogComponent` (`src/app/features/dashboard/scanner-dialog/scanner-dialog.component.ts` & `.spec.ts`) supporting X-Ray Scan-to-View, Unassigned QR Binding, and Scan-to-Audit Bulk Move.
  - Create `LabelGeneratorDialogComponent` (`src/app/features/dashboard/label-generator-dialog/label-generator-dialog.component.ts` & `.spec.ts`) supporting Avery (5160, 5163, 22806) with Start Row/Column offset, Thermal presets (2x1, 2.25x1.25, 4x6), Blank QR Batch generation, and SVG QR rendering.
  - Update `src/app/app.routes.ts` (adding `scan/:code` route) and `DashboardComponent` (`.ts`, `.html`, `.scss`, `.spec.ts`) with Scan QR & Print Labels triggers and route parameter auto-launch.
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
  - Update `docs/plans/phase-04-qr-labels-and-scanner.md` status to `[x] Completed`.
