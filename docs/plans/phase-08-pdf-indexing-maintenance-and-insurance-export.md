# Phase 08: PDF Manual Full-Text Indexing, Recurring Maintenance Schedules & Home Insurance Claim ZIP Export

> **Branch:** `feature/phase-08-pdf-indexing-maintenance-and-insurance-export`
> **Status:** [x] Completed
> **PRD Reference:** `docs/prd.md` — Sections 4.6.1 (`Multi-File Attachment Vault & PDF Full-Text Search`), 4.6.3 (`Recurring Maintenance & Battery Schedules`), 4.6.4 (`Home Insurance / Loss Claim Export`), 4.8.1 (`Smart Search PDF Manual Scope`), and 4.8.2 (`"Secret / Gift Mode" Privacy`)
> **Target Execution:** Run `/execute-phase` with your implementation model to execute this plan step-by-step.

---

## 1. Scope & Objectives

This phase begins **Milestone 4 (Advanced Vault & Automation)** by completing the entire **PRD Section 4.6 (Document Vault, Warranties, Maintenance & Insurance)** vertical slices:

1. **Full-Text PDF Manual & Document Indexing (`PdfTextExtractor`, `AttachmentService`, `SearchService`, PRD 4.6.1 & 4.8.1):**
   - Automatically extracts and indexes searchable text when a PDF (`application/pdf` / `.pdf`) or text document (`text/plain`, `text/markdown`, `text/csv`) is uploaded to an item's Attachment Vault, storing up to `32,000` characters in `ItemAttachment.ExtractedText`.
   - Uses a deterministic, zero-native-dependency C# `PdfTextExtractor` that parses both uncompressed and `FlateDecode` (`ZLibStream` / `DeflateStream`) PDF content streams, literal strings `(...)`, hex strings `<...>`, and UTF-8 text streams—plus optional manual text override (`ExtractedTextOverride`) on upload/update.
   - Enhances `SmartSearchQuery` (`GET /api/search`) with a toggleable `includeAttachmentText` flag (default `true`) so searching `"E04 error"`, `"CR2032"`, or `"filter part #"` surfaces matching items via their attached PDF manuals and repair logs.
   - Updates `ItemAttachmentsDialogComponent` to display an **"Indexed for Search"** badge and preview snippet for indexed documents, and updates `SmartSearchDialogComponent` with a **"Search PDF Manuals"** filter chip.

2. **Recurring Maintenance & Battery Schedules (`IMaintenanceService`, `MaintenanceController`, PRD 4.6.3):**
   - Allows any item to have one or more recurring `MaintenanceSchedule` definitions with a `Title` (e.g., *"Top-off Lithium Jump Starter to 80%"*, *"Replace Reverse Osmosis Filter"*, *"Descale Espresso Machine"*), `Description`, `IntervalValue`, `IntervalUnit` (`Days`, `Weeks`, `Months`, `Years`), `LastCompletedAt`, `NextDueAt`, and `IsActive`.
   - Computes real-time due status (`Overdue` when `NextDueAt < UtcNow`, `DueSoon` when `NextDueAt <= UtcNow.AddDays(14)`, `UpToDate`, or `Paused`).
   - Logging task completion (`POST /api/maintenance/schedules/{scheduleId}/complete`) appends an immutable `MaintenanceLog` history record (with `CompletedAt`, `CompletedByUsername`, `Notes`, and optional `Cost`), updates `LastCompletedAt`, advances `NextDueAt` by the configured interval, and updates the parent item's `LastTouchedAt` timestamp.

3. **Home Insurance / Loss Claim ZIP Export (`IInsuranceExportService`, `InsuranceController`, PRD 4.6.4):**
   - Provides a 1-click report builder and live valuation preview (`GET /api/insurance/preview`) filtering by **Location Subtree** (e.g., entire House or just Garage), **Category**, **Minimum Value Threshold** (`MinValue`), and `IncludeArchived`.
   - Generates a self-contained **ZIP archive** (`GET /api/insurance/export-zip`) containing:
     - `Insurance_Claim_Schedule.pdf` — A formatted, self-contained PDF 1.4 summary schedule listing report metadata, valuation totals (`TotalPurchaseValue`, `TotalReplacementValue`, `TotalEffectiveClaimValue`), and the itemized schedule table (`ShortCode`, `Name`, `Brand`, `Model`, `Serial #`, `Location`, `Purchase Date`, `Purchase Price`, `Replacement Value`).
     - `Insurance_Claim_Schedule.csv` — A UTF-8 CSV spreadsheet of the complete schedule with a totals summary row.
     - `Insurance_Claim_Summary.json` — Structured JSON metadata for digital archival.
     - Organized folders `Photos/<ShortCode>_<ItemName>/` and `Receipts_And_Documents/<ShortCode>_<ItemName>/` containing the physical item photos, receipt PDFs, warranty cards, and manuals retrieved via `IFileStorageService`.

4. **Out of Scope for Phase 08 (Deferred to Phase 09):**
   - The unified **Action Center Home Dashboard** overview cards and the **Webhook & Push Notification Engine** (`ntfy`, `Slack`, `Pushover`, `SMTP` + Weekly Household Digest) from PRD Section 4.8.3 will be delivered in Phase 09, consuming the Maintenance Schedules and Warranty/Return metadata completed here.

---

## 2. Domain & Database Design (`WhereHouse.Core` & `WhereHouse.Data`)

### 2.1 PDF Text Extraction & Attachment Model Updates (`WhereHouse.Core/Attachments/` & `WhereHouse.Core/Search/`)

