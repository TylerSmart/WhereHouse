using WhereHouse.Core.Maintenance;

namespace WhereHouse.Data.Entities;

public sealed class MaintenanceSchedule : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ItemId { get; set; }

    public InventoryItem Item { get; set; } = null!;

    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public int IntervalValue { get; set; } = 90;

    public MaintenanceIntervalUnit IntervalUnit { get; set; } = MaintenanceIntervalUnit.Days;

    public DateTimeOffset? LastCompletedAt { get; set; }

    public DateTimeOffset NextDueAt { get; set; }

    public bool IsActive { get; set; } = true;

    public Guid CreatedByUserId { get; set; }

    public ICollection<MaintenanceLog> Logs { get; set; } = new List<MaintenanceLog>();

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
