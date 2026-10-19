using WhereHouse.Core.Loadouts;

namespace WhereHouse.Data.Entities;

public sealed class Loadout : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? Icon { get; set; } = "backpack";

    public LoadoutStatus Status { get; set; } = LoadoutStatus.Ready;

    public DateTimeOffset? LastCheckedOutAt { get; set; }

    public DateTimeOffset? LastReturnedAt { get; set; }

    public string? ActiveCheckoutNote { get; set; }

    public bool IsPrivate { get; set; }

    public Guid OwnerId { get; set; }

    public User Owner { get; set; } = null!;

    public ICollection<LoadoutItem> Items { get; set; } = new List<LoadoutItem>();

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
