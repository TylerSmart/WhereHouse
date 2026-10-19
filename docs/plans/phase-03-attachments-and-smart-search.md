# Phase 03: Document & Photo Attachment Vault + Global Smart Search (`Cmd/Ctrl + K`)

> **Branch:** `feature/phase-03-attachments-and-smart-search`
> **Status:** Completed (`[ ]` Not Started | `[~]` In Progress | `[x]` Completed)
> **PRD Reference:** `docs/prd.md` — Sections 4.6.1 (`Multi-File Attachment Vault`), 4.7.1 (`Graveyard Search Behavior`), 4.8.1 (`Smart Search & Deep Filtering`), and 4.8.2 (`"Secret / Gift Mode" Privacy`)
> **Target Execution:** Run `/execute-phase` with your implementation model to execute this plan step-by-step.

---

## 1. Scope & Objectives

This phase completes **Milestone 1 (Core Foundation & Day-1 Data Capture)** by delivering the **Multi-File Attachment Vault** and **Global Smart Search (`Cmd/Ctrl + K`) with Deep Faceted Filtering**:

1. **Pluggable File Storage & Multi-File Attachment Vault (`IFileStorageService` & `ItemAttachment`):**
   - Items can store unlimited file attachments categorized by `AttachmentType`: `Photo` (`0`), `ReceiptInvoice` (`1`), `UserManual` (`2`), `WarrantyCard` (`3`), `SpecSheet` (`4`), `RepairLog` (`5`), or `Other` (`6`).
   - Supports designating a primary photo (`IsPrimaryPhoto`) per item, optional descriptive `Notes`, safe filename sanitization, file size validation (up to 50 MB), and authenticated streaming download (`GET /api/items/{itemId}/attachments/{attachmentId}/content`).
   - Local disk storage (`LocalDiskFileStorageService`) writes files under a configurable `FileStorage:RootPath` (`App_Data/uploads` in dev, `/app/data/uploads` in Docker on TrueNAS Scale, and an isolated temp folder in integration tests).
2. **Global Instant Smart Search (`GET /api/search` & `Cmd/Ctrl + K` Command Palette):**
   - Multi-token relevance search across:
     - **Locations & Movable Containers:** `Name`, `ShortCode` (`LOC-xxx`, `BIN-xxx`), `Description`, `ContainerStyle`, and `ColorLabel`.
     - **Active Inventory Items (`Status != Archived`):** `Name`, `ShortCode` (`ITM-xxx`), `Description`, `Aliases` (synonyms—e.g., searching *"Hex key"* matches an item with alias *"Hex key"*), `Tags`, `Brand`, `ModelNumber`, `SerialNumber`, `Category.Name`, custom `AttributeValues.Value`, and attached file names/notes (`Attachments.FileName`, `Attachments.Notes`).
     - **Collapsible "Found in Graveyard (Archived)" Section:** Matching items with `Status == ItemStatus.Archived` are returned in a dedicated `ArchivedItems` list so users searching for a disposed/donated/sold item immediately see its fate instead of hunting through physical bins.
3. **Deep Faceted Filtering:**
   - Supports filtering by **Location Subtree** (`locationId`), **Category** (`categoryId`), **Custom Template Attribute** (`attributeName`, `attributeValue`, numeric `attributeMinNumber` / `attributeMaxNumber`—e.g., `Length >= 6`), **Status** (`status`, `outOfPlaceOnly`, `lowStockOnly`), and `includeArchived`.
4. **"Secret / Gift Mode" (`IsPrivate`) Enforcement:**
   - Private items and items housed inside private containers/ancestors owned by another household user are strictly excluded from all search results and attachment endpoints (`403 Forbidden` on direct attachment list/upload/download/delete).

### Explicitly Out of Scope for Phase 03 (Deferred to Milestone 2+)
- Background OCR / full-text PDF body extraction worker (Milestone 4).
- Camera QR/Barcode scanning & PDF label sheet generation (Milestone 2).
- Check-in/Check-out state machine logs & Reusable Loadouts (Milestone 3).

---

## 2. File Inventory (Create / Modify)

