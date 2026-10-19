using WhereHouse.Core.Locations;

namespace WhereHouse.Data.Entities;

public sealed class LocationNode : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? ParentId { get; set; }

    public LocationNode? Parent { get; set; }

    public ICollection<LocationNode> Children { get; set; } = new List<LocationNode>();

    public ICollection<InventoryItem> Items { get; set; } = new List<InventoryItem>();

    public ICollection<QrCode> BoundQrCodes { get; set; } = new List<QrCode>();

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public LocationNodeType NodeType { get; set; } = LocationNodeType.FixedLocation;

    public string ShortCode { get; set; } = string.Empty;

    public string? Icon { get; set; }

    public string? ContainerStyle { get; set; }

    public string? PrimaryColor { get; set; }

    public string? AccentColor { get; set; }

    public string? ColorLabel { get; set; }

    public bool IsPrivate { get; set; }

    public Guid OwnerId { get; set; }

    public User Owner { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
