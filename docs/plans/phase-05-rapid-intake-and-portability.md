# Phase 05: Rapid-Fire Batch Intake, Retail UPC Barcode Lookup & CSV/JSON Bulk Import/Export

> **Branch:** `feature/phase-05-rapid-intake-and-portability`
> **Status:** Planned (`[ ]` Not Started | `[~]` In Progress | `[x]` Completed)
> **PRD Reference:** `docs/prd.md` — Sections 4.3.4 #4 (`UPC / Retail Barcode Lookup`), 4.4.1 (`"Rapid-Fire" Batch Intake Mode`), 4.4.2 (`Quick-Clone / Duplicate Item`), 4.4.3 (`CSV & JSON Bulk Import / Export`), and 4.8.2 (`"Secret / Gift Mode" Privacy`)
> **Target Execution:** Run `/execute-phase` with your implementation model to execute this plan step-by-step.

---

## 1. Scope & Objectives

This phase completes **Milestone 2 (Camera & Physical Labeling + Rapid Intake)** by delivering the **"Day 1 Cataloging" Fast Intake Suite** and **Full Data Portability Engine**:

1. **Retail UPC / EAN Barcode Field & Product Lookup (`BarcodeNumber`, `IBarcodeLookupService`, `GET /api/intake/barcode/{barcode}`):**
   - Extends `InventoryItem` with an indexed `BarcodeNumber` (`string?`, max length `64`) persisted across item creation, editing, cloning, smart search, and scan resolution (`GET /api/scan/{*code}` and `POST /api/scan/bulk-move-audit`).
   - Implements `IBarcodeLookupService` (`BarcodeLookupService`) with a 3-tier resolution strategy:
     1. **Household Catalog Match:** Checks existing accessible `InventoryItems` in `WhereHouseDbContext` matching `BarcodeNumber` to immediately reuse the household's exact product name, brand, model, category, item type, and unit.
     2. **Built-In Curated Household & Workshop Catalog:** Instant, offline-capable lookup table of common retail UPC-A / EAN-13 barcodes across tools, batteries, adhesives, cables, storage bins, and electronics (e.g., DeWalt, Milwaukee, Duracell, Anker, 3M, WD-40, Gorilla Glue, Raspberry Pi) so air-gapped TrueNAS deployments and automated tests work deterministically.
     3. **External Open Barcode Provider Fallback:** Optional best-effort HTTP lookup (`OpenFoodFacts` / `UPCitemdb` compatible JSON check with short timeout) that gracefully falls back to `Found = false` when offline.
2. **"Rapid-Fire" Batch Intake Mode (`IRapidIntakeService`, `POST /api/intake/rapid`, `POST /api/intake/rapid-batch`, `RapidIntakeDialogComponent`):**
   - Purpose-built for cataloging an open bin of 20–50 items in minutes without repetitive modal clicks:
     - **Locked Context Header:** User selects or scans a target container/location (`HomeLocationId`, e.g., `BIN-042`) and optionally locks a default `CategoryId`, `ItemType` (`Unique` vs `Quantity`), `Condition`, and `IsPrivate` flag.
     - **High-Speed Entry Loop:** Scan or type a retail UPC barcode (auto-filling Name, Brand, Model, Description, and Category suggestion) or type item details directly, optionally attach a pre-printed `QR-xxxx` sticker (`BindQrToken`) on the fly, and hit **`Enter` / "Save & Add Next"**.
     - **Live Session Feed:** Displays the items cataloged during the current session at the bottom of the dialog with 1-tap **`+1` / `-1` Quantity**, **Clone Draft**, and **Undo (Delete)** actions.
3. **Enhanced Quick-Clone / Draft Duplication (`ItemDialogComponent` & `DashboardComponent`):**
   - Enhances `ItemDialogComponent` to support `cloneFromItem?: ItemDto` mode in addition to instant 1-tap duplicate, pre-populating Location, Category, dynamic Category Attribute values, Brand, Model, and Tags while focusing the Name input for rapid variant entry (e.g., changing `6ft HDMI Cable` to `10ft HDMI Cable`).
4. **CSV & JSON Round-Trip Bulk Import / Export (`IDataPortabilityService`, `PortabilityController`, `ImportExportDialogComponent`):**
   - **Export (`GET /api/portability/export/json`, `GET /api/portability/export/csv?entityType=items|locations|categories`):**
     - Exports accessible Categories (with Attribute Templates), Locations/Containers (with hierarchy `ParentShortCode` and visual styling), and Items (with `HomeLocationShortCode`, `CategoryName`, `BarcodeNumber`, quantities, financial vault fields, and custom attribute values).
     - Strictly enforces **"Secret / Gift Mode" (`IsPrivate`)**: never exports private locations or items owned by other household users.
   - **Import (`POST /api/portability/import/json`, `POST /api/portability/import/csv`):**
     - Supports **Dry-Run Validation Preview (`dryRun: true`)** and **Transactional Commit (`dryRun: false`)**.
     - Supports interactive **CSV Column Mapping** (`ColumnMapping` dictionary mapping canonical WhereHouse fields to arbitrary user CSV header names) and `UpdateExisting` upsert semantics with strict ownership protection (preventing non-owners from overwriting private records).