### 2.1 Files to Create
- `WhereHouse.Core/Storage/FileStorageModels.cs`
- `WhereHouse.Core/Storage/IFileStorageService.cs`
- `WhereHouse.Core/Attachments/AttachmentModels.cs`
- `WhereHouse.Core/Attachments/IAttachmentService.cs`
- `WhereHouse.Core/Search/SearchModels.cs`
- `WhereHouse.Core/Search/ISearchService.cs`
- `WhereHouse.Infrastructure/Storage/LocalDiskFileStorageService.cs`
- `WhereHouse.Data/Entities/ItemAttachment.cs`
- `WhereHouse.Data/Configurations/ItemAttachmentConfiguration.cs`
- `WhereHouse.Data/Services/AttachmentService.cs`
- `WhereHouse.Data/Services/SearchService.cs`
- `WhereHouse.API/Controllers/AttachmentsController.cs`
- `WhereHouse.API/Controllers/SearchController.cs`
- `Tests/WhereHouse.Core.UnitTests/FileNameSanitizerTests.cs`
- `Tests/WhereHouse.Infrastructure.UnitTests/LocalDiskFileStorageServiceTests.cs`
- `Tests/WhereHouse.API.IntegrationTests/AttachmentAndSearchIntegrationTests.cs`
- `WhereHouse.Client/src/app/core/models/attachment.models.ts`
- `WhereHouse.Client/src/app/core/models/search.models.ts`
- `WhereHouse.Client/src/app/core/services/attachment/attachment.service.ts`
- `WhereHouse.Client/src/app/core/services/attachment/attachment.service.spec.ts`
- `WhereHouse.Client/src/app/core/services/search/search.service.ts`
- `WhereHouse.Client/src/app/core/services/search/search.service.spec.ts`
- `WhereHouse.Client/src/app/features/dashboard/item-attachments-dialog/item-attachments-dialog.component.ts`
- `WhereHouse.Client/src/app/features/dashboard/item-attachments-dialog/item-attachments-dialog.component.spec.ts`
- `WhereHouse.Client/src/app/features/dashboard/smart-search-dialog/smart-search-dialog.component.ts`
- `WhereHouse.Client/src/app/features/dashboard/smart-search-dialog/smart-search-dialog.component.spec.ts`

### 2.2 Files to Modify
- `WhereHouse.Core/Items/ItemModels.cs` (add `int AttachmentCount = 0, Guid? PrimaryPhotoAttachmentId = null` with default values to `ItemDto`)
- `WhereHouse.Data/Entities/InventoryItem.cs` (add `Attachments` navigation collection)
- `WhereHouse.Data/Entities/User.cs` (add `UploadedAttachments` navigation collection)
- `WhereHouse.Data/WhereHouseDbContext.cs` (add `ItemAttachments` `DbSet`)
- `WhereHouse.Data/DataServiceCollectionExtensions.cs` (register `IAttachmentService` and `ISearchService`)
- `WhereHouse.Data/Services/ItemService.cs` (include `Attachments` in item queries to populate `AttachmentCount` and `PrimaryPhotoAttachmentId`, and delete stored attachment files when deleting an item)
- `WhereHouse.Infrastructure/InfrastructureServiceCollectionExtensions.cs` (register `FileStorageOptions` and `IFileStorageService`)
- `Tests/WhereHouse.API.IntegrationTests/WhereHouseWebApplicationFactory.cs` (configure isolated temp directory for `FileStorage:RootPath`)
- `Tests/WhereHouse.API.IntegrationTests/OpenApiIntegrationTests.cs` (assert `/search` and `/items/{itemId}/attachments` paths)
- `WhereHouse.Client/src/app/core/models/item.models.ts` (add optional `attachmentCount?: number` and `primaryPhotoAttachmentId?: string | null` to `ItemDto`)
- `WhereHouse.Client/src/app/features/dashboard/dashboard.component.ts`
- `WhereHouse.Client/src/app/features/dashboard/dashboard.component.html`
- `WhereHouse.Client/src/app/features/dashboard/dashboard.component.scss`
- `WhereHouse.Client/src/app/features/dashboard/dashboard.component.spec.ts`

---

## 3. Domain, Storage & Database Design (`WhereHouse.Core`, `WhereHouse.Infrastructure`, `WhereHouse.Data`)

### 3.1 File Storage Abstraction (`WhereHouse.Core/Storage/` & `WhereHouse.Infrastructure/Storage/`)

#### `WhereHouse.Core/Storage/FileStorageModels.cs`
```csharp
namespace WhereHouse.Core.Storage;

public sealed class FileStorageOptions
{
    public const string SectionName = "FileStorage";

    public string RootPath { get; set; } = "App_Data/uploads";

    public long MaxFileSizeBytes { get; set; } = 50L * 1024L * 1024L; // 50 MB
}

public sealed record StoredFileResult(
    string StorageRelativePath,
    string SanitizedFileName,
    long FileSizeBytes
);

public static class FileNameSanitizer
{
    private static readonly char[] InvalidChars = Path.GetInvalidFileNameChars();

    public static string Sanitize(string? rawFileName)
    {
        if (string.IsNullOrWhiteSpace(rawFileName))
        {
            return "attachment.bin";
        }

        var fileNameOnly = Path.GetFileName(rawFileName.Trim());
        var sanitized = new string(
            fileNameOnly.Select(ch => InvalidChars.Contains(ch) ? '_' : ch).ToArray()
        ).Trim();

        if (string.IsNullOrWhiteSpace(sanitized) || sanitized is "." or "..")
        {
            return "attachment.bin";
        }

        return sanitized.Length > 200 ? sanitized[..200] : sanitized;
    }
}
```

#### `WhereHouse.Core/Storage/IFileStorageService.cs`
```csharp
namespace WhereHouse.Core.Storage;

public interface IFileStorageService
{
    Task<StoredFileResult> SaveFileAsync(
        Stream content,
        string originalFileName,
        CancellationToken cancellationToken = default
    );

    Task<Stream?> OpenReadAsync(
        string storageRelativePath,
        CancellationToken cancellationToken = default
    );

    Task DeleteFileAsync(
        string storageRelativePath,
        CancellationToken cancellationToken = default
    );
}
```