1. **Update `WhereHouse.Core/Attachments/AttachmentModels.cs`:**
   - Add optional `ExtractedText` and `HasExtractedText` properties to `ItemAttachmentDto`, and optional `ExtractedTextOverride` to `UploadItemAttachmentRequest` and `UpdateItemAttachmentRequest`:
     ```csharp
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
         DateTimeOffset ModifiedAt,
         bool HasExtractedText = false,
         string? ExtractedText = null
     );

     public sealed record UploadItemAttachmentRequest(
         AttachmentType AttachmentType = AttachmentType.Photo,
         [MaxLength(500)] string? Notes = null,
         bool IsPrimaryPhoto = false,
         [MaxLength(32000)] string? ExtractedTextOverride = null
     );

     public sealed record UpdateItemAttachmentRequest(
         AttachmentType AttachmentType,
         [MaxLength(500)] string? Notes = null,
         bool IsPrimaryPhoto = false,
         [MaxLength(32000)] string? ExtractedTextOverride = null
     );
     ```

2. **Create `WhereHouse.Core/Attachments/PdfTextExtractor.cs`:**
   - Pure-C# static utility `public static class PdfTextExtractor`:
     - `public const int MaxExtractedTextLength = 32000;`
     - `public static string? ExtractText(byte[] fileBytes, string? contentType, string? fileName)`:
       - Returns `null` if `fileBytes` is null or empty.
       - Checks if the file is a PDF (`contentType` contains `"pdf"` case-insensitively, `fileName` ends with `".pdf"`, or `fileBytes` starts with ASCII `"%PDF-"`):
         - Parses the byte buffer for PDF stream objects (`stream` ... `endstream`) and top-level content:
           - For each stream, attempts decompression via `ZLibStream` (skipping 2-byte zlib header if needed with `DeflateStream` fallback) as well as scanning raw uncompressed stream bytes.
           - Extracts text operands from PDF text-showing operators: literal strings inside parentheses `(...)` (handling escaped `\n`, `\r`, `\t`, `\(`, `\)`, `\\`) and hex strings `<...>` (decoding hex byte pairs into printable characters).
       - Else if `contentType` starts with `"text/"` or `fileName` ends with `".txt"`, `".md"`, or `".csv"`:
         - Decodes `fileBytes` as UTF-8.
       - Normalizes consecutive whitespace into single spaces, trims, truncates to `MaxExtractedTextLength` (`32000`), and returns `null` if the resulting string is empty/whitespace.

3. **Update `WhereHouse.Core/Search/SearchModels.cs`:**
   - Add `bool IncludeAttachmentText = true` as the final parameter on `SmartSearchQuery`:
     ```csharp
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
         bool IncludeArchived = true,
         bool IncludeAttachmentText = true
     );
     ```

---

### 2.2 Maintenance Models & Service Contract (`WhereHouse.Core/Maintenance/`)

1. **Create `WhereHouse.Core/Maintenance/MaintenanceModels.cs`:**
   ```csharp
   using System.ComponentModel.DataAnnotations;

   namespace WhereHouse.Core.Maintenance;

   public enum MaintenanceIntervalUnit
   {
       Days = 0,
       Weeks = 1,
       Months = 2,
       Years = 3,
   }

   public enum MaintenanceDueStatus
   {
       UpToDate = 0,
       DueSoon = 1,
       Overdue = 2,
       Paused = 3,
   }

   public sealed record MaintenanceScheduleDto(
       Guid Id,
       Guid ItemId,
       string ItemShortCode,
       string ItemName,
       string? ItemLocationFullPath,
       string Title,
       string? Description,
       int IntervalValue,
       MaintenanceIntervalUnit IntervalUnit,
       DateTimeOffset? LastCompletedAt,
       DateTimeOffset NextDueAt,
       bool IsActive,
       MaintenanceDueStatus DueStatus,
       int DaysUntilDue,
       DateTimeOffset CreatedAt,
       DateTimeOffset ModifiedAt
   );

   public sealed record MaintenanceLogDto(
       Guid Id,
       Guid ScheduleId,
       Guid ItemId,
       string ItemShortCode,
       string ItemName,
       string ScheduleTitle,
       DateTimeOffset CompletedAt,
       Guid CompletedByUserId,
       string CompletedByUsername,
       string? Notes,
       decimal? Cost
   );

   public sealed record MaintenanceSummaryDto(
       int TotalActiveSchedules,
       int OverdueCount,
       int DueSoonCount,
       int UpToDateCount,
       IReadOnlyList<MaintenanceScheduleDto> Schedules,
       IReadOnlyList<MaintenanceLogDto> RecentLogs
   );

   public sealed record CreateMaintenanceScheduleRequest(
       [Required, MaxLength(200)] string Title,
       [MaxLength(1000)] string? Description = null,
       [Range(1, 3650)] int IntervalValue = 90,
       MaintenanceIntervalUnit IntervalUnit = MaintenanceIntervalUnit.Days,
       DateTimeOffset? FirstDueAt = null,
       DateTimeOffset? LastCompletedAt = null
   );

   public sealed record UpdateMaintenanceScheduleRequest(
       [Required, MaxLength(200)] string Title,
       [MaxLength(1000)] string? Description = null,
       [Range(1, 3650)] int IntervalValue = 90,
       MaintenanceIntervalUnit IntervalUnit = MaintenanceIntervalUnit.Days,
       DateTimeOffset? NextDueAt = null,
       bool IsActive = true
   );

   public sealed record CompleteMaintenanceTaskRequest(
       [MaxLength(1000)] string? Notes = null,
       [Range(0, 1000000)] decimal? Cost = null,
       DateTimeOffset? CompletedAt = null
   );
   ```

