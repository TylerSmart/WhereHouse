using System.ComponentModel.DataAnnotations;
using WhereHouse.Core.Items;

namespace WhereHouse.Core.Checkouts;

public enum CheckoutActionType
{
    CheckOutInUse = 0,
    LoanOutExternal = 1,
    ReturnToHome = 2,
}

public sealed record CheckoutLogDto(
    Guid Id,
    Guid ItemId,
    string ItemShortCode,
    string ItemName,
    CheckoutActionType ActionType,
    Guid PerformedByUserId,
    string PerformedByUsername,
    string? BorrowerName,
    string? BorrowerContact,
    string? ProjectOrNote,
    Guid? LoadoutId,
    string? LoadoutName,
    decimal QuantityAffected,
    decimal? QuantityConsumed,
    DateTimeOffset OccurredAt,
    DateTimeOffset? ExpectedReturnAt,
    DateTimeOffset? ReturnedAt
);

public sealed record CheckoutItemRequest(
    bool IsExternalLoan = false,
    [MaxLength(150)] string? BorrowerName = null,
    [MaxLength(200)] string? BorrowerContact = null,
    [MaxLength(500)] string? ProjectOrNote = null,
    DateTimeOffset? ExpectedReturnAt = null,
    decimal? Quantity = null
);

public sealed record ReturnItemRequest(
    [MaxLength(500)] string? ReturnNote = null,
    decimal? QuantityUsed = null,
    ItemCondition? UpdatedCondition = null
);

public sealed record BatchCheckoutRequest(
    [Required, MinLength(1)] IReadOnlyList<Guid> ItemIds,
    bool IsExternalLoan = false,
    [MaxLength(150)] string? BorrowerName = null,
    [MaxLength(200)] string? BorrowerContact = null,
    [MaxLength(500)] string? ProjectOrNote = null,
    DateTimeOffset? ExpectedReturnAt = null
);

public sealed record BatchReturnItemEntry([Required] Guid ItemId, decimal? QuantityUsed = null);

public sealed record BatchReturnRequest(
    [Required, MinLength(1)] IReadOnlyList<BatchReturnItemEntry> Items,
    [MaxLength(500)] string? ReturnNote = null
);

public sealed record BatchCheckoutResultDto(int ProcessedCount, IReadOnlyList<ItemDto> Items);