#### `WhereHouse.Infrastructure/Storage/LocalDiskFileStorageService.cs`
- Uses `IOptions<FileStorageOptions>` to resolve the root storage directory (`Path.GetFullPath(options.Value.RootPath)`).
- `SaveFileAsync`:
  - Sanitizes `originalFileName` via `FileNameSanitizer.Sanitize`.
  - Organizes files into date-partitioned subfolder `yyyy/MM/{Guid.NewGuid():N}_{sanitizedFileName}` (using forward slashes in `StorageRelativePath`).
  - Creates directory if needed, copies `content` stream to disk, and returns `StoredFileResult(relativePath, sanitizedFileName, fileInfo.Length)`.
- `OpenReadAsync`:
  - Resolves full path and verifies it starts with the normalized root path (preventing path traversal).
  - Returns `FileStream` (`FileMode.Open, FileAccess.Read, FileShare.Read`) if file exists, otherwise `null`.
- `DeleteFileAsync`:
  - Resolves full path, verifies path-traversal safety, and deletes the file if it exists.
- Register in `WhereHouse.Infrastructure/InfrastructureServiceCollectionExtensions.cs`:
  ```csharp
  services.Configure<FileStorageOptions>(configuration.GetSection(FileStorageOptions.SectionName));
  services.AddSingleton<IFileStorageService, LocalDiskFileStorageService>();
  ```

---

### 3.2 Attachment Models & Service Contract (`WhereHouse.Core/Attachments/`)

#### `WhereHouse.Core/Attachments/AttachmentModels.cs`
```csharp
using System.ComponentModel.DataAnnotations;

namespace WhereHouse.Core.Attachments;

public enum AttachmentType
{
    Photo = 0,
    ReceiptInvoice = 1,
    UserManual = 2,
    WarrantyCard = 3,
    SpecSheet = 4,
    RepairLog = 5,
    Other = 6,
}

public sealed record ItemAttachmentDto(
    Guid Id,
    Guid ItemId,
    AttachmentType AttachmentType,
    string FileName,
    string ContentType,
    long FileSizeBytes,
    string? Notes,
    bool IsPrimaryPhoto,
    Guid UploadedByUserId,
    DateTimeOffset CreatedAt,
    DateTimeOffset ModifiedAt
);

public sealed record AttachmentContentResult(
    Stream Content,
    string FileName,
    string ContentType,
    long FileSizeBytes
);

public sealed record UploadItemAttachmentRequest(
    AttachmentType AttachmentType = AttachmentType.Photo,
    [MaxLength(500)] string? Notes = null,
    bool IsPrimaryPhoto = false
);

public sealed record UpdateItemAttachmentRequest(
    AttachmentType AttachmentType,
    [MaxLength(500)] string? Notes = null,
    bool IsPrimaryPhoto = false
);
```

#### `WhereHouse.Core/Attachments/IAttachmentService.cs`
```csharp
namespace WhereHouse.Core.Attachments;

public interface IAttachmentService
{
    Task<IReadOnlyList<ItemAttachmentDto>> GetAttachmentsAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    );

    Task<ItemAttachmentDto?> UploadAttachmentAsync(
        Guid userId,
        Guid itemId,
        Stream fileStream,
        string originalFileName,
        string contentType,
        long fileSizeBytes,
        UploadItemAttachmentRequest request,
        CancellationToken cancellationToken = default
    );

    Task<AttachmentContentResult?> OpenAttachmentContentAsync(
        Guid userId,
        Guid itemId,
        Guid attachmentId,
        CancellationToken cancellationToken = default
    );

    Task<ItemAttachmentDto?> UpdateAttachmentAsync(
        Guid userId,
        Guid itemId,
        Guid attachmentId,
        UpdateItemAttachmentRequest request,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteAttachmentAsync(
        Guid userId,
        Guid itemId,
        Guid attachmentId,
        CancellationToken cancellationToken = default
    );
}
```

---

### 3.3 Smart Search Models & Service Contract (`WhereHouse.Core/Search/`)

#### `WhereHouse.Core/Search/SearchModels.cs`
```csharp
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.Core.Search;

public sealed record SmartSearchQuery(
    string? Query = null,
    Guid? LocationId = null,
    Guid? CategoryId = null,
    ItemType? ItemType = null,
    ItemStatus? Status = null,
    bool OutOfPlaceOnly = false,
    bool LowStockOnly = false,
    string? AttributeName = null,
    string? AttributeValue = null,
    decimal? AttributeMinNumber = null,
    decimal? AttributeMaxNumber = null,
    bool IncludeArchived = true
);

public sealed record LocationSearchHitDto(
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
    string FullPath,
    int ItemCount,
    int ChildCount
);

public sealed record SmartSearchResponseDto(
    string Query,
    IReadOnlyList<LocationSearchHitDto> Locations,
    IReadOnlyList<ItemDto> ActiveItems,
    IReadOnlyList<ItemDto> ArchivedItems,
    int TotalCount
);
```