2. **Create `WhereHouse.Core/Maintenance/IMaintenanceService.cs`:**
   ```csharp
   namespace WhereHouse.Core.Maintenance;

   public interface IMaintenanceService
   {
       Task<MaintenanceSummaryDto> GetSummaryAsync(
           Guid userId,
           Guid? itemId = null,
           bool dueOnly = false,
           CancellationToken cancellationToken = default
       );

       Task<IReadOnlyList<MaintenanceScheduleDto>?> GetItemSchedulesAsync(
           Guid userId,
           Guid itemId,
           CancellationToken cancellationToken = default
       );

       Task<IReadOnlyList<MaintenanceLogDto>?> GetItemLogsAsync(
           Guid userId,
           Guid itemId,
           CancellationToken cancellationToken = default
       );

       Task<MaintenanceScheduleDto?> CreateScheduleAsync(
           Guid userId,
           Guid itemId,
           CreateMaintenanceScheduleRequest request,
           CancellationToken cancellationToken = default
       );

       Task<MaintenanceScheduleDto?> UpdateScheduleAsync(
           Guid userId,
           Guid scheduleId,
           UpdateMaintenanceScheduleRequest request,
           CancellationToken cancellationToken = default
       );

       Task<MaintenanceScheduleDto?> CompleteTaskAsync(
           Guid userId,
           Guid scheduleId,
           CompleteMaintenanceTaskRequest request,
           CancellationToken cancellationToken = default
       );

       Task<bool> DeleteScheduleAsync(
           Guid userId,
           Guid scheduleId,
           CancellationToken cancellationToken = default
       );
   }
   ```

---

### 2.3 Home Insurance / Loss Claim Export Models & Service Contract (`WhereHouse.Core/Insurance/`)

1. **Create `WhereHouse.Core/Insurance/InsuranceModels.cs`:**
   ```csharp
   using WhereHouse.Core.Items;

   namespace WhereHouse.Core.Insurance;

   public sealed record InsuranceClaimFilterQuery(
       Guid? LocationId = null,
       bool IncludeSubtree = true,
       Guid? CategoryId = null,
       decimal? MinValue = null,
       bool IncludeArchived = false,
       bool IncludeAttachments = true
   );

   public sealed record InsuranceClaimItemDto(
       Guid Id,
       string ShortCode,
       string Name,
       string? CategoryName,
       string? Brand,
       string? ModelNumber,
       string? SerialNumber,
       string LocationFullPath,
       ItemStatus Status,
       ItemCondition Condition,
       decimal Quantity,
       string? Unit,
       DateTimeOffset? PurchaseDate,
       string? Retailer,
       decimal? PurchasePrice,
       decimal? EstimatedReplacementValue,
       decimal EffectiveClaimValue,
       DateTimeOffset? WarrantyExpirationDate,
       int PhotoCount,
       int ReceiptAndDocCount
   );

   public sealed record InsuranceClaimPreviewDto(
       DateTimeOffset GeneratedAt,
       string ScopeDescription,
       int TotalItemsCount,
       decimal TotalQuantitySum,
       decimal TotalPurchaseValue,
       decimal TotalReplacementValue,
       decimal TotalEffectiveClaimValue,
       int TotalPhotoCount,
       int TotalReceiptAndDocCount,
       IReadOnlyList<InsuranceClaimItemDto> Items
   );

   public sealed record InsuranceExportArchiveResult(
       byte[] ZipBytes,
       string FileName,
       InsuranceClaimPreviewDto Summary
   );
   ```

2. **Create `WhereHouse.Core/Insurance/IInsuranceExportService.cs`:**
   ```csharp
   namespace WhereHouse.Core.Insurance;

   public interface IInsuranceExportService
   {
       Task<InsuranceClaimPreviewDto> GetClaimPreviewAsync(
           Guid userId,
           InsuranceClaimFilterQuery query,
           CancellationToken cancellationToken = default
       );

       Task<InsuranceExportArchiveResult> GenerateClaimZipAsync(
           Guid userId,
           InsuranceClaimFilterQuery query,
           CancellationToken cancellationToken = default
       );
   }
   ```

---

### 2.4 Entities & EF Core Fluent Configurations (`WhereHouse.Data`)

1. **Update `WhereHouse.Data/Entities/ItemAttachment.cs`:**
   - Add `public string? ExtractedText { get; set; }`.

2. **Update `WhereHouse.Data/Configurations/ItemAttachmentConfiguration.cs`:**
   - Add `builder.Property(x => x.ExtractedText).HasMaxLength(32000);`.

3. **Update `WhereHouse.Data/Entities/InventoryItem.cs`:**
   - Add navigation property:
     ```csharp
     public ICollection<MaintenanceSchedule> MaintenanceSchedules { get; set; } =
         new List<MaintenanceSchedule>();
     ```

4. **Create `WhereHouse.Data/Entities/MaintenanceSchedule.cs`:**
   ```csharp
   using WhereHouse.Core.Maintenance;

   namespace WhereHouse.Data.Entities;

   public sealed class MaintenanceSchedule : IAuditable
   {
       public Guid Id { get; set; } = Guid.NewGuid();

       public Guid ItemId { get; set; }

       public InventoryItem Item { get; set; } = null!;

       public string Title { get; set; } = string.Empty;

       public string? Description { get; set; }

       public int IntervalValue { get; set; } = 90;

       public MaintenanceIntervalUnit IntervalUnit { get; set; } = MaintenanceIntervalUnit.Days;

       public DateTimeOffset? LastCompletedAt { get; set; }

       public DateTimeOffset NextDueAt { get; set; }

       public bool IsActive { get; set; } = true;

       public Guid CreatedByUserId { get; set; }

       public ICollection<MaintenanceLog> Logs { get; set; } = new List<MaintenanceLog>();

       public DateTimeOffset CreatedAt { get; set; }

       public string CreatedBy { get; set; } = "System";

       public DateTimeOffset ModifiedAt { get; set; }

       public string ModifiedBy { get; set; } = "System";
   }
   ```

