# Phase 02: Categories, Attribute Templates & Core Items

> **Branch:** `feature/phase-02-categories-and-items`
> **Status:** Completed (`[ ]` Not Started | `[~]` In Progress | `[x]` Completed)
> **PRD Reference:** `docs/prd.md` — Sections 4.2 (`Item Typology, Granularity & Custom Attributes`), 4.3.1 (`Identifiers & QR Encoding`), 4.4.2 (`Quick-Clone / Duplicate Item`), 4.5.1 (`Permanent Home Location vs. Current Status`), 4.6.2 (`Purchase, Return Window & Warranty Lifecycle`), and 4.8.2 (`Household User Accounts & "Secret / Gift Mode"`)
> **Target Execution:** Run `/execute-phase` with your implementation model to execute this plan step-by-step.

---

## 1. Scope & Objectives

This phase builds the second core slice of **Milestone 1**: **Categories, Typed Attribute Templates, and the 4 Core Item Archetypes** integrated directly into the Spatial Inventory Explorer:

1. **Categories & Typed Attribute Templates (`Category` & `CategoryAttributeTemplate`):**
   - Hierarchical or flat categories (e.g., `Cables & Adapters`, `Power Tools`, `Camping Gear`, `Fasteners`) with custom icons and colors.
   - Each Category can define an ordered **Attribute Template** of typed custom fields (`Text`, `Number` with unit, `Enum` with selectable options, `Boolean`) that dynamically render in the Item Create/Edit dialog and store structured `ItemAttributeValue` records on items.
2. **Four Core Item Archetypes (`InventoryItem`):**
   - **`Unique` (`0` - 1-of-1 Tracked Assets):** Supports brand, model number, serial number, condition (`New`, `Excellent`, `Good`, `Fair`, `Broken`), purchase/warranty dates, and replacement valuation.
   - **`Quantity` (`1` - Stackable / Consumables):** Tracked by `CurrentQuantity`, `Unit`, and optional `MinQuantity` low-stock threshold (`IsLowStock` flag), plus 1-tap `+1` / `-1` / `Set Qty` adjustments (`PATCH /api/items/{id}/quantity`).
   - **`Kit` (`2` - Kits & Bundles):** Parent kit item linked to member child items (`ParentItemId`), with automatic **Incomplete Kit Detection** (`IsIncompleteKit` + `IncompleteKitWarnings`) whenever any member item is `Broken`, not `InPlace`, or `IsLowStock`/`0` quantity.
   - **`Nested` (`3` - Parent-Child Equipment Relationships):** Links accessories/parts to a parent primary asset via `ParentItemId`.
3. **Human-Readable Item Short Codes (`ITM-001`):**
   - Auto-generated sequential `ITM-001`, `ITM-002`... codes (or normalized custom codes) via `ItemShortCodeGenerator`.
4. **Day-1 Purchase, Return Window & Warranty Capture:**
   - Captures `PurchaseDate`, `Retailer`, `PurchasePrice`, `EstimatedReplacementValue`, `ReturnWindowEndDate`, `WarrantyExpirationDate`, and `WarrantyNotes` directly on items.
5. **Quick-Clone / Duplicate Item (`POST /api/items/{id}/duplicate`):**
   - 1-click item duplication copying `HomeLocationId`, `CategoryId`, `ItemType`, `Brand`, `Tags`, and custom `AttributeValues` to accelerate cataloging similar items (e.g., cables or fasteners).
6. **"Secret / Gift Mode" (`IsPrivate`) & Location Privacy Inheritance:**
   - Private items (and items stored inside any private `LocationNode` or private ancestor `LocationNode` owned by another user) are strictly hidden from non-owners across all item queries, location item counts, and kit/nested child lists, and return `403 Forbidden` on direct access.
   - Prevents deleting a `LocationNode` that still houses cataloged items (`409 Conflict`).

### Explicitly Out of Scope for Phase 02 (Deferred to Phase 03+)
- File Attachment binary uploads (Photos, Receipts, PDF Manuals) & Global Smart Search (`Cmd/Ctrl + K`) (Phase 03).
- QR/Barcode Camera Scanning & PDF Label Sheet Printing (Milestone 2).
- Full Check-In/Check-Out log workflows, External Loans, and Reusable Loadouts (Milestone 3).

---

## 2. File Inventory (Create / Modify)