#### `WhereHouse.Core/Search/ISearchService.cs`
```csharp
namespace WhereHouse.Core.Search;

public interface ISearchService
{
    Task<SmartSearchResponseDto> SearchAsync(
        Guid userId,
        SmartSearchQuery searchQuery,
        CancellationToken cancellationToken = default
    );
}
```

---

### 3.4 Entity & EF Core Configuration (`WhereHouse.Data`)

#### `WhereHouse.Data/Entities/ItemAttachment.cs`
```csharp
using WhereHouse.Core.Attachments;

namespace WhereHouse.Data.Entities;

public sealed class ItemAttachment : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ItemId { get; set; }

    public InventoryItem Item { get; set; } = null!;

    public AttachmentType AttachmentType { get; set; } = AttachmentType.Photo;

    public string FileName { get; set; } = string.Empty;

    public string ContentType { get; set; } = "application/octet-stream";

    public long FileSizeBytes { get; set; }

    public string StorageRelativePath { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public bool IsPrimaryPhoto { get; set; }

    public Guid UploadedByUserId { get; set; }

    public User UploadedByUser { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
```

#### Navigation & DbContext Updates
- In `WhereHouse.Data/Entities/InventoryItem.cs`:
  Add `public ICollection<ItemAttachment> Attachments { get; set; } = new List<ItemAttachment>();`
- In `WhereHouse.Data/Entities/User.cs`:
  Add `public ICollection<ItemAttachment> UploadedAttachments { get; set; } = new List<ItemAttachment>();`
- In `WhereHouse.Data/WhereHouseDbContext.cs`:
  Add `public DbSet<ItemAttachment> ItemAttachments => Set<ItemAttachment>();`

#### `WhereHouse.Data/Configurations/ItemAttachmentConfiguration.cs`
- Table: `"ItemAttachments"`
- Primary Key: `x.Id`
- `FileName`: `.IsRequired().HasMaxLength(255)`
- `ContentType`: `.IsRequired().HasMaxLength(128)`
- `StorageRelativePath`: `.IsRequired().HasMaxLength(500)`
- `Notes`: `.HasMaxLength(500)`
- `CreatedBy`, `ModifiedBy`: `.IsRequired().HasMaxLength(256)`
- Indexes: `builder.HasIndex(x => x.ItemId);`
- Relationships (**Critical SQL Server Cascade Rules**):
  - `Item`: `builder.HasOne(x => x.Item).WithMany(i => i.Attachments).HasForeignKey(x => x.ItemId).OnDelete(DeleteBehavior.Cascade);`
  - `UploadedByUser`: `builder.HasOne(x => x.UploadedByUser).WithMany(u => u.UploadedAttachments).HasForeignKey(x => x.UploadedByUserId).OnDelete(DeleteBehavior.Restrict);`

#### EF Core Migration
- Migration name: `AddItemAttachments`
  ```powershell
  .\scripts\ensure-local-infra.ps1
  dotnet ef migrations add AddItemAttachments --project WhereHouse.Data
  dotnet ef database update --project WhereHouse.Data
  dotnet csharpier format WhereHouse.Data/Migrations
  ```

---

### 3.5 Service Implementations (`WhereHouse.Data/Services/`)

#### `WhereHouse.Data/Services/AttachmentService.cs`
- Primary constructor: `public sealed class AttachmentService(WhereHouseDbContext dbContext, IFileStorageService fileStorageService) : IAttachmentService`
- **Privacy / Ownership Helper (`VerifyItemAccessAsync`):**
  - Loads the `InventoryItem` for `itemId`. If `null`, returns `null` (caller maps to `404 NotFound`).
  - Loads all `LocationNodes` to verify location ancestry privacy.
  - If `(item.IsPrivate && item.OwnerId != userId)` OR the item's `HomeLocationId` is inside any location node where `loc.IsPrivate && loc.OwnerId != userId`, throws `ForbiddenException("You do not have permission to access attachments for this private item.")`.
- **`GetAttachmentsAsync`**:
  - Calls `VerifyItemAccessAsync`. If item is `null`, throws `ArgumentException("Item not found.")` or returns empty list (Wait: let's return `IReadOnlyList<ItemAttachmentDto>?` or throw `KeyNotFoundException`? Even better: follow existing convention—return `null` from `GetAttachmentsAsync` if item doesn't exist so controller returns `NotFound()`, OR check item existence). Let's make `GetAttachmentsAsync` return `Task<IReadOnlyList<ItemAttachmentDto>?>` so `AttachmentsController` returns `NotFound()` when item does not exist!
  - Orders attachments by `IsPrimaryPhoto` descending, then `CreatedAt` descending.
