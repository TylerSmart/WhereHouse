using WhereHouse.Core.ActionCenter;

namespace WhereHouse.Data.Entities;

public sealed class NotificationChannel : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid OwnerId { get; set; }

    public User Owner { get; set; } = null!;

    public string Name { get; set; } = string.Empty;

    public NotificationChannelType ChannelType { get; set; } = NotificationChannelType.Ntfy;

    public bool IsEnabled { get; set; } = true;

    public bool IsSharedHouseholdChannel { get; set; }

    public string? EndpointUrl { get; set; }

    public string? AccessTokenOrKey { get; set; }

    public string? RecipientOrUserKey { get; set; }

    public string? SmtpHost { get; set; }

    public int? SmtpPort { get; set; } = 587;

    public string? SmtpUsername { get; set; }

    public string? SmtpFromAddress { get; set; }

    public bool SmtpUseSsl { get; set; } = true;

    public bool NotifyOnOverdueLoans { get; set; } = true;

    public bool NotifyOnMaintenanceDue { get; set; } = true;

    public bool NotifyOnExpiringWarranties { get; set; } = true;

    public bool NotifyOnLowStock { get; set; } = true;

    public bool EnableWeeklyDigest { get; set; } = true;

    public DayOfWeek DigestDayOfWeek { get; set; } = DayOfWeek.Sunday;

    public int DigestHourUtc { get; set; } = 9;

    public DateTimeOffset? LastTriggeredAt { get; set; }

    public string? LastDeliveryStatus { get; set; }

    public ICollection<NotificationDeliveryLog> DeliveryLogs { get; set; } =
        new List<NotificationDeliveryLog>();

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