### 2.1 Files to Create
- `WhereHouse.Core/Categories/CategoryModels.cs`
- `WhereHouse.Core/Categories/ICategoryService.cs`
- `WhereHouse.Core/Items/ItemModels.cs`
- `WhereHouse.Core/Items/IItemService.cs`
- `WhereHouse.Data/Entities/Category.cs`
- `WhereHouse.Data/Entities/CategoryAttributeTemplate.cs`
- `WhereHouse.Data/Entities/InventoryItem.cs`
- `WhereHouse.Data/Entities/ItemAttributeValue.cs`
- `WhereHouse.Data/Configurations/CategoryConfiguration.cs`
- `WhereHouse.Data/Configurations/CategoryAttributeTemplateConfiguration.cs`
- `WhereHouse.Data/Configurations/InventoryItemConfiguration.cs`
- `WhereHouse.Data/Configurations/ItemAttributeValueConfiguration.cs`
- `WhereHouse.Data/Services/CategoryService.cs`
- `WhereHouse.Data/Services/ItemService.cs`
- `WhereHouse.API/Controllers/CategoriesController.cs`
- `WhereHouse.API/Controllers/ItemsController.cs`
- `Tests/WhereHouse.Core.UnitTests/ItemShortCodeTests.cs`
- `Tests/WhereHouse.API.IntegrationTests/CategoryAndItemIntegrationTests.cs`
- `WhereHouse.Client/src/app/core/models/category.models.ts`
- `WhereHouse.Client/src/app/core/models/item.models.ts`
- `WhereHouse.Client/src/app/core/services/category/category.service.ts`
- `WhereHouse.Client/src/app/core/services/category/category.service.spec.ts`
- `WhereHouse.Client/src/app/core/services/item/item.service.ts`
- `WhereHouse.Client/src/app/core/services/item/item.service.spec.ts`
- `WhereHouse.Client/src/app/features/dashboard/category-manager-dialog/category-manager-dialog.component.ts`
- `WhereHouse.Client/src/app/features/dashboard/category-manager-dialog/category-manager-dialog.component.spec.ts`
- `WhereHouse.Client/src/app/features/dashboard/item-dialog/item-dialog.component.ts`
- `WhereHouse.Client/src/app/features/dashboard/item-dialog/item-dialog.component.spec.ts`

### 2.2 Files to Modify
- `WhereHouse.Core/Locations/LocationModels.cs` (add `int ItemCount = 0` to `LocationNodeDto`)
- `WhereHouse.Data/Entities/User.cs` (add `OwnedItems` navigation collection)
- `WhereHouse.Data/Entities/LocationNode.cs` (add `Items` navigation collection)
- `WhereHouse.Data/WhereHouseDbContext.cs` (add `Categories`, `CategoryAttributeTemplates`, `InventoryItems`, `ItemAttributeValues` `DbSet`s)
- `WhereHouse.Data/DataServiceCollectionExtensions.cs` (register `ICategoryService` and `IItemService`)
- `WhereHouse.Data/Services/LocationService.cs` (include accessible `ItemCount` on `LocationNodeDto` and block deleting a location that still contains items)
- `Tests/WhereHouse.API.IntegrationTests/OpenApiIntegrationTests.cs` (assert `/categories` and `/items`)
- `WhereHouse.Client/src/app/core/models/location.models.ts` (add optional `itemCount?: number` to `LocationNodeDto`)
- `WhereHouse.Client/src/app/features/dashboard/dashboard.component.ts`
- `WhereHouse.Client/src/app/features/dashboard/dashboard.component.html`
- `WhereHouse.Client/src/app/features/dashboard/dashboard.component.scss`
- `WhereHouse.Client/src/app/features/dashboard/dashboard.component.spec.ts`

---

## 3. Domain & Database Design (`WhereHouse.Core` & `WhereHouse.Data`)

### 3.1 Category Models & Service Contract (`WhereHouse.Core/Categories/`)

#### `WhereHouse.Core/Categories/CategoryModels.cs`
```csharp
using System.ComponentModel.DataAnnotations;

namespace WhereHouse.Core.Categories;

public enum AttributeFieldType
{
    Text = 0,
    Number = 1,
    Enum = 2,
    Boolean = 3,
}

public sealed record CategoryAttributeTemplateDto(
    Guid Id,
    Guid CategoryId,
    string Name,
    AttributeFieldType FieldType,
    string? Unit,
    IReadOnlyList<string> Options,
    bool IsRequired,
    int SortOrder
);

public sealed record CategoryDto(
    Guid Id,
    Guid? ParentId,
    string Name,
    string? Description,
    string? Icon,
    string? Color,
    IReadOnlyList<CategoryAttributeTemplateDto> AttributeTemplates,
    int ItemCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset ModifiedAt
);

public sealed record UpsertCategoryAttributeTemplateRequest(
    Guid? Id,
    [Required, MaxLength(100)] string Name,
    AttributeFieldType FieldType = AttributeFieldType.Text,
    [MaxLength(32)] string? Unit = null,
    IReadOnlyList<string>? Options = null,
    bool IsRequired = false,
    int SortOrder = 0
);

public sealed record CreateCategoryRequest(
    [Required, MaxLength(100)] string Name,
    Guid? ParentId = null,
    [MaxLength(500)] string? Description = null,
    [MaxLength(64)] string? Icon = null,
    [MaxLength(32)] string? Color = null,
    IReadOnlyList<UpsertCategoryAttributeTemplateRequest>? AttributeTemplates = null
);

public sealed record UpdateCategoryRequest(
    [Required, MaxLength(100)] string Name,
    Guid? ParentId = null,
    [MaxLength(500)] string? Description = null,
    [MaxLength(64)] string? Icon = null,
    [MaxLength(32)] string? Color = null,
    IReadOnlyList<UpsertCategoryAttributeTemplateRequest>? AttributeTemplates = null
);
```