- **`UploadAttachmentAsync`**:
  - Calls `VerifyItemAccessAsync`. If item is `null`, returns `null`.
  - Validates `fileSizeBytes > 0` and `fileSizeBytes <= 50 * 1024 * 1024` (throws `ArgumentException` if invalid).
  - Calls `await fileStorageService.SaveFileAsync(fileStream, originalFileName, cancellationToken)`.
  - If `request.IsPrimaryPhoto` is `true` (or if `request.AttachmentType == AttachmentType.Photo` and the item has no existing primary photo), sets `IsPrimaryPhoto = true` and unsets `IsPrimaryPhoto` on any existing attachments for that item.
  - Creates `ItemAttachment` record, updates `item.LastTouchedAt = DateTimeOffset.UtcNow`, saves changes, and returns `ItemAttachmentDto`.
- **`OpenAttachmentContentAsync`**:
  - Calls `VerifyItemAccessAsync`. Finds `ItemAttachment` matching `attachmentId` and `itemId`.
  - Calls `await fileStorageService.OpenReadAsync(attachment.StorageRelativePath, cancellationToken)`. If stream is `null`, returns `null`.
  - Returns `AttachmentContentResult(stream, attachment.FileName, attachment.ContentType, attachment.FileSizeBytes)`.
- **`UpdateAttachmentAsync`**:
  - Calls `VerifyItemAccessAsync`. Finds `ItemAttachment` matching `attachmentId` and `itemId`.
  - Updates `AttachmentType`, `Notes`, and `IsPrimaryPhoto` (if `request.IsPrimaryPhoto` is `true`, clears `IsPrimaryPhoto` on other attachments of this item).
  - Updates `item.LastTouchedAt = DateTimeOffset.UtcNow`, saves changes, and returns `ItemAttachmentDto`.
- **`DeleteAttachmentAsync`**:
  - Calls `VerifyItemAccessAsync`. Finds `ItemAttachment` matching `attachmentId` and `itemId`.
  - Removes entity from `dbContext.ItemAttachments`, saves changes, and calls `await fileStorageService.DeleteFileAsync(attachment.StorageRelativePath, cancellationToken)`.

#### Updates to `WhereHouse.Data/Services/ItemService.cs`
- Inject `IFileStorageService fileStorageService` into `ItemService`.
- Include `.Include(x => x.Attachments)` on item queries (`GetItemsAsync` and `GetItemByIdAsync`).
- In `MapToDto`:
  - `AttachmentCount = item.Attachments.Count`
  - `PrimaryPhotoAttachmentId = item.Attachments.Where(a => a.IsPrimaryPhoto).Select(a => (Guid?)a.Id).FirstOrDefault() ?? item.Attachments.Where(a => a.AttachmentType == AttachmentType.Photo).Select(a => (Guid?)a.Id).FirstOrDefault()`
- In `DeleteItemAsync`:
  - Before deleting the item, load its `Attachments` and delete each stored file via `fileStorageService.DeleteFileAsync`.

#### `WhereHouse.Data/Services/SearchService.cs`
- Primary constructor: `public sealed class SearchService(WhereHouseDbContext dbContext) : ISearchService`
- **`SearchAsync(Guid userId, SmartSearchQuery searchQuery, CancellationToken cancellationToken)`:**
  1. Loads all `LocationNodes` (`.AsNoTracking()`) and computes the `accessibleLocationIds` set (excluding any node or descendant of a node where `node.IsPrivate && node.OwnerId != userId`).
  2. If `searchQuery.LocationId.HasValue`:
     - Computes `subtreeLocationIds` for `searchQuery.LocationId.Value` (intersected with `accessibleLocationIds`).
  3. **Tokenization:**
     - Splits `searchQuery.Query` by whitespace into lowercase search tokens (`tokens`).
  4. **Location Matching (`LocationSearchHitDto`):**
     - Filters accessible locations (and within `subtreeLocationIds` if `LocationId` filter is set).
     - If `tokens.Length > 0`, matches locations where **every** token matches at least one of: `Name`, `ShortCode`, `Description`, `ContainerStyle`, `ColorLabel`, or `FullPath`.
     - If `tokens.Length == 0` and no location-relevant filter is active, returns top-level or filtered locations (up to 25).
     - Only includes locations when item-specific filters (`CategoryId`, `ItemType`, `Status`, `OutOfPlaceOnly`, `LowStockOnly`, `AttributeName`) are not restricting the search purely to items.
  5. **Item Matching & Deep Faceted Filtering (`ActiveItems` & `ArchivedItems`):**
     - Loads `InventoryItems` (`.AsNoTracking()`) with `.Include(x => x.Category)`, `.Include(x => x.ParentItem)`, `.Include(x => x.AttributeValues)`, `.Include(x => x.Attachments)`, `.Include(x => x.ChildItems)`.
     - **Privacy Filter:** Excludes items where `(item.IsPrivate && item.OwnerId != userId)` or `(item.HomeLocationId.HasValue && !accessibleLocationIds.Contains(item.HomeLocationId.Value))`.
     - **Facet Filters:**
       - `LocationId`: `item.HomeLocationId.HasValue && subtreeLocationIds.Contains(item.HomeLocationId.Value)`
       - `CategoryId`: `item.CategoryId == searchQuery.CategoryId.Value`
       - `ItemType`: `item.ItemType == searchQuery.ItemType.Value`
       - `Status`: `item.Status == searchQuery.Status.Value`
       - `OutOfPlaceOnly`: `item.Status is ItemStatus.InUse or ItemStatus.LoanedOut`
       - `LowStockOnly`: `item.ItemType == ItemType.Quantity && item.MinQuantity.HasValue && item.CurrentQuantity <= item.MinQuantity.Value`
       - **Custom Template Attribute Filter (`AttributeName`):**
         - Checks `item.AttributeValues` for an entry whose `AttributeName` matches `searchQuery.AttributeName` (case-insensitive):
           - If `searchQuery.AttributeValue` is provided (non-empty): `attr.Value.Contains(searchQuery.AttributeValue.Trim(), StringComparison.OrdinalIgnoreCase)`
           - If `searchQuery.AttributeMinNumber.HasValue`: parses `decimal.TryParse(attr.Value, out var num)` and requires `num >= searchQuery.AttributeMinNumber.Value`
           - If `searchQuery.AttributeMaxNumber.HasValue`: parses `decimal.TryParse(attr.Value, out var num)` and requires `num <= searchQuery.AttributeMaxNumber.Value`
     - **Multi-Token Query Matching (`tokens`):**
       - When `tokens.Length > 0`, every token must match at least one of:
         - `item.Name`
         - `item.ShortCode`
         - `item.Description`
         - `item.Aliases` (synonyms!)
         - `item.Tags`
         - `item.Brand`
         - `item.ModelNumber`
         - `item.SerialNumber`
         - `item.Category?.Name`
         - Home Location `FullPath` / `ShortCode`
         - Any `item.AttributeValues` (`AttributeName` or `Value`)
         - Any `item.Attachments` (`FileName` or `Notes`)
     - **Split Active vs. Graveyard (Archived):**
       - `ActiveItems`: matching items where `item.Status != ItemStatus.Archived` (unless `searchQuery.Status == ItemStatus.Archived`), ordered by relevance (exact `ShortCode` match $\rightarrow$ `Name` starts with query $\rightarrow$ `Name` contains query $\rightarrow$ alphabetical `Name`).
       - `ArchivedItems`: if `searchQuery.IncludeArchived` is `true`, matching items where `item.Status == ItemStatus.Archived`, ordered by `ModifiedAt` descending.