### Explicitly Out of Scope for Phase 05 (Deferred to Phase 06 / Milestone 3)
- Full Check-In / Check-Out state machine (`CheckoutLog`), External Borrower Loans with due dates, Reusable Project Loadouts & Pick Lists, Ad-Hoc Project Cart, and Declutter Staging / Graveyard Archive workflows $\rightarrow$ **Milestone 3 (Phase 06+)**.

---

## 2. Domain & Database Design (`WhereHouse.Core` & `WhereHouse.Data`)

### 2.1 Update `InventoryItem` & Item Models (`BarcodeNumber`)

1. **`WhereHouse.Data/Entities/InventoryItem.cs`:**
   - Add property:
     ```csharp
     public string? BarcodeNumber { get; set; }
     ```
2. **`WhereHouse.Data/Configurations/InventoryItemConfiguration.cs`:**
   - Add property length & non-unique index:
     ```csharp
     builder.Property(i => i.BarcodeNumber).HasMaxLength(64);
     builder.HasIndex(i => i.BarcodeNumber);
     ```
3. **`WhereHouse.Core/Items/ItemModels.cs`:**
   - Append `string? BarcodeNumber = null` as the final optional parameter on `ItemDto`:
     ```csharp
     public sealed record ItemDto(
         // ... existing parameters up to PrimaryPhotoAttachmentId ...
         int AttachmentCount = 0,
         Guid? PrimaryPhotoAttachmentId = null,
         string? BarcodeNumber = null
     );
     ```
   - Append `[MaxLength(64)] string? BarcodeNumber = null` as the final optional parameter on `CreateItemRequest` and `UpdateItemRequest`.
4. **Update `ItemService.cs`, `SearchService.cs`, and `ScanService.cs`:**
   - In `ItemService.CreateItemAsync` and `UpdateItemAsync`: normalize and persist `BarcodeNumber = string.IsNullOrWhiteSpace(request.BarcodeNumber) ? null : request.BarcodeNumber.Trim()`.
   - In `ItemService.DuplicateItemAsync`: copy `BarcodeNumber = source.BarcodeNumber` onto the cloned item.
   - In `ItemService.GetItemsAsync` (search filter) and `SearchService.SearchAsync` (token match): include `(i.BarcodeNumber != null && i.BarcodeNumber.Contains(token, StringComparison.OrdinalIgnoreCase))`.
   - In `ItemService.MapToDto` and `SearchService.MapItemToDto`: pass `item.BarcodeNumber` to `ItemDto`.
   - In `ScanService.ResolveScanAsync` and `ScanService.ExecuteBulkMoveAuditAsync`: when matching an item by code, match `i.ShortCode == code || i.BarcodeNumber == code`.

### 2.2 Intake & Barcode Lookup Models (`WhereHouse.Core/Intake/IntakeAndBarcodeModels.cs`)

Create `WhereHouse.Core/Intake/IntakeAndBarcodeModels.cs`:

```csharp
using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using WhereHouse.Core.Items;

namespace WhereHouse.Core.Intake;

public sealed record BarcodeProductLookupDto(
    string Barcode,
    bool Found,
    string Source,
    string? Name = null,
    string? Brand = null,
    string? ModelNumber = null,
    string? Description = null,
    string? SuggestedCategoryName = null,
    Guid? MatchedCategoryId = null,
    ItemType SuggestedItemType = ItemType.Unique,
    string? SuggestedUnit = null,
    Guid? ExistingItemId = null,
    string? ExistingItemShortCode = null
);

public sealed record RapidIntakeItemRequest(
    [Required, MaxLength(200)] string Name,
    Guid? HomeLocationId = null,
    Guid? CategoryId = null,
    ItemType ItemType = ItemType.Unique,
    ItemCondition Condition = ItemCondition.Good,
    decimal CurrentQuantity = 1m,
    [MaxLength(32)] string? Unit = null,
    decimal? MinQuantity = null,
    [MaxLength(64)] string? BarcodeNumber = null,
    [MaxLength(100)] string? Brand = null,
    [MaxLength(100)] string? ModelNumber = null,
    [MaxLength(100)] string? SerialNumber = null,
    [MaxLength(2000)] string? Description = null,
    IReadOnlyList<string>? Tags = null,
    decimal? PurchasePrice = null,
    bool IsPrivate = false,
    [MaxLength(64)] string? BindQrToken = null
);

public sealed record RapidBatchIntakeRequest(
    Guid? DefaultHomeLocationId = null,
    Guid? DefaultCategoryId = null,
    bool DefaultIsPrivate = false,
    [Required, MinLength(1), MaxLength(100)] IReadOnlyList<RapidIntakeItemRequest> Items = null!
);

public sealed record RapidBatchIntakeResponseDto(
    int CreatedCount,
    IReadOnlyList<ItemDto> CreatedItems
);

public static partial class BarcodeFormatHelper
{
    [GeneratedRegex(@"^[\d\-\s]+$")]
    private static partial Regex NumericWithSeparatorsPattern();

    [GeneratedRegex(@"^\d{8,14}$")]
    private static partial Regex StandardGtinPattern();

    public static string NormalizeBarcode(string? rawBarcode)
    {
        if (string.IsNullOrWhiteSpace(rawBarcode))
        {
            throw new ArgumentException("Barcode cannot be empty.", nameof(rawBarcode));
        }

        var trimmed = rawBarcode.Trim();
        if (NumericWithSeparatorsPattern().IsMatch(trimmed))
        {
            trimmed = trimmed.Replace("-", string.Empty).Replace(" ", string.Empty);
        }

        if (trimmed.Length > 64)
        {
            trimmed = trimmed[..64];
        }

        return trimmed.ToUpperInvariant();
    }

    public static bool IsStandardRetailBarcode(string? rawBarcode)
    {
        if (string.IsNullOrWhiteSpace(rawBarcode))
        {
            return false;
        }

        var normalized = NormalizeBarcode(rawBarcode);
        return StandardGtinPattern().IsMatch(normalized);
    }
}
```