#### `WhereHouse.Core/Categories/ICategoryService.cs`
```csharp
namespace WhereHouse.Core.Categories;

public interface ICategoryService
{
    Task<IReadOnlyList<CategoryDto>> GetCategoriesAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<CategoryDto?> GetCategoryByIdAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );

    Task<CategoryDto> CreateCategoryAsync(
        Guid userId,
        CreateCategoryRequest request,
        CancellationToken cancellationToken = default
    );

    Task<CategoryDto?> UpdateCategoryAsync(
        Guid userId,
        Guid id,
        UpdateCategoryRequest request,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteCategoryAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );
}
```

### 3.2 Item Models & Service Contract (`WhereHouse.Core/Items/`)

#### `WhereHouse.Core/Items/ItemModels.cs`
```csharp
using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using WhereHouse.Core.Categories;

namespace WhereHouse.Core.Items;

public enum ItemType
{
    Unique = 0,
    Quantity = 1,
    Kit = 2,
    Nested = 3,
}

public enum ItemStatus
{
    InPlace = 0,
    InUse = 1,
    LoanedOut = 2,
    StagedToSell = 3,
    StagedToDonate = 4,
    Archived = 5,
}

public enum ItemCondition
{
    New = 0,
    Excellent = 1,
    Good = 2,
    Fair = 3,
    Broken = 4,
}

public sealed record ItemAttributeValueDto(
    Guid Id,
    Guid? AttributeTemplateId,
    string AttributeName,
    AttributeFieldType FieldType,
    string? Unit,
    string Value
);

public sealed record ItemChildSummaryDto(
    Guid Id,
    string ShortCode,
    string Name,
    ItemType ItemType,
    ItemStatus Status,
    ItemCondition Condition,
    decimal CurrentQuantity,
    string? Unit,
    decimal? MinQuantity,
    bool IsLowStock,
    string? HomeLocationFullPath
);

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
    DateTimeOffset ModifiedAt
);

public sealed record UpsertItemAttributeValueRequest(
    Guid? AttributeTemplateId,
    [Required, MaxLength(100)] string AttributeName,
    AttributeFieldType FieldType = AttributeFieldType.Text,
    [MaxLength(32)] string? Unit = null,
    [Required, MaxLength(1000)] string Value = ""
);

public sealed record CreateItemRequest(
    [Required, MaxLength(200)] string Name,
    ItemType ItemType = ItemType.Unique,
    Guid? HomeLocationId = null,
    Guid? CategoryId = null,
    Guid? ParentItemId = null,
    [MaxLength(32)] string? ShortCode = null,
    [MaxLength(2000)] string? Description = null,
    IReadOnlyList<string>? Aliases = null,
    IReadOnlyList<string>? Tags = null,
    ItemCondition Condition = ItemCondition.Good,
    [MaxLength(100)] string? Brand = null,
    [MaxLength(100)] string? ModelNumber = null,
    [MaxLength(100)] string? SerialNumber = null,
    decimal CurrentQuantity = 1m,
    [MaxLength(32)] string? Unit = null,
    decimal? MinQuantity = null,
    DateTimeOffset? PurchaseDate = null,
    [MaxLength(150)] string? Retailer = null,
    decimal? PurchasePrice = null,
    decimal? EstimatedReplacementValue = null,
    DateTimeOffset? ReturnWindowEndDate = null,
    DateTimeOffset? WarrantyExpirationDate = null,
    [MaxLength(1000)] string? WarrantyNotes = null,
    bool IsPrivate = false,
    IReadOnlyList<UpsertItemAttributeValueRequest>? AttributeValues = null
);

public sealed record UpdateItemRequest(
    [Required, MaxLength(200)] string Name,
    ItemType ItemType,
    Guid? HomeLocationId = null,
    Guid? CategoryId = null,
    Guid? ParentItemId = null,
    [MaxLength(2000)] string? Description = null,
    IReadOnlyList<string>? Aliases = null,
    IReadOnlyList<string>? Tags = null,
    ItemStatus Status = ItemStatus.InPlace,
    ItemCondition Condition = ItemCondition.Good,
    [MaxLength(100)] string? Brand = null,
    [MaxLength(100)] string? ModelNumber = null,
    [MaxLength(100)] string? SerialNumber = null,
    decimal CurrentQuantity = 1m,
    [MaxLength(32)] string? Unit = null,
    decimal? MinQuantity = null,
    DateTimeOffset? PurchaseDate = null,
    [MaxLength(150)] string? Retailer = null,
    decimal? PurchasePrice = null,
    decimal? EstimatedReplacementValue = null,
    DateTimeOffset? ReturnWindowEndDate = null,
    DateTimeOffset? WarrantyExpirationDate = null,
    [MaxLength(1000)] string? WarrantyNotes = null,
    bool IsPrivate = false,
    IReadOnlyList<UpsertItemAttributeValueRequest>? AttributeValues = null
);

public sealed record AdjustItemQuantityRequest(
    decimal? Delta = null,
    decimal? AbsoluteQuantity = null
);

public static partial class ItemShortCodeGenerator
{
    public const string Prefix = "ITM";

    [GeneratedRegex(@"^ITM-(\d+)$", RegexOptions.IgnoreCase)]
    private static partial Regex ItemCodePattern();

    public static string NormalizeShortCode(string rawCode)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(rawCode);
        return rawCode.Trim().ToUpperInvariant();
    }

    public static string GenerateNextShortCode(IEnumerable<string> existingCodes)
    {
        var maxNumber = 0;

        foreach (var code in existingCodes)
        {
            if (string.IsNullOrWhiteSpace(code))
            {
                continue;
            }

            var match = ItemCodePattern().Match(code.Trim());
            if (match.Success && int.TryParse(match.Groups[1].Value, out var num))
            {
                if (num > maxNumber)
                {
                    maxNumber = num;
                }
            }
        }

        return $"{Prefix}-{(maxNumber + 1):D3}";
    }
}
```

