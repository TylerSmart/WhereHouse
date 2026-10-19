using WhereHouse.Core.QrCodes;

namespace WhereHouse.Data.Entities;

public sealed class QrCode : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string Token { get; set; } = string.Empty;

    public QrTargetType TargetType { get; set; } = QrTargetType.Unassigned;

    public Guid? LocationNodeId { get; set; }

    public LocationNode? LocationNode { get; set; }

    public Guid? ItemId { get; set; }

    public InventoryItem? Item { get; set; }

    public string? LabelNote { get; set; }

    public int PrintedCount { get; set; }

    public DateTimeOffset? BoundAt { get; set; }

    public Guid? BoundByUserId { get; set; }

    public User? BoundByUser { get; set; }

    public DateTimeOffset? LastScannedAt { get; set; }

    public Guid CreatedByUserId { get; set; }

    public User CreatedByUser { get; set; } = null!;

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