5. **Create `WhereHouse.Data/Entities/MaintenanceLog.cs`:**
   ```csharp
   namespace WhereHouse.Data.Entities;

   public sealed class MaintenanceLog : IAuditable
   {
       public Guid Id { get; set; } = Guid.NewGuid();

       public Guid ScheduleId { get; set; }

       public MaintenanceSchedule Schedule { get; set; } = null!;

       public Guid ItemId { get; set; }

       public DateTimeOffset CompletedAt { get; set; }

       public Guid CompletedByUserId { get; set; }

       public string CompletedByUsername { get; set; } = string.Empty;

       public string? Notes { get; set; }

       public decimal? Cost { get; set; }

       public DateTimeOffset CreatedAt { get; set; }

       public string CreatedBy { get; set; } = "System";

       public DateTimeOffset ModifiedAt { get; set; }

       public string ModifiedBy { get; set; } = "System";
   }
   ```

6. **Create `WhereHouse.Data/Configurations/MaintenanceScheduleConfiguration.cs`:**
   - Table `"MaintenanceSchedules"`, primary key `Id`.
   - `Title` required, max length `200`.
   - `Description` max length `1000`.
   - `CreatedBy` & `ModifiedBy` required, max length `256`.
   - Indexes on `ItemId`, `NextDueAt`, `IsActive`, and `CreatedByUserId`.
   - Relationship: `builder.HasOne(s => s.Item).WithMany(i => i.MaintenanceSchedules).HasForeignKey(s => s.ItemId).OnDelete(DeleteBehavior.Cascade);`.

7. **Create `WhereHouse.Data/Configurations/MaintenanceLogConfiguration.cs`:**
   - Table `"MaintenanceLogs"`, primary key `Id`.
   - `CompletedByUsername` required, max length `150`.
   - `Notes` max length `1000`.
   - `Cost` precision `(18, 2)`.
   - `CreatedBy` & `ModifiedBy` required, max length `256`.
   - Indexes on `ScheduleId`, `ItemId`, `CompletedByUserId`, and `CompletedAt`.
   - Relationship: `builder.HasOne(l => l.Schedule).WithMany(s => s.Logs).HasForeignKey(l => l.ScheduleId).OnDelete(DeleteBehavior.Cascade);`.
   - **SQL Server Note:** `ItemId` is kept as a scalar indexed `Guid` column on `MaintenanceLog` (without a second `InventoryItem` foreign key cascade) so deleting an `InventoryItem` cascades cleanly through `MaintenanceSchedule -> MaintenanceLog` without triggering SQL Server multiple-cascade-path errors.

8. **Update `WhereHouse.Data/WhereHouseDbContext.cs`:**
   - Add `public DbSet<MaintenanceSchedule> MaintenanceSchedules => Set<MaintenanceSchedule>();`
   - Add `public DbSet<MaintenanceLog> MaintenanceLogs => Set<MaintenanceLog>();`

9. **EF Core Migration Name:**
   - `AddPdfIndexingAndMaintenanceSchedules`

---

### 2.5 Service Implementations & Business Invariants (`WhereHouse.Data/Services/`)

1. **Update `WhereHouse.Data/Services/AttachmentService.cs`:**
   - In `UploadAttachmentAsync`:
     - Copy the incoming `fileStream` into a `MemoryStream` (so it can be read both by `fileStorageService.SaveFileAsync` and by `PdfTextExtractor`).
     - If `!string.IsNullOrWhiteSpace(request.ExtractedTextOverride)`, set `attachment.ExtractedText = request.ExtractedTextOverride.Trim()`.
     - Otherwise, call `PdfTextExtractor.ExtractText(memoryStream.ToArray(), contentType, originalFileName)` and store the result in `attachment.ExtractedText`.
   - In `UpdateAttachmentAsync`:
     - If `request.ExtractedTextOverride is not null`, set `attachment.ExtractedText = string.IsNullOrWhiteSpace(request.ExtractedTextOverride) ? null : request.ExtractedTextOverride.Trim()`.
   - In `MapToDto`:
     - Populate `HasExtractedText: !string.IsNullOrWhiteSpace(a.ExtractedText)` and `ExtractedText: a.ExtractedText`.

2. **Update `WhereHouse.Data/Services/SearchService.cs`:**
   - In `SearchAsync` token matching (`tokens.All(t => ...)`):
     - Add condition:
       ```csharp
       || (
           searchQuery.IncludeAttachmentText
           && itm.Attachments.Any(a =>
               a.ExtractedText != null
               && a.ExtractedText.Contains(t, StringComparison.OrdinalIgnoreCase)
           )
       )
       ```

