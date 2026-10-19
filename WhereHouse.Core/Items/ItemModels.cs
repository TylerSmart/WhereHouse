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

public enum DispositionReason
{
    Sold = 0,
    Donated = 1,
    Recycled = 2,
    BrokenTrashed = 3,
    Consumed = 4,
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
    IReadOnlyList<UpsertItemAttributeValueRequest>? AttributeValues = null,
    [MaxLength(64)] string? BarcodeNumber = null
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
    IReadOnlyList<UpsertItemAttributeValueRequest>? AttributeValues = null,
    [MaxLength(64)] string? BarcodeNumber = null
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
