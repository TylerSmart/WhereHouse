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