---

## 4. API Endpoints (`WhereHouse.API/Controllers/`)

### 4.1 `AttachmentsController` (`[Route("items/{itemId:guid}/attachments")]`, `[Authorize]`)

| Verb | Route (`/api/...`) | Request Body / Form | Response (`200`/`201`/`204`) | Error Cases (`400`/`403`/`404`) |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/items/{itemId:guid}/attachments` | — | `200 OK` (`IReadOnlyList<ItemAttachmentDto>`) | `403` if private item/container; `404` if item not found |
| `POST` | `/items/{itemId:guid}/attachments` | `multipart/form-data`: `IFormFile file`, `[FromForm] AttachmentType attachmentType = Photo`, `[FromForm] string? notes = null`, `[FromForm] bool isPrimaryPhoto = false` | `201 Created` (`ItemAttachmentDto`) | `400` if file missing/empty/`>50MB`; `403` if private; `404` if item not found |
| `GET` | `/items/{itemId:guid}/attachments/{attachmentId:guid}/content` | — | `200 OK` (`FileStreamResult` with `ContentType` & `FileDownloadName`) | `403` if private; `404` if item or attachment not found |
| `PATCH` | `/items/{itemId:guid}/attachments/{attachmentId:guid}` | `UpdateItemAttachmentRequest` (JSON) | `200 OK` (`ItemAttachmentDto`) | `403` if private; `404` if not found |
| `DELETE` | `/items/{itemId:guid}/attachments/{attachmentId:guid}` | — | `204 No Content` | `403` if private; `404` if not found |

### 4.2 `SearchController` (`[Route("search")]`, `[Authorize]`)

| Verb | Route (`/api/...`) | Query Parameters | Response (`200`) | Error Cases |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/search` | `q`, `locationId`, `categoryId`, `itemType`, `status`, `outOfPlaceOnly`, `lowStockOnly`, `attributeName`, `attributeValue`, `attributeMinNumber`, `attributeMaxNumber`, `includeArchived` | `200 OK` (`SmartSearchResponseDto`) | `401` if unauthenticated |

---

## 5. Angular Frontend Design (`WhereHouse.Client`)

### 5.1 TypeScript Models (`src/app/core/models/`)

1. **`src/app/core/models/attachment.models.ts`:**
   - `AttachmentType` (`0 | 1 | 2 | 3 | 4 | 5 | 6`) and `AttachmentTypes` const object (`Photo`, `ReceiptInvoice`, `UserManual`, `WarrantyCard`, `SpecSheet`, `RepairLog`, `Other`).
   - `ItemAttachmentDto`, `UpdateItemAttachmentRequest`.
2. **`src/app/core/models/search.models.ts`:**
   - `SmartSearchParams`, `LocationSearchHitDto`, `SmartSearchResponseDto`.
