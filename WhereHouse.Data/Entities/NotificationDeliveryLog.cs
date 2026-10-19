using WhereHouse.Core.ActionCenter;

namespace WhereHouse.Data.Entities;

public sealed class NotificationDeliveryLog : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ChannelId { get; set; }

    public NotificationChannel Channel { get; set; } = null!;

    public Guid OwnerId { get; set; }

    public string ChannelName { get; set; } = string.Empty;

    public NotificationChannelType ChannelType { get; set; }

    public NotificationEventType EventType { get; set; }

    public string Subject { get; set; } = string.Empty;

    public string MessageBody { get; set; } = string.Empty;

    public bool Success { get; set; }

    public string? ResponseSummary { get; set; }

    public DateTimeOffset DeliveredAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
