using System.ComponentModel.DataAnnotations;
using WhereHouse.Core.Maintenance;

namespace WhereHouse.Core.ActionCenter;

public enum NotificationChannelType
{
    Ntfy = 0,
    SlackWebhook = 1,
    Pushover = 2,
    SmtpEmail = 3,
}

public enum NotificationEventType
{
    TestNotification = 0,
    WeeklyDigest = 1,
    OverdueLoanAlert = 2,
    MaintenanceDueAlert = 3,
    WarrantyReturnExpiryAlert = 4,
    LowStockAlert = 5,
}

public enum WarrantyOrReturnAlertType
{
    ReturnWindow = 0,
    WarrantyExpiration = 1,
}

public sealed record OutOfPlaceItemAlertDto(
    Guid ItemId,
    string ShortCode,
    string Name,
    string? HomeLocationId,
    string? HomeLocationFullPath,
    Guid? CheckedOutByUserId,
    string? CheckedOutByUsername,
    string? CheckoutNote,
    Guid? ActiveLoadoutId,
    string? ActiveLoadoutName,
    DateTimeOffset? CheckedOutAt,
    int DaysOut
);

public sealed record ExternalLoanAlertDto(
    Guid ItemId,
    string ShortCode,
    string Name,
    string? HomeLocationFullPath,
    string? BorrowerName,
    string? BorrowerContact,
    string? CheckoutNote,
    DateTimeOffset? CheckedOutAt,
    DateTimeOffset? DueAt,
    bool IsOverdue,
    int? DaysUntilDue
);

public sealed record ExpiringCoverageAlertDto(
    Guid ItemId,
    string ShortCode,
    string Name,
    string? Brand,
    string? ModelNumber,
    string? Retailer,
    decimal? PurchasePrice,
    string? HomeLocationFullPath,
    WarrantyOrReturnAlertType AlertType,
    DateTimeOffset ExpirationDate,
    int DaysRemaining,
    bool IsExpired,
    string? WarrantyNotes
);

public sealed record LowStockItemAlertDto(
    Guid ItemId,
    string ShortCode,
    string Name,
    string? CategoryName,
    string? HomeLocationFullPath,
    decimal CurrentQuantity,
    decimal MinQuantity,
    string? Unit
);

public sealed record ActionCenterOverviewDto(
    int TotalAlertsCount,
    int OutOfPlaceCount,
    int ActiveLoansCount,
    int OverdueLoansCount,
    int MaintenanceDueCount,
    int MaintenanceOverdueCount,
    int ExpiringCoverageCount,
    int LowStockCount,
    IReadOnlyList<OutOfPlaceItemAlertDto> OutOfPlaceItems,
    IReadOnlyList<ExternalLoanAlertDto> ExternalLoans,
    IReadOnlyList<MaintenanceScheduleDto> DueMaintenanceSchedules,
    IReadOnlyList<ExpiringCoverageAlertDto> ExpiringCoverages,
    IReadOnlyList<LowStockItemAlertDto> LowStockItems
);

public sealed record NotificationChannelDto(
    Guid Id,
    Guid OwnerId,
    string Name,
    NotificationChannelType ChannelType,
    bool IsEnabled,
    bool IsSharedHouseholdChannel,
    string? EndpointUrl,
    bool HasAccessTokenOrKey,
    string? RecipientOrUserKey,
    string? SmtpHost,
    int? SmtpPort,
    string? SmtpUsername,
    string? SmtpFromAddress,
    bool SmtpUseSsl,
    bool NotifyOnOverdueLoans,
    bool NotifyOnMaintenanceDue,
    bool NotifyOnExpiringWarranties,
    bool NotifyOnLowStock,
    bool EnableWeeklyDigest,
    DayOfWeek DigestDayOfWeek,
    int DigestHourUtc,
    DateTimeOffset? LastTriggeredAt,
    string? LastDeliveryStatus,
    DateTimeOffset CreatedAt,
    DateTimeOffset ModifiedAt
);

public sealed record NotificationDeliveryLogDto(
    Guid Id,
    Guid ChannelId,
    string ChannelName,
    NotificationChannelType ChannelType,
    NotificationEventType EventType,
    string Subject,
    string MessageBody,
    bool Success,
    string? ResponseSummary,
    DateTimeOffset DeliveredAt
);

public sealed record CreateNotificationChannelRequest(
    [Required, MaxLength(150)] string Name,
    NotificationChannelType ChannelType = NotificationChannelType.Ntfy,
    bool IsEnabled = true,
    bool IsSharedHouseholdChannel = false,
    [MaxLength(1000)] string? EndpointUrl = null,
    [MaxLength(500)] string? AccessTokenOrKey = null,
    [MaxLength(320)] string? RecipientOrUserKey = null,
    [MaxLength(255)] string? SmtpHost = null,
    [Range(1, 65535)] int? SmtpPort = 587,
    [MaxLength(255)] string? SmtpUsername = null,
    [MaxLength(320)] string? SmtpFromAddress = null,
    bool SmtpUseSsl = true,
    bool NotifyOnOverdueLoans = true,
    bool NotifyOnMaintenanceDue = true,
    bool NotifyOnExpiringWarranties = true,
    bool NotifyOnLowStock = true,
    bool EnableWeeklyDigest = true,
    DayOfWeek DigestDayOfWeek = DayOfWeek.Sunday,
    [Range(0, 23)] int DigestHourUtc = 9
);

public sealed record UpdateNotificationChannelRequest(
    [Required, MaxLength(150)] string Name,
    NotificationChannelType ChannelType = NotificationChannelType.Ntfy,
    bool IsEnabled = true,
    bool IsSharedHouseholdChannel = false,
    [MaxLength(1000)] string? EndpointUrl = null,
    [MaxLength(500)] string? AccessTokenOrKey = null,
    bool ClearAccessTokenOrKey = false,
    [MaxLength(320)] string? RecipientOrUserKey = null,
    [MaxLength(255)] string? SmtpHost = null,
    [Range(1, 65535)] int? SmtpPort = 587,
    [MaxLength(255)] string? SmtpUsername = null,
    [MaxLength(320)] string? SmtpFromAddress = null,
    bool SmtpUseSsl = true,
    bool NotifyOnOverdueLoans = true,
    bool NotifyOnMaintenanceDue = true,
    bool NotifyOnExpiringWarranties = true,
    bool NotifyOnLowStock = true,
    bool EnableWeeklyDigest = true,
    DayOfWeek DigestDayOfWeek = DayOfWeek.Sunday,
    [Range(0, 23)] int DigestHourUtc = 9
);

public sealed record SendNotificationDigestRequest(
    Guid? ChannelId = null,
    [Range(1, 365)] int CoverageWindowDays = 30
);

public sealed record NotificationDispatchResultDto(
    int ChannelsTargeted,
    int SuccessCount,
    int FailureCount,
    string DigestSubject,
    string DigestBodyPreview,
    IReadOnlyList<NotificationDeliveryLogDto> Deliveries
);

public sealed record NotificationDispatchCommand(
    NotificationChannelType ChannelType,
    string ChannelName,
    string? EndpointUrl,
    string? AccessTokenOrKey,
    string? RecipientOrUserKey,
    string? SmtpHost,
    int? SmtpPort,
    string? SmtpUsername,
    string? SmtpFromAddress,
    bool SmtpUseSsl,
    string Subject,
    string MessageBody
);

public sealed record NotificationTransportOutcome(bool Success, string ResponseSummary);
