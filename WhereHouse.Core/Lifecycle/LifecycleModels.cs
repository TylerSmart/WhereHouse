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

public sealed record BulkUnstageRequest([Required, MinLength(1)] IReadOnlyList<Guid> ItemIds);

public sealed record BulkLifecycleResultDto(int ProcessedCount, IReadOnlyList<ItemDto> Items);

public sealed record DeclutterStagingSummaryDto(
    int TotalStagedCount,
    int StagedToSellCount,
    int StagedToDonateCount,
    decimal TotalTargetResaleValue,
    decimal TotalEstimatedDonationValue,
    IReadOnlyList<ItemDto> Items
);

public sealed record DustCollectorItemDto(ItemDto Item, int DaysUntouched, decimal EstimatedValue);

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