3. **Create `WhereHouse.Data/Services/MaintenanceService.cs`:**
   - **Privacy Invariant (`IsPrivate`):**
     - Load all `LocationNodes` (`AsNoTracking()`) and compute `accessibleLocationIds` for `userId`.
     - For item-specific methods (`GetItemSchedulesAsync`, `GetItemLogsAsync`, `CreateScheduleAsync`), verify item existence (`null` if not found) and verify the item is not private to another user (`item.IsPrivate && item.OwnerId != userId`) and its `HomeLocationId` is in `accessibleLocationIds` (throw `ForbiddenException` if restricted).
     - For `UpdateScheduleAsync`, `CompleteTaskAsync`, and `DeleteScheduleAsync`, load the schedule with `.Include(s => s.Item)`, return `null`/`false` if not found, and throw `ForbiddenException` if the parent item or its location is private to another user.
     - For `GetSummaryAsync`, filter schedules and logs to only those whose parent `Item` is accessible to `userId` and `Item.Status != ItemStatus.Archived`.
   - **Interval Calculation Helper (`ComputeNextDueDate`):**
     - Given a base `DateTimeOffset fromDate`, `int intervalValue`, and `MaintenanceIntervalUnit unit`:
       - `Days` $\rightarrow$ `fromDate.AddDays(intervalValue)`
       - `Weeks` $\rightarrow$ `fromDate.AddDays(intervalValue * 7)`
       - `Months` $\rightarrow$ `fromDate.AddMonths(intervalValue)`
       - `Years` $\rightarrow$ `fromDate.AddYears(intervalValue)`
   - **Due Status Calculation (`ComputeDueStatus`):**
     - If `!schedule.IsActive` $\rightarrow$ `MaintenanceDueStatus.Paused`
     - Else if `schedule.NextDueAt < utcNow` $\rightarrow$ `MaintenanceDueStatus.Overdue`
     - Else if `schedule.NextDueAt <= utcNow.AddDays(14)` $\rightarrow$ `MaintenanceDueStatus.DueSoon`
     - Else $\rightarrow$ `MaintenanceDueStatus.UpToDate`
     - `DaysUntilDue = (int)Math.Ceiling((schedule.NextDueAt - utcNow).TotalDays)`
   - **`CreateScheduleAsync`:**
     - Validates `Title` is not empty and `IntervalValue >= 1`.
     - Computes `NextDueAt`: if `request.FirstDueAt.HasValue`, use `request.FirstDueAt.Value`; else if `request.LastCompletedAt.HasValue`, compute `ComputeNextDueDate(request.LastCompletedAt.Value, request.IntervalValue, request.IntervalUnit)`; else compute `ComputeNextDueDate(DateTimeOffset.UtcNow, request.IntervalValue, request.IntervalUnit)`.
     - Saves `MaintenanceSchedule` and updates `item.LastTouchedAt = DateTimeOffset.UtcNow`.
   - **`CompleteTaskAsync`:**
     - Resolves `completedAt = request.CompletedAt ?? DateTimeOffset.UtcNow`.
     - Resolves `username` from `dbContext.Users` for `userId` (fallback `"Household User"`).
     - Creates a `MaintenanceLog` record (`ScheduleId`, `ItemId`, `CompletedAt = completedAt`, `CompletedByUserId = userId`, `CompletedByUsername = username`, `Notes = request.Notes?.Trim()`, `Cost = request.Cost`).
     - Updates `schedule.LastCompletedAt = completedAt` and `schedule.NextDueAt = ComputeNextDueDate(completedAt, schedule.IntervalValue, schedule.IntervalUnit)`.
     - Updates `schedule.Item.LastTouchedAt = DateTimeOffset.UtcNow`.

4. **Create `WhereHouse.Data/Services/InsuranceExportService.cs`:**
   - Injects `WhereHouseDbContext dbContext` and `IFileStorageService fileStorageService`.
   - **Privacy & Filter Resolution (`GetClaimPreviewAsync`):**
     - Loads all `LocationNodes` (`AsNoTracking()`) and computes `accessibleLocationIds`.
     - If `query.LocationId.HasValue`:
       - If the location does not exist, throw `ArgumentException("Selected location does not exist.")`.
       - If `!accessibleLocationIds.Contains(query.LocationId.Value)`, throw `ForbiddenException("You do not have permission to export this private location.")`.
       - Computes `subtreeIds = query.IncludeSubtree ? ComputeSubtreeLocationIds(allLocations, query.LocationId.Value) : [query.LocationId.Value]`, intersected with `accessibleLocationIds`.
     - Queries `InventoryItems.AsNoTracking().Include(i => i.Category).Include(i => i.Attachments)`.
     - Filters items:
       - Exclude items where `i.IsPrivate && i.OwnerId != userId`.
       - Exclude items where `i.HomeLocationId.HasValue && !accessibleLocationIds.Contains(i.HomeLocationId.Value)`.
       - If ` `!query.IncludeArchived` `, exclude `i.Status == ItemStatus.Archived`.
       - If `subtreeIds != null`, require `i.HomeLocationId.HasValue && subtreeIds.Contains(i.HomeLocationId.Value)`.
       - If `query.CategoryId.HasValue`, require `i.CategoryId == query.CategoryId.Value`.
     - For each candidate item:
       - `unitValue = i.EstimatedReplacementValue ?? i.PurchasePrice ?? 0m;`
       - `multiplier = i.ItemType == ItemType.Quantity ? Math.Max(0m, i.CurrentQuantity) : 1m;`
       - `effectiveClaimValue = Math.Round(unitValue * multiplier, 2);`
       - If `query.MinValue.HasValue && effectiveClaimValue < query.MinValue.Value`, skip the item.
     - Orders items by `LocationFullPath`, then `Name`.
     - Computes summary totals (`TotalItemsCount`, `TotalQuantitySum`, `TotalPurchaseValue`, `TotalReplacementValue`, `TotalEffectiveClaimValue`, `TotalPhotoCount`, `TotalReceiptAndDocCount`).
   - **ZIP Package Generation (`GenerateClaimZipAsync`):**
     - Calls `GetClaimPreviewAsync(userId, query, cancellationToken)`.
     - Builds an in-memory `MemoryStream` with `ZipArchive(memoryStream, ZipArchiveMode.Create, leaveOpen: true)`:
       1. `Insurance_Claim_Schedule.csv` — UTF-8 CSV containing header row, one row per `InsuranceClaimItemDto`, and a final `TOTALS` summary row.
       2. `Insurance_Claim_Schedule.pdf` — Valid PDF 1.4 document generated via a deterministic helper `BuildClaimSchedulePdfBytes(preview)` containing the report header (`WhereHouse — Home Insurance & Loss Claim Schedule`), generation timestamp, scope & valuation summary lines, and itemized lines (`ShortCode | Name | Brand/Model | Serial # | Location | Value`).
       3. `Insurance_Claim_Summary.json` — Indented JSON serialization of `InsuranceClaimPreviewDto`.
       4. When `query.IncludeAttachments` is `true`:
          - Queries `ItemAttachments.AsNoTracking()` for all included item IDs.
          - For each attachment, opens the file via `await fileStorageService.OpenReadAsync(att.StorageRelativePath, cancellationToken)`. If stream is non-null:
            - Folder prefix is `Photos/` if `att.AttachmentType == AttachmentType.Photo`, otherwise `Receipts_And_Documents/`.
            - Subfolder is `<ShortCode>_<SanitizedItemName>/` and entry name is `<AttachmentIdShort>_<FileName>` to prevent collisions.
            - Copies stream into the ZIP entry.
     - Returns `InsuranceExportArchiveResult` with filename `WhereHouse_Insurance_Claim_<yyyyMMdd>.zip`.