#### `WhereHouse.Core/Items/IItemService.cs`
```csharp
namespace WhereHouse.Core.Items;

public interface IItemService
{
    Task<IReadOnlyList<ItemDto>> GetItemsAsync(
        Guid userId,
        Guid? locationId = null,
        bool includeSubtreeLocations = false,
        Guid? categoryId = null,
        ItemType? itemType = null,
        ItemStatus? status = null,
        bool? lowStockOnly = null,
        string? search = null,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto?> GetItemByIdAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto> CreateItemAsync(
        Guid userId,
        CreateItemRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto?> UpdateItemAsync(
        Guid userId,
        Guid id,
        UpdateItemRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto?> AdjustItemQuantityAsync(
        Guid userId,
        Guid id,
        AdjustItemQuantityRequest request,
        CancellationToken cancellationToken = default
    );

    Task<ItemDto?> DuplicateItemAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteItemAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    );
}
```

### 3.3 Entities & EF Configurations (`WhereHouse.Data/`)

1. **`WhereHouse.Data/Entities/Category.cs` (implements `IAuditable`):**
   - `Id` (`Guid`), `ParentId` (`Guid?`), `Parent` (`Category?`), `Children` (`ICollection<Category>`), `Name` (`string`), `Description` (`string?`), `Icon` (`string?`), `Color` (`string?`), `AttributeTemplates` (`ICollection<CategoryAttributeTemplate>`), `Items` (`ICollection<InventoryItem>`), `CreatedAt`, `CreatedBy`, `ModifiedAt`, `ModifiedBy`.
2. **`WhereHouse.Data/Entities/CategoryAttributeTemplate.cs` (implements `IAuditable`):**
   - `Id` (`Guid`), `CategoryId` (`Guid`), `Category` (`Category`), `Name` (`string`), `FieldType` (`AttributeFieldType`), `Unit` (`string?`), `OptionsJson` (`string?`), `IsRequired` (`bool`), `SortOrder` (`int`), `CreatedAt`, `CreatedBy`, `ModifiedAt`, `ModifiedBy`.
3. **`WhereHouse.Data/Entities/InventoryItem.cs` (implements `IAuditable`):**
   - `Id` (`Guid`), `ShortCode` (`string`), `Name` (`string`), `Description` (`string?`), `Aliases` (`string?`), `Tags` (`string?`), `ItemType` (`ItemType`), `Status` (`ItemStatus`), `Condition` (`ItemCondition`), `HomeLocationId` (`Guid?`), `HomeLocation` (`LocationNode?`), `CategoryId` (`Guid?`), `Category` (`Category?`), `ParentItemId` (`Guid?`), `ParentItem` (`InventoryItem?`), `ChildItems` (`ICollection<InventoryItem>`), `Brand` (`string?`), `ModelNumber` (`string?`), `SerialNumber` (`string?`), `CurrentQuantity` (`decimal`), `Unit` (`string?`), `MinQuantity` (`decimal?`), `PurchaseDate` (`DateTimeOffset?`), `Retailer` (`string?`), `PurchasePrice` (`decimal?`), `EstimatedReplacementValue` (`decimal?`), `ReturnWindowEndDate` (`DateTimeOffset?`), `WarrantyExpirationDate` (`DateTimeOffset?`), `WarrantyNotes` (`string?`), `IsPrivate` (`bool`), `OwnerId` (`Guid`), `Owner` (`User`), `AttributeValues` (`ICollection<ItemAttributeValue>`), `LastTouchedAt` (`DateTimeOffset`), `CreatedAt`, `CreatedBy`, `ModifiedAt`, `ModifiedBy`.
