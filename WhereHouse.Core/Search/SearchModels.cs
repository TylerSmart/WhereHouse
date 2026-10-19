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