### 2.3 Intake & Barcode Service Contracts (`WhereHouse.Core/Intake/`)

1. **Create `WhereHouse.Core/Intake/IBarcodeLookupService.cs`:**
   ```csharp
   namespace WhereHouse.Core.Intake;

   public interface IBarcodeLookupService
   {
       Task<BarcodeProductLookupDto> LookupBarcodeAsync(
           Guid userId,
           string rawBarcode,
           CancellationToken cancellationToken = default
       );
   }
   ```
2. **Create `WhereHouse.Core/Intake/IRapidIntakeService.cs`:**
   ```csharp
   using WhereHouse.Core.Items;

   namespace WhereHouse.Core.Intake;

   public interface IRapidIntakeService
   {
       Task<ItemDto> CreateRapidItemAsync(
           Guid userId,
           RapidIntakeItemRequest request,
           CancellationToken cancellationToken = default
       );

       Task<RapidBatchIntakeResponseDto> CreateRapidBatchAsync(
           Guid userId,
           RapidBatchIntakeRequest request,
           CancellationToken cancellationToken = default
       );
   }
   ```

### 2.4 Data Portability Models & Service Contract (`WhereHouse.Core/Portability/`)

1. **Create `WhereHouse.Core/Portability/PortabilityModels.cs`:**
   ```csharp
   using System.ComponentModel.DataAnnotations;
   using WhereHouse.Core.Categories;
   using WhereHouse.Core.Items;
   using WhereHouse.Core.Locations;

   namespace WhereHouse.Core.Portability;

   public enum PortabilityEntityType
   {
       Items = 0,
       Locations = 1,
       Categories = 2,
   }

   public enum ImportRowAction
   {
       Create = 0,
       Update = 1,
       Skip = 2,
       Error = 3,
   }

   public sealed record CategoryAttributeTemplateExportRecord(
       string Name,
       AttributeFieldType FieldType,
       string? Unit,
       IReadOnlyList<string> Options,
       bool IsRequired,
       int SortOrder
   );

   public sealed record CategoryExportRecord(
       string Name,
       string? Description,
       string? Icon,
       IReadOnlyList<CategoryAttributeTemplateExportRecord> AttributeTemplates
   );

   public sealed record LocationExportRecord(
       string ShortCode,
       string Name,
       string? ParentShortCode,
       LocationNodeType NodeType,
       string? Description,
       string? Icon,
       string? ContainerStyle,
       string? PrimaryColor,
       string? AccentColor,
       string? ColorLabel,
       bool IsPrivate
   );

   public sealed record ItemAttributeExportRecord(
       string AttributeName,
       AttributeFieldType FieldType,
       string? Unit,
       string Value
   );

   public sealed record ItemExportRecord(
       string ShortCode,
       string Name,
       ItemType ItemType,
       ItemStatus Status,
       ItemCondition Condition,
       string? HomeLocationShortCode,
       string? CategoryName,
       string? ParentItemShortCode,
       string? Description,
       IReadOnlyList<string> Aliases,
       IReadOnlyList<string> Tags,
       string? Brand,
       string? ModelNumber,
       string? SerialNumber,
       string? BarcodeNumber,
       decimal CurrentQuantity,
       string? Unit,
       decimal? MinQuantity,
       DateTimeOffset? PurchaseDate,
       string? Retailer,
       decimal? PurchasePrice,
       decimal? EstimatedReplacementValue,
       DateTimeOffset? ReturnWindowEndDate,
       DateTimeOffset? WarrantyExpirationDate,
       string? WarrantyNotes,
       bool IsPrivate,
       IReadOnlyList<ItemAttributeExportRecord> AttributeValues
   );

   public sealed record WhereHouseExportBundleDto(
       string FormatVersion,
       DateTimeOffset ExportedAt,
       IReadOnlyList<CategoryExportRecord> Categories,
       IReadOnlyList<LocationExportRecord> Locations,
       IReadOnlyList<ItemExportRecord> Items
   );

   public sealed record CsvImportRequest(
       PortabilityEntityType EntityType,
       [Required] string CsvContent,
       bool DryRun = true,
       bool UpdateExisting = true,
       IReadOnlyDictionary<string, string>? ColumnMapping = null
   );

   public sealed record JsonImportRequest(
       [Required] string JsonContent,
       bool DryRun = true,
       bool UpdateExisting = true
   );

   public sealed record ImportRowPreviewDto(
       int RowNumber,
       string EntityType,
       string Identifier,
       string Name,
       ImportRowAction Action,
       string Message
   );

   public sealed record ImportResultDto(
       bool DryRun,
       int TotalRowsProcessed,
       int CreatedCount,
       int UpdatedCount,
       int SkippedCount,
       int ErrorCount,
       IReadOnlyList<ImportRowPreviewDto> Rows
   );
   ```