4. **`WhereHouse.Data/Entities/ItemAttributeValue.cs`:**
   - `Id` (`Guid`), `ItemId` (`Guid`), `Item` (`InventoryItem`), `AttributeTemplateId` (`Guid?`), `AttributeName` (`string`), `FieldType` (`AttributeFieldType`), `Unit` (`string?`), `Value` (`string`).

5. **SQL Server EF Core Configurations (`WhereHouse.Data/Configurations/`):**
   - **`CategoryConfiguration.cs`:**
     - Table `"Categories"`, unique index on `Name`, self-referencing `Parent` FK with `DeleteBehavior.Restrict`.
   - **`CategoryAttributeTemplateConfiguration.cs`:**
     - Table `"CategoryAttributeTemplates"`, FK `CategoryId` to `Category.AttributeTemplates` with `DeleteBehavior.Cascade`.
   - **`InventoryItemConfiguration.cs`:**
     - Table `"InventoryItems"`, unique index on `ShortCode`.
     - Precision on decimal columns: `CurrentQuantity`, `MinQuantity`, `PurchasePrice`, `EstimatedReplacementValue` $\rightarrow$ `.HasPrecision(18, 2)`.
     - **CRITICAL SQL Server `DeleteBehavior` rules:**
       - `HomeLocation` (`HomeLocationId` $\rightarrow$ `LocationNode.Items`): `DeleteBehavior.Restrict`
       - `Category` (`CategoryId` $\rightarrow$ `Category.Items`): `DeleteBehavior.Restrict`
       - `ParentItem` (`ParentItemId` $\rightarrow$ `InventoryItem.ChildItems`): `DeleteBehavior.Restrict`
       - `Owner` (`OwnerId` $\rightarrow$ `User.OwnedItems`): `DeleteBehavior.Restrict`
   - **`ItemAttributeValueConfiguration.cs`:**
     - Table `"ItemAttributeValues"`, FK `ItemId` to `InventoryItem.AttributeValues` with `DeleteBehavior.Cascade`.
     - Do **not** add a cascade FK from `CategoryAttributeTemplate` to `ItemAttributeValue` (keep `AttributeTemplateId` as an indexed `Guid?` property so SQL Server never sees multiple cascade paths from `Category`).

6. **EF Core Migration Name:** `AddCategoriesAndInventoryItems`

---

## 4. Service Business Logic & Privacy Invariants (`WhereHouse.Data/Services/`)