5. **Register Services in `WhereHouse.Data/DataServiceCollectionExtensions.cs`:**
   - `services.AddScoped<IMaintenanceService, MaintenanceService>();`
   - `services.AddScoped<IInsuranceExportService, InsuranceExportService>();`

---

## 3. API Endpoints (`WhereHouse.API/Controllers/`)

### 3.1 Updated `SearchController.cs` (`/api/search`)

| Verb | Route (`/api/...`) | Query Parameters | Response |
| :--- | :--- | :--- | :--- |
| `GET` | `/search` | Existing params + `includeAttachmentText = true` | `200 OK` (`SmartSearchResponseDto`) |

### 3.2 `MaintenanceController.cs` (`WhereHouse.API/Controllers/MaintenanceController.cs`)
- Attributes: `[ApiController]`, `[Route("maintenance")]`, `[Authorize]`.

| Verb | Route (`/api/...`) | Request Body / Query | Response | Error Cases |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/maintenance` | `?itemId=&dueOnly=false` | `200 OK` (`MaintenanceSummaryDto`) | — |
| `GET` | `/maintenance/items/{itemId:guid}/schedules` | — | `200 OK` (`IReadOnlyList<MaintenanceScheduleDto>`) | `403`, `404` |
| `GET` | `/maintenance/items/{itemId:guid}/logs` | — | `200 OK` (`IReadOnlyList<MaintenanceLogDto>`) | `403`, `404` |
| `POST` | `/maintenance/items/{itemId:guid}/schedules` | `CreateMaintenanceScheduleRequest` | `201 Created` (`MaintenanceScheduleDto`) | `400`, `403`, `404` |
| `PUT` | `/maintenance/schedules/{scheduleId:guid}` | `UpdateMaintenanceScheduleRequest` | `200 OK` (`MaintenanceScheduleDto`) | `400`, `403`, `404` |
| `POST` | `/maintenance/schedules/{scheduleId:guid}/complete` | `CompleteMaintenanceTaskRequest` | `200 OK` (`MaintenanceScheduleDto`) | `400`, `403`, `404` |
| `DELETE` | `/maintenance/schedules/{scheduleId:guid}` | — | `204 No Content` | `403`, `404` |

### 3.3 `InsuranceController.cs` (`WhereHouse.API/Controllers/InsuranceController.cs`)
- Attributes: `[ApiController]`, `[Route("insurance")]`, `[Authorize]`.

| Verb | Route (`/api/...`) | Query Parameters | Response | Error Cases |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/insurance/preview` | `?locationId=&includeSubtree=true&categoryId=&minValue=&includeArchived=false&includeAttachments=true` | `200 OK` (`InsuranceClaimPreviewDto`) | `400`, `403` |
| `GET` | `/insurance/export-zip` | `?locationId=&includeSubtree=true&categoryId=&minValue=&includeArchived=false&includeAttachments=true` | `200 OK` (`application/zip` file download) | `400`, `403` |

---

## 4. Angular Frontend Design (`WhereHouse.Client`)

### 4.1 Models & Services (`src/app/core/`)

1. **Update `src/app/core/models/attachment.models.ts`:**
   - Add `hasExtractedText?: boolean;` and `extractedText?: string | null;` to `ItemAttachmentDto`.
   - Add `extractedTextOverride?: string | null;` to `UpdateItemAttachmentRequest`.

2. **Update `src/app/core/models/search.models.ts` & `src/app/core/services/search/search.service.ts`:**
   - Add `includeAttachmentText?: boolean;` to `SmartSearchParams` and pass `includeAttachmentText` query param in `SearchService.search()`.

3. **Create `src/app/core/models/maintenance.models.ts`:**
   - Define `MaintenanceIntervalUnit` (`0 | 1 | 2 | 3`), `MaintenanceIntervalUnits`, `MAINTENANCE_INTERVAL_LABELS`, `MaintenanceDueStatus` (`0 | 1 | 2 | 3`), `MaintenanceDueStatuses`, `MaintenanceScheduleDto`, `MaintenanceLogDto`, `MaintenanceSummaryDto`, `CreateMaintenanceScheduleRequest`, `UpdateMaintenanceScheduleRequest`, and `CompleteMaintenanceTaskRequest`.

4. **Create `src/app/core/services/maintenance/maintenance.service.ts` (& `.spec.ts`):**
   - Decorated with `@Service()`, wrapping `/maintenance` endpoints via `apiUrl(...)`:
     - `getSummary(itemId?: string | null, dueOnly?: boolean): Observable<MaintenanceSummaryDto>`
     - `getItemSchedules(itemId: string): Observable<MaintenanceScheduleDto[]>`
     - `getItemLogs(itemId: string): Observable<MaintenanceLogDto[]>`
     - `createSchedule(itemId: string, request: CreateMaintenanceScheduleRequest): Observable<MaintenanceScheduleDto>`
     - `updateSchedule(scheduleId: string, request: UpdateMaintenanceScheduleRequest): Observable<MaintenanceScheduleDto>`
     - `completeTask(scheduleId: string, request: CompleteMaintenanceTaskRequest): Observable<MaintenanceScheduleDto>`
     - `deleteSchedule(scheduleId: string): Observable<void>`