2. **Create `WhereHouse.Core/Portability/IDataPortabilityService.cs`:**
   ```csharp
   namespace WhereHouse.Core.Portability;

   public interface IDataPortabilityService
   {
       Task<WhereHouseExportBundleDto> ExportJsonBundleAsync(
           Guid userId,
           CancellationToken cancellationToken = default
       );

       Task<string> ExportCsvAsync(
           Guid userId,
           PortabilityEntityType entityType,
           CancellationToken cancellationToken = default
       );

       Task<ImportResultDto> ImportJsonBundleAsync(
           Guid userId,
           JsonImportRequest request,
           CancellationToken cancellationToken = default
       );

       Task<ImportResultDto> ImportCsvAsync(
           Guid userId,
           CsvImportRequest request,
           CancellationToken cancellationToken = default
       );
   }
   ```

### 2.5 Service Implementations (`WhereHouse.Data/Services/`)

1. **`WhereHouse.Data/Services/BarcodeLookupService.cs` (`IBarcodeLookupService`):**
   - Injects `WhereHouseDbContext`.
   - Normalizes `rawBarcode` via `BarcodeFormatHelper.NormalizeBarcode(rawBarcode)`.
   - **Step 1 (Household Catalog Match):**
     - Queries `dbContext.InventoryItems.AsNoTracking().Include(i => i.Category)` for an accessible item (where `!i.IsPrivate || i.OwnerId == userId`, and home location is accessible) with `i.BarcodeNumber == barcode`.
     - If found, returns `BarcodeProductLookupDto` with `Found = true`, `Source = "HouseholdCatalog"`, `Name = existing.Name`, `Brand = existing.Brand`, `ModelNumber = existing.ModelNumber`, `Description = existing.Description`, `SuggestedCategoryName = existing.Category?.Name`, `MatchedCategoryId = existing.CategoryId`, `SuggestedItemType = existing.ItemType`, `SuggestedUnit = existing.Unit`, `ExistingItemId = existing.Id`, `ExistingItemShortCode = existing.ShortCode`.
   - **Step 2 (Built-In Curated Catalog Match):**
     - Checks a static dictionary of 15+ well-known retail UPC/EAN codes:
       - `"0885911362757"` / `"885911362757"` $\rightarrow$ DeWalt 20V MAX XR Hammer Drill (`DCD996B`, Category: `Power Tools`, Type: `Unique`)
       - `"0045242507979"` / `"045242507979"` $\rightarrow$ Milwaukee M18 FUEL 1/4" Hex Impact Driver (`2853-20`, Category: `Power Tools`, Type: `Unique`)
       - `"0041333415017"` / `"041333415017"` $\rightarrow$ Duracell Coppertop AA Alkaline Batteries 20-Pack (`MN1500`, Category: `Batteries & Power`, Type: `Quantity`, Unit: `pcs`)
       - `"0039800011329"` / `"039800011329"` $\rightarrow$ Energizer MAX AAA Alkaline Batteries 16-Pack (`E92`, Category: `Batteries & Power`, Type: `Quantity`, Unit: `pcs`)
       - `"0848061059113"` / `"848061059113"` $\rightarrow$ Anker USB-C to USB-C Cable 6ft 100W (`A8753`, Category: `Cables & Adapters`, Type: `Quantity`, Unit: `pcs`)
       - `"0079567101109"` / `"079567101109"` $\rightarrow$ WD-40 Multi-Use Product Smart Straw 12oz (`110108`, Category: `Hardware & Consumables`, Type: `Quantity`, Unit: `cans`)
       - `"0051131919655"` / `"051131919655"` $\rightarrow$ 3M Command Large Picture Hanging Strips (`17206`, Category: `Hardware & Consumables`, Type: `Quantity`, Unit: `pairs`)
       - `"0052427000033"` / `"052427000033"` $\rightarrow$ Gorilla Super Glue Gel 20g (`7700104`, Category: `Hardware & Consumables`, Type: `Quantity`, Unit: `bottles`)
       - `"0073149940285"` / `"073149940285"` $\rightarrow$ HDX 27-Gallon Tough Storage Tote Black/Yellow (`206127`, Category: `Storage & Organization`, Type: `Unique`)
       - `"5056561803258"` $\rightarrow$ Raspberry Pi 5 8GB Single Board Computer (`RPI5-8GB`, Category: `Electronics & Computing`, Type: `Unique`)
     - If matched in the curated catalog, checks `dbContext.Categories.AsNoTracking()` for a category whose name matches `SuggestedCategoryName` (case-insensitive) to populate `MatchedCategoryId`, and returns `Found = true`, `Source = "CuratedCatalog"`.
   - **Step 3 (Not Found):**
     - Returns `new BarcodeProductLookupDto(barcode, Found: false, Source: "NotFound")`.

