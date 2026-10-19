using System.ComponentModel.DataAnnotations;
using WhereHouse.Core.Items;

namespace WhereHouse.Core.Loadouts;

public enum LoadoutStatus
{
    Ready = 0,
    ActiveCheckout = 1,
}

public sealed record LoadoutItemDto(
    Guid Id,
    Guid LoadoutId,
    Guid ItemId,
    string ItemShortCode,
    string ItemName,
    ItemType ItemType,
    ItemStatus ItemStatus,
    ItemCondition ItemCondition,
    Guid? HomeLocationId,
    string? HomeLocationName,
    string? HomeLocationShortCode,
    string? HomeLocationFullPath,
    string? ContainerStyle,
    string? PrimaryColor,
    string? AccentColor,
    string? ColorLabel,
    decimal AvailableQuantity,
    string? Unit,
    decimal RequiredQuantity,
    bool IsConsumable,
    bool IsCurrentlyCheckedOut,
    decimal QuantityCheckedOut,
    decimal QuantityUsed,
    decimal QuantityReturned,
    bool HasPreFlightWarning,
    string? PreFlightWarningMessage,
    int SortOrder
);

public sealed record LoadoutPickListStopDto(
    Guid? LocationId,
    string LocationName,
    string? LocationShortCode,
    string LocationFullPath,
    string? ContainerStyle,
    string? PrimaryColor,
    string? AccentColor,
    string? ColorLabel,
    IReadOnlyList<LoadoutItemDto> Items
);

public sealed record LoadoutDto(
    Guid Id,
    string Name,
    string? Description,
    string? Icon,
    LoadoutStatus Status,
    DateTimeOffset? LastCheckedOutAt,
    DateTimeOffset? LastReturnedAt,
    string? ActiveCheckoutNote,
    bool IsPrivate,
    Guid OwnerId,
    int TotalItemCount,
    int CheckedOutItemCount,
    int PreFlightWarningCount,
    IReadOnlyList<string> PreFlightWarnings,
    IReadOnlyList<LoadoutItemDto> Items,
    IReadOnlyList<LoadoutPickListStopDto> PickListStops,
    DateTimeOffset CreatedAt,
    DateTimeOffset ModifiedAt
);

public sealed record UpsertLoadoutItemRequest(
    [Required] Guid ItemId,
    decimal RequiredQuantity = 1m,
    bool IsConsumable = false,
    int SortOrder = 0
);

public sealed record CreateLoadoutRequest(
    [Required, MaxLength(150)] string Name,
    [MaxLength(1000)] string? Description = null,
    [MaxLength(64)] string? Icon = null,
    bool IsPrivate = false,
    IReadOnlyList<UpsertLoadoutItemRequest>? Items = null
);

public sealed record UpdateLoadoutRequest(
    [Required, MaxLength(150)] string Name,
    [MaxLength(1000)] string? Description = null,
    [MaxLength(64)] string? Icon = null,
    bool IsPrivate = false,
    IReadOnlyList<UpsertLoadoutItemRequest>? Items = null
);

public sealed record CheckoutLoadoutRequest([MaxLength(500)] string? CheckoutNote = null);

public sealed record PackBackLoadoutItemEntry(
    [Required] Guid ItemId,
    bool IsReturned = true,
    decimal QuantityUsed = 0m,
    decimal? QuantityReturned = null
);

public sealed record PackBackLoadoutRequest(
    [Required, MinLength(1)] IReadOnlyList<PackBackLoadoutItemEntry> Items,
    [MaxLength(500)] string? ReturnNote = null
);