5. **Create `src/app/core/models/insurance.models.ts`:**
   - Define `InsuranceClaimFilterParams`, `InsuranceClaimItemDto`, and `InsuranceClaimPreviewDto`.

6. **Create `src/app/core/services/insurance/insurance.service.ts` (& `.spec.ts`):**
   - Decorated with `@Service()`, wrapping `/insurance` endpoints via `apiUrl(...)`:
     - `getPreview(params: InsuranceClaimFilterParams): Observable<InsuranceClaimPreviewDto>`
     - `exportZip(params: InsuranceClaimFilterParams): Observable<Blob>`

---

### 4.2 Dialogs & Component Enhancements (`src/app/features/dashboard/`)

1. **Create `MaintenanceDialogComponent` (`src/app/features/dashboard/maintenance-dialog/maintenance-dialog.component.ts` & `.spec.ts`):**
   - Accepts `MaintenanceDialogData { item?: ItemDto | null; availableItems?: ItemDto[] }`.
   - **Header & Summary Strip:** Shows `OverdueCount` (red badge), `DueSoonCount` (amber badge), `UpToDateCount` (green badge), and `TotalActiveSchedules`.
   - **Two Tabs (`schedules` | `history`):**
     - **Tab 1 — Active Schedules & New Schedule Builder:**
       - Collapsible/inline **"Add Maintenance Schedule"** panel with:
         - Item selector (pre-locked if opened for a specific `item`, or selectable from `availableItems` when opened globally from the toolbar).
         - Quick preset chips (*"Top-off Battery to 80% (90d)"*, *"Replace Filter (6mo)"*, *"Descale / Clean (3mo)"*, *"Annual Safety Inspection (1yr)"*).
         - `Title`, `IntervalValue`, `IntervalUnit`, and `Description` inputs.
       - Filter toggle (`All Schedules` vs. `Due & Overdue Only`).
       - Schedule list showing each task's `Title`, item badge (`ItemShortCode` + `ItemName`), `ItemLocationFullPath`, due status pill (`OVERDUE`, `DUE SOON`, `UP TO DATE`), `NextDueAt | date:'mediumDate'`, `LastCompletedAt`, and 1-tap **"Complete Task"** button (`task_alt` icon, with optional inline completion note/cost) + Delete button.
     - **Tab 2 — Maintenance History Log (`history`):**
       - Displays `RecentLogs` with `CompletedAt | date:'medium'`, `ScheduleTitle`, `ItemName`, `CompletedByUsername`, `Notes`, and `Cost | currency`.

2. **Create `InsuranceExportDialogComponent` (`src/app/features/dashboard/insurance-export-dialog/insurance-export-dialog.component.ts` & `.spec.ts`):**
   - Accepts `InsuranceExportDialogData { availableLocations: LocationNodeDto[]; availableCategories: CategoryDto[] }`.
   - **Filter Bar:**
     - `Location Subtree` select (`All Household Locations` or any room/rack/bin), `Category` select (`All Categories`), `Minimum Value ($)` number input, `Include Archived Items` checkbox, and `Include Photos & Receipts in ZIP` checkbox.
   - **Valuation Summary Banner:**
     - Displays `TotalItemsCount`, `TotalPurchaseValue | currency`, `TotalReplacementValue | currency`, **`TotalEffectiveClaimValue | currency`**, and `TotalPhotoCount + TotalReceiptAndDocCount` attached files.
   - **Itemized Schedule Preview List:**
     - Scrollable list/table showing `ShortCode`, `Name`, `Brand` / `ModelNumber`, `SerialNumber`, `LocationFullPath`, `Quantity`, `EffectiveClaimValue | currency`, and attachment badges (`PhotoCount` photos, `ReceiptAndDocCount` docs).
   - **Primary Action Footer:**
     - **"Download Claim Package (.ZIP)"** button (`folder_zip` icon) that calls `insuranceService.exportZip(...)` and triggers browser download of `WhereHouse_Insurance_Claim_<date>.zip`.

3. **Update `ItemAttachmentsDialogComponent` (`item-attachments-dialog.component.ts`) & `SmartSearchDialogComponent` (`smart-search-dialog.component.ts`):**
   - In `ItemAttachmentsDialogComponent`: display an **"Indexed Text"** chip (`find_in_page`) on attachments where `att.hasExtractedText` is `true` (with tooltip showing a preview of `att.extractedText`).
   - In `SmartSearchDialogComponent`: add a **"Search PDF Manuals"** filter chip bound to `includeAttachmentText` signal (default `true`).

4. **Update `DashboardComponent` (`dashboard.component.ts`, `.html`, `.scss`, `.spec.ts`):**
   - Add **"Maintenance"** button (`build_circle` icon) and **"Insurance Claim"** button (`verified_user` icon) in the top navigation bar.
   - Add **"Maintenance Schedules..."** (`build_circle` icon) in each item card's overflow action menu (`mat-menu`) opening `MaintenanceDialogComponent` scoped to that item.

---

## 5. Step-by-Step Execution Checklist (For Implementation Agent)