3. **Update `src/app/core/models/item.models.ts`:**
   - Add optional `attachmentCount?: number;` and `primaryPhotoAttachmentId?: string | null;` to `ItemDto`.

### 5.2 Angular Services (`src/app/core/services/`)

1. **`AttachmentService` (`src/app/core/services/attachment/attachment.service.ts`):**
   - Decorated with `@Service()`.
   - `getAttachments(itemId: string): Observable<ItemAttachmentDto[]>` $\rightarrow$ `GET /api/items/${itemId}/attachments`
   - `uploadAttachment(itemId: string, file: File, options?: { attachmentType?: AttachmentType; notes?: string | null; isPrimaryPhoto?: boolean }): Observable<ItemAttachmentDto>` $\rightarrow$ builds `FormData` (`file`, `attachmentType`, `notes`, `isPrimaryPhoto`) and posts to `apiUrl('/items/' + itemId + '/attachments')`.
   - `downloadAttachment(itemId: string, attachmentId: string): Observable<Blob>` $\rightarrow$ `this.http.get(apiUrl('/items/' + itemId + '/attachments/' + attachmentId + '/content'), { responseType: 'blob' })`
   - `updateAttachment(itemId: string, attachmentId: string, request: UpdateItemAttachmentRequest): Observable<ItemAttachmentDto>` $\rightarrow$ `PATCH /api/items/${itemId}/attachments/${attachmentId}`
   - `deleteAttachment(itemId: string, attachmentId: string): Observable<void>` $\rightarrow$ `DELETE /api/items/${itemId}/attachments/${attachmentId}`
2. **`SearchService` (`src/app/core/services/search/search.service.ts`):**
   - Decorated with `@Service()`.
   - `search(params: SmartSearchParams): Observable<SmartSearchResponseDto>` $\rightarrow$ `GET /api/search` with query parameters.

### 5.3 Feature Dialogs & Dashboard Integration (`src/app/features/dashboard/`)

1. **`ItemAttachmentsDialogComponent` (`src/app/features/dashboard/item-attachments-dialog/item-attachments-dialog.component.ts`):**
   - Opens for a given `ItemDto` (`MAT_DIALOG_DATA: { item: ItemDto }`).
   - **Upload Panel:** File input + `AttachmentType` select (`Photo`, `Receipt / Invoice`, `User Manual`, `Warranty Card`, `Spec Sheet`, `Repair Log`, `Other`), `Notes` field, `Primary Photo` checkbox, and **"Upload File"** button.
   - **Attachments List:** Displays each `ItemAttachmentDto` with:
     - Material icon per `AttachmentType` (`photo_camera`, `receipt_long`, `menu_book`, `verified_user`, `description`, `build`, `attach_file`).
     - File name, formatted byte size (`KB`/`MB`), attachment type label, notes, and `"Primary"` badge.
     - Actions: **Set Primary Photo** button (`star` / `star_border`), **Download / View** button (triggers blob download via `AttachmentService.downloadAttachment`), and **Delete** button.
2. **`SmartSearchDialogComponent` (`src/app/features/dashboard/smart-search-dialog/smart-search-dialog.component.ts`):**
   - Command Palette & Deep Filter modal (`MAT_DIALOG_DATA: { availableLocations: LocationNodeDto[]; availableCategories: CategoryDto[]; initialQuery?: string }`).
   - **Instant Search Input** + **Faceted Filters**:
     - Location Subtree selector (`locationId`)
     - Category selector (`categoryId`)
     - Dynamic Custom Attribute filter when a Category with `attributeTemplates` is selected (`attributeName` + `attributeValue` or `attributeMinNumber`)
     - Toggle filter chips: `Out of Place`, `Low Stock`, `Include Graveyard (Archived)`
   - **Results Sections:**
     - **Matching Locations & Containers:** Clicking a location closes the dialog with `{ action: 'selectLocation', locationId: loc.id }`.
     - **Matching Active Items:** Displays item cards/rows with ShortCode, Archetype, Location FullPath, Category, and actions (`Jump to Location`, `Open Attachments Vault`, `Edit Item`).
     - **Collapsible "Found in Graveyard (Archived)" Section:** Expandable banner showing archived items that matched the search query (`ArchivedItems`) so users know the item was previously archived/disposed.
3. **`DashboardComponent` (`dashboard.component.*`) Updates:**
   - Adds `host: { '(window:keydown)': 'onGlobalKeydown($event)' }` to `@Component` to intercept `Ctrl+K` / `Cmd+K` and open `SmartSearchDialogComponent`.
   - Adds a **"Smart Search (`Ctrl+K`)"** button next to the search bar in the top navigation bar.
   - Adds an **Attachments Vault (`attach_file` + `item.attachmentCount`)** badge/button on Item Cards and in the Item Card action menu (`"Attachments & Manuals"`) to open `ItemAttachmentsDialogComponent`.

---

## 6. Step-by-Step Execution Checklist (For Implementation Agent)