2. **`WhereHouse.Data/Services/RapidIntakeService.cs` (`IRapidIntakeService`):**
   - Injects `IItemService` and `IQrCodeService`.
   - `CreateRapidItemAsync`:
     - Maps `RapidIntakeItemRequest` to `CreateItemRequest` (including `BarcodeNumber`, `Tags`, `PurchasePrice`, etc.) and calls `itemService.CreateItemAsync(userId, createRequest, cancellationToken)`.
     - If `!string.IsNullOrWhiteSpace(request.BindQrToken)`:
       - Calls `qrCodeService.BindQrCodeAsync(userId, request.BindQrToken, new BindQrCodeRequest(QrTargetType.Item, TargetItemId: createdItem.Id), cancellationToken)`.
     - Returns the created `ItemDto`.
   - `CreateRapidBatchAsync`:
     - Iterates through `request.Items`, applying `DefaultHomeLocationId`, `DefaultCategoryId`, and `DefaultIsPrivate` whenever an individual item's `HomeLocationId` or `CategoryId` is `null` (or `IsPrivate` is false and `DefaultIsPrivate` is true).
     - Calls `CreateRapidItemAsync` for each item and returns `new RapidBatchIntakeResponseDto(createdItems.Count, createdItems)`.

3. **`WhereHouse.Data/Services/DataPortabilityService.cs` (`IDataPortabilityService`):**
   - **Export Logic (`ExportJsonBundleAsync` & `ExportCsvAsync`):**
     - Loads categories (`Include(c => c.AttributeTemplates)`), accessible locations (ordered topologically so parents appear before children!), and accessible items (`Include` category, home location, parent item, attribute values).
     - **Topological Sort for Locations:** Orders exported locations by depth (`root` nodes first, then children) so any round-trip import naturally encounters parent `ShortCode`s before child `ParentShortCode`s.
     - **CSV Formatting (`ExportCsvAsync`):**
       - Uses RFC 4180 CSV escaping (quoting fields containing `,`, `"`, `\r`, or `\n` and doubling internal `"`).
       - Columns for `Items`: `ShortCode,Name,ItemType,Status,Condition,HomeLocationShortCode,CategoryName,ParentItemShortCode,Brand,ModelNumber,SerialNumber,BarcodeNumber,CurrentQuantity,Unit,MinQuantity,PurchasePrice,EstimatedReplacementValue,Retailer,Description,Aliases,Tags,IsPrivate`.
       - Columns for `Locations`: `ShortCode,Name,ParentShortCode,NodeType,ContainerStyle,PrimaryColor,AccentColor,ColorLabel,Description,Icon,IsPrivate`.
       - Columns for `Categories`: `Name,Description,Icon,AttributeTemplates`.
   - **Import Logic (`ImportJsonBundleAsync` & `ImportCsvAsync`):**
     - Supports `DryRun = true` (validates every row, checks for duplicate/existing codes, checks privacy permissions, and returns `ImportResultDto` without calling `SaveChangesAsync`) and `DryRun = false` (persists changes).
     - **Privacy Protection:** If an incoming Location or Item matches an existing `ShortCode` in the database that is inaccessible to `userId` (`IsPrivate && OwnerId != userId` or inside another user's private location), records an `ImportRowAction.Error` for that row (`"Access denied: ShortCode belongs to another user's private inventory."`) and never modifies it.
     - **CSV Parser & Column Mapper:**
       - Includes a clean RFC 4180 state-machine CSV parser handling quoted multiline/comma values.
       - Applies `request.ColumnMapping` (if provided) or case-insensitive header normalization (e.g., `"HomeLocationShortCode"`, `"Home Location"`, `"LocationCode"`, `"Bin"` $\rightarrow$ `HomeLocationShortCode`).
       - Validates required fields (`Name`), resolves `HomeLocationShortCode` to `LocationNode.Id`, resolves `CategoryName` to `Category.Id` (auto-creating the Category when `DryRun == false` if it does not exist yet!), and creates or updates the record.

---

## 3. API Endpoints (`WhereHouse.API/Controllers/`)

### 3.1 `WhereHouse.API/Controllers/IntakeController.cs` (`[Route("intake")]`)

| Verb | Route (`/api/...`) | Request Body / Query | Response (`200`/`201`) | Error Cases (`400`/`403`/`404`/`409`) |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/intake/barcode/{*barcode}` | Path `barcode` | `200 OK` $\rightarrow$ `BarcodeProductLookupDto` | `400 Bad Request` if empty |
| `POST` | `/intake/rapid` | `RapidIntakeItemRequest` | `201 Created` $\rightarrow$ `ItemDto` | `400`, `403`, `404`, `409` |
| `POST` | `/intake/rapid-batch` | `RapidBatchIntakeRequest` | `200 OK` $\rightarrow$ `RapidBatchIntakeResponseDto` | `400`, `403`, `404`, `409` |

### 3.2 `WhereHouse.API/Controllers/PortabilityController.cs` (`[Route("portability")]`)

| Verb | Route (`/api/...`) | Request Body / Query | Response (`200`) | Error Cases (`400`/`403`) |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/portability/export/json` | — | `200 OK` $\rightarrow$ `WhereHouseExportBundleDto` | `401 Unauthorized` |
| `GET` | `/portability/export/csv` | `?entityType=Items\|Locations\|Categories` | `200 OK` (`text/csv` file download) | `400 Bad Request` |
| `POST` | `/portability/import/json` | `JsonImportRequest` | `200 OK` $\rightarrow$ `ImportResultDto` | `400 Bad Request` |
| `POST` | `/portability/import/csv` | `CsvImportRequest` | `200 OK` $\rightarrow$ `ImportResultDto` | `400 Bad Request` |

---

## 4. Angular Frontend Design (`WhereHouse.Client`)

### 4.1 TypeScript Models (`src/app/core/models/`)

1. **Update `src/app/core/models/item.models.ts`:**
   - Add `barcodeNumber?: string | null;` to `ItemDto`, `CreateItemRequest`, and `UpdateItemRequest`.
2. **Create `src/app/core/models/intake-portability.models.ts`:**
   - Interfaces for `BarcodeProductLookupDto`, `RapidIntakeItemRequest`, `RapidBatchIntakeRequest`, `RapidBatchIntakeResponseDto`.
   - Constants & types for `PortabilityEntityTypes` (`Items = 0`, `Locations = 1`, `Categories = 2`), `ImportRowActions` (`Create = 0`, `Update = 1`, `Skip = 2`, `Error = 3`), `WhereHouseExportBundleDto`, `CsvImportRequest`, `JsonImportRequest`, `ImportRowPreviewDto`, `ImportResultDto`.

### 4.2 Angular Services (`src/app/core/services/intake-portability/`)

Create `WhereHouse.Client/src/app/core/services/intake-portability/intake-portability.service.ts` (and `.spec.ts`):
- Decorated with `@Service()`.
- Methods:
  - `lookupBarcode(barcode: string): Observable<BarcodeProductLookupDto>` $\rightarrow$ `GET /api/intake/barcode/${encodeURIComponent(barcode)}`
  - `createRapidItem(request: RapidIntakeItemRequest): Observable<ItemDto>` $\rightarrow$ `POST /api/intake/rapid`
  - `createRapidBatch(request: RapidBatchIntakeRequest): Observable<RapidBatchIntakeResponseDto>` $\rightarrow$ `POST /api/intake/rapid-batch`
  - `exportJsonBundle(): Observable<WhereHouseExportBundleDto>` $\rightarrow$ `GET /api/portability/export/json`
  - `exportCsv(entityType: PortabilityEntityType): Observable<string>` $\rightarrow$ `GET /api/portability/export/csv?entityType=${entityType}` (`responseType: 'text'`)
  - `importJsonBundle(request: JsonImportRequest): Observable<ImportResultDto>` $\rightarrow$ `POST /api/portability/import/json`
  - `importCsv(request: CsvImportRequest): Observable<ImportResultDto>` $\rightarrow$ `POST /api/portability/import/csv`

### 4.3 Feature Components & Dialogs (`src/app/features/dashboard/`)

1. **Update `ItemDialogComponent` (`src/app/features/dashboard/item-dialog/item-dialog.component.ts`):**
   - Add `cloneFromItem?: ItemDto` to `ItemDialogData`. When `cloneFromItem` is provided (`isCloneMode`), pre-populate `itemType`, `homeLocationId`, `categoryId`, `parentItemId`, `condition`, `brand`, `modelNumber`, `barcodeNumber`, `unit`, `minQuantity`, `description`, `aliasesString`, `tagsString`, `retailer`, `purchasePrice`, `estimatedReplacementValue`, `isPrivate`, and `attributeValues`, and set `name` to `"${cloneFromItem.name} (Copy)"` so the user can immediately tweak the distinguishing field and save.
   - Add a **Retail Barcode (UPC / EAN)** input field with an inline **"Lookup UPC" (`manage_search`)** button that calls `intakePortabilityService.lookupBarcode(barcode)` and auto-populates `name`, `brand`, `modelNumber`, `description`, `categoryId`, `itemType`, and `unit` if empty!

2. **Create `RapidIntakeDialogComponent` (`src/app/features/dashboard/rapid-intake-dialog/rapid-intake-dialog.component.ts` & `.spec.ts`):**
   - Accepts `MAT_DIALOG_DATA: { initialLocationId?: string | null; availableLocations: LocationNodeDto[]; availableCategories: CategoryDto[] }`.
   - **Locked Context Bar:**
     - Target Container / Location selector (`lockedLocationId`, initialized from `initialLocationId`).
     - Locked Category selector (`lockedCategoryId`).
     - Default Archetype toggle (`Unique` vs `Quantity`), Default Private (`isPrivate`) toggle.
   - **Thumb & Keyboard Optimized Intake Form:**
     - **Barcode / UPC Scan Input:** Pressing `Enter` or clicking `Lookup` queries `lookupBarcode()`, filling the draft form and moving focus to Name or Save.
     - **Item Name Input** (required), **Quantity & Unit** (for Quantity items), **Brand**, **Model #**, **Optional Pre-Printed QR Sticker Token (`QR-xxxx`)** to bind immediately upon creation.
     - **"Save & Add Next (`Enter`)"** button: calls `intakePortabilityService.createRapidItem()`, resets the item-specific fields while keeping `lockedLocationId`, `lockedCategoryId`, and `defaultItemType` locked, and prepends the newly created `ItemDto` to `sessionItems` signal!
   - **Live Session Feed (Bottom Panel):**
     - Displays the items added in the current session (`sessionItems()`), with inline `+1` / `-1` quantity buttons, a **"Clone into Form"** button, and an **"Undo / Delete"** button (`itemService.deleteItem()`).

3. **Create `ImportExportDialogComponent` (`src/app/features/dashboard/import-export-dialog/import-export-dialog.component.ts` & `.spec.ts`):**
   - **Tab 1: Export Inventory (CSV & JSON Backup):**
     - One-click download buttons for:
       - **Full WhereHouse JSON Bundle (`.json`)** (Categories + Locations + Items)
       - **Items CSV (`.csv`)**
       - **Locations & Containers CSV (`.csv`)**
       - **Categories & Templates CSV (`.csv`)**
   - **Tab 2: Bulk Import (CSV Column Mapper & Dry-Run Preview):**
     - Select Import Format: `CSV (Items / Locations / Categories)` or `Full JSON Bundle`.
     - File upload input (`.csv` or `.json`) or paste raw text area.
     - **Interactive CSV Column Mapper:** When a CSV is loaded, parses the header row and displays dropdown mappings from WhereHouse target fields (`Name`, `ShortCode`, `HomeLocationShortCode`, `CategoryName`, `ItemType`, `CurrentQuantity`, `Unit`, `Brand`, `ModelNumber`, `SerialNumber`, `BarcodeNumber`, `PurchasePrice`, `Tags`) to the detected CSV columns (auto-matched by default).
     - **"Run Dry-Run Validation"** button (`dryRun = true`): Displays summary badges (`To Create`, `To Update`, `Skipped`, `Errors`) and a scrollable preview table of `ImportRowPreviewDto` rows.
     - **"Commit Import"** button (`dryRun = false`): Executes the import, displays a confirmation snackbar, and notifies `DashboardComponent` to refresh.

4. **Update `DashboardComponent` (`dashboard.component.ts`, `.html`, `.scss`, `.spec.ts`):**
   - Add **"Rapid Intake" (`bolt`)** button and **"Import / Export" (`import_export`)** button in the top navigation bar and location header action bar.
   - Add **"Clone & Edit..." (`edit_note`)** alongside **"Quick Duplicate" (`content_copy`)** in the item card overflow menu.

---

## 5. Step-by-Step Execution Checklist (For Implementation Agent)

- [ ] **Task 1: Backend Core & Data Layer (`WhereHouse.Core` & `WhereHouse.Data`)**
  - Update `WhereHouse.Data/Entities/InventoryItem.cs` and `WhereHouse.Data/Configurations/InventoryItemConfiguration.cs` with `BarcodeNumber` (`MaxLength(64)`, indexed).
  - Update `WhereHouse.Core/Items/ItemModels.cs` (`ItemDto`, `CreateItemRequest`, `UpdateItemRequest`) with optional `BarcodeNumber = null`.
  - Update `ItemService.cs`, `SearchService.cs`, and `ScanService.cs` to persist, copy, search, map, and scan-resolve `BarcodeNumber`.
  - Create `WhereHouse.Core/Intake/IntakeAndBarcodeModels.cs`, `WhereHouse.Core/Intake/IBarcodeLookupService.cs`, and `WhereHouse.Core/Intake/IRapidIntakeService.cs`.
  - Create `WhereHouse.Core/Portability/PortabilityModels.cs` and `WhereHouse.Core/Portability/IDataPortabilityService.cs`.
  - Implement `WhereHouse.Data/Services/BarcodeLookupService.cs`, `WhereHouse.Data/Services/RapidIntakeService.cs`, and `WhereHouse.Data/Services/DataPortabilityService.cs`, and register all three in `WhereHouse.Data/DataServiceCollectionExtensions.cs`.
  - Ensure local SQL Server is running, then generate, apply, and format the EF Core migration:
    ```powershell
    .\scripts\ensure-local-infra.ps1
    dotnet ef migrations add AddItemBarcodeNumber --project WhereHouse.Data --startup-project WhereHouse.API
    dotnet ef database update --project WhereHouse.Data --startup-project WhereHouse.API
    dotnet csharpier format WhereHouse.Data/Migrations
    ```
  - Create unit tests in `Tests/WhereHouse.Core.UnitTests/BarcodeFormatHelperTests.cs` and run:
    ```powershell
    dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj
    ```

- [ ] **Task 2: API Controllers & Integration Tests (`WhereHouse.API` & `Tests/WhereHouse.API.IntegrationTests`)**
  - Create `WhereHouse.API/Controllers/IntakeController.cs` and `WhereHouse.API/Controllers/PortabilityController.cs`.
  - Update `Tests/WhereHouse.API.IntegrationTests/OpenApiIntegrationTests.cs` to assert `"/intake"` and `"/portability"`.
  - Create `Tests/WhereHouse.API.IntegrationTests/IntakeAndPortabilityIntegrationTests.cs` covering:
    1. **Retail Barcode Lookup:** Curated UPC lookup (`0885911362757` $\rightarrow$ DeWalt Hammer Drill) and Household Catalog UPC lookup (after creating an item with a custom `BarcodeNumber`).
    2. **Scan Resolution by Retail Barcode:** Scanning an item's `BarcodeNumber` via `GET /api/scan/{barcode}` resolves the item in X-Ray / Item view.
    3. **Rapid-Fire Single & Batch Intake:** Creating items via `POST /api/intake/rapid` (with inline `BindQrToken` binding a `QR-xxxx` sticker) and `POST /api/intake/rapid-batch` with locked `DefaultHomeLocationId` and `DefaultCategoryId`.
    4. **CSV & JSON Export + Dry-Run & Commit Import:** Exporting JSON bundle and CSVs, running a CSV Dry-Run import (`dryRun: true`) with custom `ColumnMapping` verifying zero DB mutation, then committing (`dryRun: false`) and verifying created/updated items.
    5. **"Secret / Gift Mode" (`IsPrivate`) Portability Protection:** Verifying that User B's JSON and CSV exports completely omit User A's private locations and private items, and that User B cannot overwrite User A's private `ShortCode` via CSV or JSON import (`ErrorCount > 0`, `ImportRowAction.Error`).
  - Run integration tests until 100% green:
    ```powershell
    dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj
    ```

- [ ] **Task 3: Angular Client & Unit Tests (`WhereHouse.Client`)**
  - Update `src/app/core/models/item.models.ts` (`barcodeNumber`) and create `src/app/core/models/intake-portability.models.ts`.
  - Create `IntakePortabilityService` (`src/app/core/services/intake-portability/intake-portability.service.ts` & `.spec.ts`).
  - Update `ItemDialogComponent` (`item-dialog.component.ts` & `.spec.ts`) with `barcodeNumber` field, inline UPC lookup button, and `cloneFromItem` draft initialization.
  - Create `RapidIntakeDialogComponent` (`src/app/features/dashboard/rapid-intake-dialog/rapid-intake-dialog.component.ts` & `.spec.ts`).
  - Create `ImportExportDialogComponent` (`src/app/features/dashboard/import-export-dialog/import-export-dialog.component.ts` & `.spec.ts`).
  - Update `DashboardComponent` (`.ts`, `.html`, `.scss`, `.spec.ts`) with Rapid Intake, Import/Export, and Clone & Edit triggers.
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
  - Update `docs/plans/phase-05-rapid-intake-and-portability.md` status to `[x] Completed`.
