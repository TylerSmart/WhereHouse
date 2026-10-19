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
