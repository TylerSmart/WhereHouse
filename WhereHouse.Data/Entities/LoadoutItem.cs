namespace WhereHouse.Data.Entities;

public sealed class LoadoutItem : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid LoadoutId { get; set; }

    public Loadout Loadout { get; set; } = null!;

    public Guid ItemId { get; set; }

    public InventoryItem Item { get; set; } = null!;

    public decimal RequiredQuantity { get; set; } = 1m;

    public bool IsConsumable { get; set; }

    public int SortOrder { get; set; }

    public bool IsCurrentlyCheckedOut { get; set; }

    public decimal QuantityCheckedOut { get; set; }

    public decimal QuantityUsed { get; set; }

    public decimal QuantityReturned { get; set; }

    public DateTimeOffset? CheckedOutAt { get; set; }

    public DateTimeOffset? ReturnedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
