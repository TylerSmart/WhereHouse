using WhereHouse.Core.Checkouts;

namespace WhereHouse.Data.Entities;

public sealed class CheckoutLog : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ItemId { get; set; }

    public InventoryItem Item { get; set; } = null!;

    public CheckoutActionType ActionType { get; set; }

    public Guid PerformedByUserId { get; set; }

    public string PerformedByUsername { get; set; } = string.Empty;

    public string? BorrowerName { get; set; }

    public string? BorrowerContact { get; set; }

    public string? ProjectOrNote { get; set; }

    public Guid? LoadoutId { get; set; }

    public string? LoadoutName { get; set; }

    public decimal QuantityAffected { get; set; } = 1m;

    public decimal? QuantityConsumed { get; set; }

    public DateTimeOffset OccurredAt { get; set; }

    public DateTimeOffset? ExpectedReturnAt { get; set; }

    public DateTimeOffset? ReturnedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