- [x] **Task 1: Backend Core, Infrastructure File Storage & Data Layer**
  - Create `WhereHouse.Core/Storage/FileStorageModels.cs` and `WhereHouse.Core/Storage/IFileStorageService.cs`.
  - Create `WhereHouse.Core/Attachments/AttachmentModels.cs` and `WhereHouse.Core/Attachments/IAttachmentService.cs`.
  - Create `WhereHouse.Core/Search/SearchModels.cs` and `WhereHouse.Core/Search/ISearchService.cs`.
  - Update `WhereHouse.Core/Items/ItemModels.cs` to add `int AttachmentCount = 0, Guid? PrimaryPhotoAttachmentId = null` to the end of `ItemDto`.
  - Create `WhereHouse.Infrastructure/Storage/LocalDiskFileStorageService.cs` and register it in `WhereHouse.Infrastructure/InfrastructureServiceCollectionExtensions.cs`.
  - Create `WhereHouse.Data/Entities/ItemAttachment.cs`, update `InventoryItem.cs` and `User.cs`, create `WhereHouse.Data/Configurations/ItemAttachmentConfiguration.cs` (with `DeleteBehavior.Cascade` on `Item` and `DeleteBehavior.Restrict` on `UploadedByUser`), and update `WhereHouseDbContext.cs`.
  - Implement `WhereHouse.Data/Services/AttachmentService.cs` and `WhereHouse.Data/Services/SearchService.cs`, update `ItemService.cs` to populate `AttachmentCount` and `PrimaryPhotoAttachmentId`, and register services in `DataServiceCollectionExtensions.cs`.
  - Ensure local SQL Server is running, then generate, apply, and format the EF Core migration:
    ```powershell
    .\scripts\ensure-local-infra.ps1
    dotnet ef migrations add AddItemAttachments --project WhereHouse.Data
    dotnet ef database update --project WhereHouse.Data
    dotnet csharpier format WhereHouse.Data/Migrations
    ```
  - Create unit tests in `Tests/WhereHouse.Core.UnitTests/FileNameSanitizerTests.cs` and `Tests/WhereHouse.Infrastructure.UnitTests/LocalDiskFileStorageServiceTests.cs`, then run unit tests:
    ```powershell
    dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj
    dotnet test --project Tests/WhereHouse.Infrastructure.UnitTests/WhereHouse.Infrastructure.UnitTests.csproj
    ```

- [x] **Task 2: API Controllers & Integration Tests**
  - Create `WhereHouse.API/Controllers/AttachmentsController.cs` and `WhereHouse.API/Controllers/SearchController.cs`.
  - Update `Tests/WhereHouse.API.IntegrationTests/WhereHouseWebApplicationFactory.cs` to configure an isolated temporary directory for `FileStorage:RootPath`.
  - Update `Tests/WhereHouse.API.IntegrationTests/OpenApiIntegrationTests.cs` to assert `"/search"` and `"/attachments"`.
  - Create `Tests/WhereHouse.API.IntegrationTests/AttachmentAndSearchIntegrationTests.cs` covering:
    1. Uploading a PDF manual and a Photo attachment to an item (`multipart/form-data`), verifying `AttachmentCount == 2` and `PrimaryPhotoAttachmentId` on `ItemDto`, downloading the binary content (`GET .../content`), updating attachment metadata, and deleting an attachment.
    2. Smart Search (`GET /api/search`): matching items by synonym `Aliases`, custom `AttributeValues`, and attached `FileName`/`Notes`, plus matching `LocationNodes` by `ShortCode` and `ColorLabel`.
    3. Faceted Deep Filtering: filtering by `locationId` subtree, `categoryId` + numeric custom attribute (`attributeName=Length&attributeMinNumber=6`), `outOfPlaceOnly`, and `lowStockOnly`.
    4. Graveyard Search Behavior: archiving an item (`Status = ItemStatus.Archived`) and verifying it is excluded from `ActiveItems` but returned in `ArchivedItems` when `includeArchived=true`.
    5. "Secret / Gift Mode" (`IsPrivate`) enforcement: verifying another household user receives `403 Forbidden` when attempting to list, upload, or download attachments on a private item or an item inside a private container, and that private items/locations never leak in `/api/search`.
  - Run integration tests until 100% green:
    ```powershell
    dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj
    ```

- [x] **Task 3: Angular Client & Unit Tests**
  - Create `src/app/core/models/attachment.models.ts` and `src/app/core/models/search.models.ts`, and update `src/app/core/models/item.models.ts`.
  - Create `AttachmentService` (`attachment.service.ts` & `.spec.ts`) and `SearchService` (`search.service.ts` & `.spec.ts`).
  - Create `ItemAttachmentsDialogComponent` (`.ts` & `.spec.ts`) and `SmartSearchDialogComponent` (`.ts` & `.spec.ts`).
  - Update `DashboardComponent` (`.ts`, `.html`, `.scss`, `.spec.ts`) with `Ctrl+K` / `Cmd+K` global shortcut, Smart Search button, and Item Attachment Vault dialog triggers.
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
  - Update `docs/plans/phase-03-attachments-and-smart-search.md` status to `[x] Completed`.
