namespace WhereHouse.Data.Entities;

public sealed class MaintenanceLog : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ScheduleId { get; set; }

    public MaintenanceSchedule Schedule { get; set; } = null!;

    public Guid ItemId { get; set; }

    public DateTimeOffset CompletedAt { get; set; }

    public Guid CompletedByUserId { get; set; }

    public string CompletedByUsername { get; set; } = string.Empty;

    public string? Notes { get; set; }

    public decimal? Cost { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