- [x] **Task 1: Backend Core & Data Layer (`WhereHouse.Core` & `WhereHouse.Data`)**
  - Update `WhereHouse.Core/Attachments/AttachmentModels.cs` and create `WhereHouse.Core/Attachments/PdfTextExtractor.cs`.
  - Update `WhereHouse.Core/Search/SearchModels.cs` with `IncludeAttachmentText = true`.
  - Create `WhereHouse.Core/Maintenance/MaintenanceModels.cs` and `WhereHouse.Core/Maintenance/IMaintenanceService.cs`.
  - Create `WhereHouse.Core/Insurance/InsuranceModels.cs` and `WhereHouse.Core/Insurance/IInsuranceExportService.cs`.
  - Update `WhereHouse.Data/Entities/ItemAttachment.cs`, `WhereHouse.Data/Configurations/ItemAttachmentConfiguration.cs`, and `WhereHouse.Data/Entities/InventoryItem.cs`.
  - Create `WhereHouse.Data/Entities/MaintenanceSchedule.cs`, `WhereHouse.Data/Entities/MaintenanceLog.cs`, `WhereHouse.Data/Configurations/MaintenanceScheduleConfiguration.cs`, and `WhereHouse.Data/Configurations/MaintenanceLogConfiguration.cs`.
  - Update `WhereHouse.Data/WhereHouseDbContext.cs` with `MaintenanceSchedules` and `MaintenanceLogs` `DbSet`s.
  - Update `WhereHouse.Data/Services/AttachmentService.cs` and `WhereHouse.Data/Services/SearchService.cs`.
  - Implement `WhereHouse.Data/Services/MaintenanceService.cs` and `WhereHouse.Data/Services/InsuranceExportService.cs`, and register both in `WhereHouse.Data/DataServiceCollectionExtensions.cs`.
  - Ensure local SQL Server is running, then generate, apply, and format the EF Core migration:
    ```powershell
    .\scripts\ensure-local-infra.ps1
    dotnet ef migrations add AddPdfIndexingAndMaintenanceSchedules --project WhereHouse.Data
    dotnet ef database update --project WhereHouse.Data
    dotnet csharpier format WhereHouse.Data/Migrations
    ```
  - Add unit tests for `PdfTextExtractor` in `Tests/WhereHouse.Core.UnitTests` and run:
    ```powershell
    dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj
    ```

- [x] **Task 2: API Controllers & Integration Tests (`WhereHouse.API` & `Tests/WhereHouse.API.IntegrationTests`)**
  - Update `WhereHouse.API/Controllers/SearchController.cs` to accept `includeAttachmentText`.
  - Create `WhereHouse.API/Controllers/MaintenanceController.cs` and `WhereHouse.API/Controllers/InsuranceController.cs`.
  - Update `Tests/WhereHouse.API.IntegrationTests/OpenApiIntegrationTests.cs` to assert `"/maintenance"` and `"/insurance"`.
  - Create `Tests/WhereHouse.API.IntegrationTests/Phase08VaultAndAutomationIntegrationTests.cs` covering:
    1. **PDF Manual Full-Text Extraction & Search (`PRD 4.6.1 & 4.8.1`):** Uploading a PDF attachment containing error codes/part numbers (e.g., `"Error E04 replacement filter part WH-9921"`), verifying `ItemAttachmentDto.HasExtractedText` is `true`, verifying `GET /api/search?q=WH-9921` finds the item when `includeAttachmentText=true`, and verifying `GET /api/search?q=WH-9921&includeAttachmentText=false` omits it.
    2. **Recurring Maintenance Schedules & Completion History (`PRD 4.6.3`):** Creating a maintenance schedule on an item, verifying due status calculation in `GET /api/maintenance`, logging task completion via `POST /api/maintenance/schedules/{id}/complete` with notes and cost, verifying `NextDueAt` advances by the interval and `MaintenanceLogDto` is recorded in `GET /api/maintenance/items/{itemId}/logs`.
    3. **Home Insurance Claim Preview & ZIP Package Export (`PRD 4.6.4`):** Creating items with purchase/replacement values and photo + receipt attachments, verifying `GET /api/insurance/preview` filters by location subtree and `minValue` and calculates accurate `TotalEffectiveClaimValue`, and verifying `GET /api/insurance/export-zip` returns a valid ZIP archive containing `Insurance_Claim_Schedule.pdf`, `Insurance_Claim_Schedule.csv`, `Insurance_Claim_Summary.json`, `Photos/...`, and `Receipts_And_Documents/...`.
    4. **"Secret / Gift Mode" (`IsPrivate`) Isolation:** Verifying User B cannot create/view/complete maintenance schedules on User A's private items (`403 Forbidden` / omitted from summary) and User A's private items/locations are excluded from User B's insurance preview and ZIP export.
  - Run integration tests until 100% green:
    ```powershell
    dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj
    ```

- [x] **Task 3: Angular Client & Unit Tests (`WhereHouse.Client`)**
  - Update `src/app/core/models/attachment.models.ts`, `src/app/core/models/search.models.ts`, and `src/app/core/services/search/search.service.ts`.
  - Create `src/app/core/models/maintenance.models.ts` and `src/app/core/services/maintenance/maintenance.service.ts` (& `.spec.ts`).
  - Create `src/app/core/models/insurance.models.ts` and `src/app/core/services/insurance/insurance.service.ts` (& `.spec.ts`).
  - Create `MaintenanceDialogComponent` (`src/app/features/dashboard/maintenance-dialog/maintenance-dialog.component.ts` & `.spec.ts`).
  - Create `InsuranceExportDialogComponent` (`src/app/features/dashboard/insurance-export-dialog/insurance-export-dialog.component.ts` & `.spec.ts`).
  - Update `ItemAttachmentsDialogComponent`, `SmartSearchDialogComponent`, and `DashboardComponent` (`.ts`, `.html`, `.scss`, `.spec.ts`).
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
  - Update `docs/plans/phase-08-pdf-indexing-maintenance-and-insurance-export.md` status to `[x] Completed`.