### 4.1 `CategoryService.cs`
- **`GetCategoriesAsync` / `GetCategoryByIdAsync`:**
  - Loads categories with `.Include(c => c.AttributeTemplates).AsNoTracking()`.
  - Calculates `ItemCount` for each category counting only items accessible to `userId` (where `!item.IsPrivate || item.OwnerId == userId`, and the item's `HomeLocationId` is accessible to `userId`).
  - Deserializes `OptionsJson` (using `System.Text.Json.JsonSerializer`) into `IReadOnlyList<string>` (or `[]` if null/empty).
- **`CreateCategoryAsync` / `UpdateCategoryAsync`:**
  - Enforces unique category `Name` (case-insensitive); throws `ConflictException("A category with this name already exists.", "Duplicate category name")` on collision.
  - If `ParentId.HasValue`, verifies parent category exists (`NotFoundException` if not) and prevents circular category hierarchy (`ConflictException` if moving into itself or descendant).
  - Replaces/syncs `CategoryAttributeTemplate` children ordered by `SortOrder`.
- **`DeleteCategoryAsync`:**
  - If any child category has `ParentId == id` or any `InventoryItem` has `CategoryId == id`, throws `ConflictException("Cannot delete a category that is still assigned to items or subcategories.", "Category in use")`.

### 4.2 `ItemService.cs`
- **Item Accessibility & Subtree Location Privacy:**
  - An `InventoryItem` is accessible to `userId` if and only if:
    1. `(!item.IsPrivate || item.OwnerId == userId)` **AND**
    2. If `item.HomeLocationId.HasValue`, that `LocationNode` and all of its ancestor `LocationNode`s are accessible to `userId` (`!loc.IsPrivate || loc.OwnerId == userId`) **AND**
    3. If `item.ParentItemId.HasValue`, the parent item is also accessible to `userId`.
  - Accessing an inaccessible item by ID in `GetItemByIdAsync`, `UpdateItemAsync`, `AdjustItemQuantityAsync`, `DuplicateItemAsync`, or `DeleteItemAsync` throws `ForbiddenException()`.
- **Low-Stock Calculation (`IsLowStock`):**
  - `bool isLowStock = (item.ItemType == ItemType.Quantity && item.MinQuantity.HasValue && item.CurrentQuantity <= item.MinQuantity.Value) || (item.ItemType == ItemType.Quantity && item.CurrentQuantity <= 0);`
- **Kit Business Logic & Incomplete Kit Warnings (`IsIncompleteKit` & `IncompleteKitWarnings`):**
  - For an item with `ItemType == ItemType.Kit` (or any item with accessible `ChildItems`):
    - Inspect each accessible child item in `ChildItems`:
      - If `child.Condition == ItemCondition.Broken`: add warning `$"{child.Name} ({child.ShortCode}) is marked Broken"`.
      - If `child.Status != ItemStatus.InPlace`: add warning `$"{child.Name} ({child.ShortCode}) is currently {child.Status}"`.
      - If `child.CurrentQuantity <= 0` or `(child.MinQuantity.HasValue && child.CurrentQuantity <= child.MinQuantity.Value)`: add warning `$"{child.Name} ({child.ShortCode}) is low/out of stock (Qty: {child.CurrentQuantity})"`.
    - `bool isIncompleteKit = item.ItemType == ItemType.Kit && warnings.Count > 0;`
- **`AdjustItemQuantityAsync(Guid userId, Guid id, AdjustItemQuantityRequest request)`:**
  - Updates `CurrentQuantity`:
    - If `request.AbsoluteQuantity.HasValue`: sets `CurrentQuantity = Math.Max(0, request.AbsoluteQuantity.Value)`.
    - Else if `request.Delta.HasValue`: sets `CurrentQuantity = Math.Max(0, item.CurrentQuantity + request.Delta.Value)`.
  - Updates `LastTouchedAt = DateTimeOffset.UtcNow`.
- **`DuplicateItemAsync(Guid userId, Guid id)`:**
  - Loads source item (including `AttributeValues`). Verifies accessibility (`ForbiddenException` if private to another user).
  - Generates next `ITM-xxx` short code via `ItemShortCodeGenerator.GenerateNextShortCode`.
  - Creates a new `InventoryItem` with `Name = $"{source.Name} (Copy)"`, copying `Description`, `Aliases`, `Tags`, `ItemType`, `Condition`, `HomeLocationId`, `CategoryId`, `ParentItemId`, `Brand`, `ModelNumber`, `CurrentQuantity`, `Unit`, `MinQuantity`, `Retailer`, `PurchasePrice`, `EstimatedReplacementValue`, `IsPrivate`, `OwnerId = userId`, and cloning all `ItemAttributeValue` records (`SerialNumber` is set to `null` since serial numbers are 1-of-1).

---

## 5. API Endpoints (`WhereHouse.API/Controllers/`)

### 5.1 `CategoriesController.cs` (`[Route("categories")]`, `[Authorize]`)

| Verb | Route (`/api/categories...`) | Request Body / Query | Success Response | Error Cases |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/categories` | — | `200 OK` (`IReadOnlyList<CategoryDto>`) | `401 Unauthorized` |
| `GET` | `/categories/{id:guid}` | — | `200 OK` (`CategoryDto`) | `404 NotFound` |
| `POST` | `/categories` | `[FromBody] CreateCategoryRequest` | `201 Created` (`CategoryDto`) | `400 BadRequest`, `404 NotFound`, `409 Conflict` |
| `PUT` | `/categories/{id:guid}` | `[FromBody] UpdateCategoryRequest` | `200 OK` (`CategoryDto`) | `400 BadRequest`, `404 NotFound`, `409 Conflict` |
| `DELETE` | `/categories/{id:guid}` | — | `204 NoContent` | `404 NotFound`, `409 Conflict` |

### 5.2 `ItemsController.cs` (`[Route("items")]`, `[Authorize]`)

| Verb | Route (`/api/items...`) | Request Body / Query | Success Response | Error Cases |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/items` | `[FromQuery] Guid? locationId`, `[FromQuery] bool includeSubtreeLocations = false`, `[FromQuery] Guid? categoryId`, `[FromQuery] ItemType? itemType`, `[FromQuery] ItemStatus? status`, `[FromQuery] bool? lowStockOnly`, `[FromQuery] string? search` | `200 OK` (`IReadOnlyList<ItemDto>`) | `403 Forbidden`, `404 NotFound` |
| `GET` | `/items/{id:guid}` | — | `200 OK` (`ItemDto`) | `403 Forbidden`, `404 NotFound` |
| `POST` | `/items` | `[FromBody] CreateItemRequest` | `201 Created` (`ItemDto`) | `400 BadRequest`, `403 Forbidden`, `404 NotFound`, `409 Conflict` |
| `PUT` | `/items/{id:guid}` | `[FromBody] UpdateItemRequest` | `200 OK` (`ItemDto`) | `400 BadRequest`, `403 Forbidden`, `404 NotFound`, `409 Conflict` |
| `PATCH` | `/items/{id:guid}/quantity` | `[FromBody] AdjustItemQuantityRequest` | `200 OK` (`ItemDto`) | `400 BadRequest`, `403 Forbidden`, `404 NotFound` |
| `POST` | `/items/{id:guid}/duplicate` | — | `201 Created` (`ItemDto`) | `403 Forbidden`, `404 NotFound` |
| `DELETE` | `/items/{id:guid}` | — | `204 NoContent` | `403 Forbidden`, `404 NotFound`, `409 Conflict` |

---

## 6. Angular Frontend Design (`WhereHouse.Client`)

### 6.1 Models & Services (`src/app/core/`)
- **`src/app/core/models/category.models.ts`:** TypeScript interfaces matching `CategoryDto`, `CategoryAttributeTemplateDto`, `AttributeFieldType`, `CreateCategoryRequest`, `UpdateCategoryRequest`, and `UpsertCategoryAttributeTemplateRequest`.
- **`src/app/core/models/item.models.ts`:** TypeScript interfaces matching `ItemDto`, `ItemType`, `ItemStatus`, `ItemCondition`, `ItemAttributeValueDto`, `ItemChildSummaryDto`, `CreateItemRequest`, `UpdateItemRequest`, and `AdjustItemQuantityRequest`.
- **`src/app/core/services/category/category.service.ts`:** `@Service()` singleton providing `getCategories()`, `getCategoryById(id)`, `createCategory(req)`, `updateCategory(id, req)`, and `deleteCategory(id)`.
- **`src/app/core/services/item/item.service.ts`:** `@Service()` singleton providing `getItems(params)`, `getItemById(id)`, `createItem(req)`, `updateItem(id, req)`, `adjustQuantity(id, req)`, `duplicateItem(id)`, and `deleteItem(id)`.

### 6.2 Dialogs & Dashboard Integration (`src/app/features/dashboard/`)
1. **`CategoryManagerDialogComponent` (`category-manager-dialog/category-manager-dialog.component.ts`):**
   - Allows viewing existing categories, creating/editing a category, and adding/removing **Typed Attribute Template Fields** (`Name`, `FieldType`: Text / Number / Enum / Boolean, `Unit`, comma-separated `Options` for Enum, `IsRequired`).
2. **`ItemDialogComponent` (`item-dialog/item-dialog.component.ts`):**
   - Supports creating or editing any of the 4 Item Archetypes (`Unique`, `Quantity`, `Kit`, `Nested`):
     - **Core Tab / Section:** Item Type selector (`Unique`, `Quantity`, `Kit`, `Nested`), Name, ShortCode (optional auto-generated `ITM-001`), Home Location selector (`availableLocations`), Category selector (`categories`), Parent Item/Kit selector (`availableParentItems`), Condition, Status (on edit), Description, Brand, Model #, Serial #, Tags, Aliases, and `IsPrivate` ("Secret / Gift Mode") toggle.
     - **Quantity Section (highlighted when `Quantity` type selected):** `CurrentQuantity`, `Unit` (`pcs`, `ft`, `rolls`, `packs`), and `MinQuantity` low-stock threshold.
     - **Dynamic Category Attribute Fields:** When a `CategoryId` is selected, dynamically renders form inputs for each `CategoryAttributeTemplateDto` (`text` input, `number` input with unit suffix, `mat-select` for `Enum` options, `mat-checkbox` for `Boolean`).
     - **Purchase & Warranty Vault Section:** `PurchaseDate`, `Retailer`, `PurchasePrice`, `EstimatedReplacementValue`, `ReturnWindowEndDate`, `WarrantyExpirationDate`, and `WarrantyNotes`.
3. **`DashboardComponent` (`dashboard.component.*`) Enhancements:**
   - Top bar adds **"Categories"** button (opens `CategoryManagerDialogComponent`) and **"Add Item"** option in the Quick Add menu.
   - Main Explorer view displays two coordinated sections for the currently selected Location/Container (or across all locations when searching/filtering):
     1. **Locations & Movable Containers** (with `itemCount` and `childCount` pills).
     2. **Cataloged Items in Current View** with:
        - Archetype badge (`Unique`, `Quantity`, `Kit`, `Nested`), ShortCode pill (`ITM-001`), Category pill, Condition/Status badges, and `IsPrivate` lock icon.
        - **High-Visibility Incomplete Kit Warning Banner** on `Kit` cards when `item.isIncompleteKit` is `true` (listing `item.incompleteKitWarnings`).
        - **Low-Stock Alert Badge & Inline `+1` / `-1` Stepper Buttons** on `Quantity` items for 1-tap stock adjustments right from the bin view.
        - **1-Tap Quick-Clone ("Duplicate")**, **Edit**, and **Delete** actions in the item card menu.

---

## 7. Step-by-Step Execution Checklist (For Implementation Agent)

- [x] **Task 1: Backend Core & Data Layer (Categories, Attribute Templates & Inventory Items)**
  - Create `WhereHouse.Core/Categories/CategoryModels.cs` and `WhereHouse.Core/Categories/ICategoryService.cs`.
  - Create `WhereHouse.Core/Items/ItemModels.cs` and `WhereHouse.Core/Items/IItemService.cs`.
  - Update `WhereHouse.Core/Locations/LocationModels.cs` to add `int ItemCount = 0` to `LocationNodeDto`.
  - Create `Category.cs`, `CategoryAttributeTemplate.cs`, `InventoryItem.cs`, and `ItemAttributeValue.cs` in `WhereHouse.Data/Entities/`.
  - Update `User.cs` and `LocationNode.cs` with navigation collections (`OwnedItems`, `Items`).
  - Create `CategoryConfiguration.cs`, `CategoryAttributeTemplateConfiguration.cs`, `InventoryItemConfiguration.cs`, and `ItemAttributeValueConfiguration.cs` in `WhereHouse.Data/Configurations/` (ensuring `DeleteBehavior.Restrict` on `HomeLocation`, `Category`, `ParentItem`, and `Owner` FKs).
  - Update `WhereHouseDbContext.cs` and `DataServiceCollectionExtensions.cs`.
  - Implement `CategoryService.cs` and `ItemService.cs`, and update `LocationService.cs` to populate `ItemCount` and prevent deleting locations that contain items.
  - Ensure local SQL Server is running, then generate, apply, and format the EF Core migration:
    ```powershell
    .\scripts\ensure-local-infra.ps1
    dotnet ef migrations add AddCategoriesAndInventoryItems --project WhereHouse.Data
    dotnet ef database update --project WhereHouse.Data
    dotnet csharpier format WhereHouse.Data/Migrations
    ```
  - Create `Tests/WhereHouse.Core.UnitTests/ItemShortCodeTests.cs` and run unit tests:
    ```powershell
    dotnet test --project Tests/WhereHouse.Core.UnitTests/WhereHouse.Core.UnitTests.csproj
    ```

- [x] **Task 2: API Controllers & Integration Tests**
  - Create `WhereHouse.API/Controllers/CategoriesController.cs` and `WhereHouse.API/Controllers/ItemsController.cs`.
  - Update `Tests/WhereHouse.API.IntegrationTests/OpenApiIntegrationTests.cs` to assert `"/categories"` and `"/items"`.
  - Create `Tests/WhereHouse.API.IntegrationTests/CategoryAndItemIntegrationTests.cs` covering:
    1. Creating a Category (`Cables & Adapters`) with typed `AttributeTemplates` (`Connector A` Enum, `Length` Number with `ft` unit) and creating an Item with custom attribute values and auto-generated `ITM-001` short code.
    2. Quantity items: verifying `IsLowStock` calculation when `CurrentQuantity <= MinQuantity` and testing `PATCH /api/items/{id}/quantity` (`Delta` and `AbsoluteQuantity`).
    3. Kits & Bundles: creating a `Kit` item with child member items and verifying `IsIncompleteKit == true` and `IncompleteKitWarnings` when a child item is `Broken` or `LoanedOut` or out of stock.
    4. Quick-Clone (`POST /api/items/{id}/duplicate`): verifying duplicated item copies category, location, brand, tags, and custom attributes with a new `ITM-xxx` code.
    5. Container relocation inheritance for items: moving a `MovableContainer` updates `HomeLocationFullPath` for items inside it; attempting to delete a `LocationNode` containing an item returns `409 Conflict`.
    6. "Secret / Gift Mode" (`IsPrivate`) enforcement: verifying private items (and items inside private containers) are hidden from other household users and return `403 Forbidden` on direct access.
  - Run integration tests until 100% green:
    ```powershell
    dotnet test --project Tests/WhereHouse.API.IntegrationTests/WhereHouse.API.IntegrationTests.csproj
    ```

- [x] **Task 3: Angular Client & Unit Tests**
  - Create `src/app/core/models/category.models.ts` and `src/app/core/models/item.models.ts` (and add `itemCount?: number` to `location.models.ts`).
  - Create `CategoryService` (`category.service.ts` & `.spec.ts`) and `ItemService` (`item.service.ts` & `.spec.ts`).
  - Create `CategoryManagerDialogComponent` (`.ts` & `.spec.ts`) and `ItemDialogComponent` (`.ts` & `.spec.ts`).
  - Update `DashboardComponent` (`.ts`, `.html`, `.scss`, `.spec.ts`) to display cataloged items, low-stock steppers, incomplete kit warnings, quick-clone action, and category management.
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
  - Update `docs/plans/phase-02-categories-and-items.md` status to `[x] Completed`.
