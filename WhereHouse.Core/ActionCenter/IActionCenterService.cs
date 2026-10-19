namespace WhereHouse.Core.ActionCenter;

public interface IActionCenterService
{
    Task<ActionCenterOverviewDto> GetOverviewAsync(
        Guid userId,
        int coverageWindowDays = 30,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<NotificationChannelDto>> GetChannelsAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    );

    Task<NotificationChannelDto?> GetChannelByIdAsync(
        Guid userId,
        Guid channelId,
        CancellationToken cancellationToken = default
    );

    Task<NotificationChannelDto> CreateChannelAsync(
        Guid userId,
        CreateNotificationChannelRequest request,
        CancellationToken cancellationToken = default
    );

    Task<NotificationChannelDto?> UpdateChannelAsync(
        Guid userId,
        Guid channelId,
        UpdateNotificationChannelRequest request,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteChannelAsync(
        Guid userId,
        Guid channelId,
        CancellationToken cancellationToken = default
    );

    Task<NotificationDeliveryLogDto?> SendTestNotificationAsync(
        Guid userId,
        Guid channelId,
        CancellationToken cancellationToken = default
    );

    Task<NotificationDispatchResultDto> SendDigestAsync(
        Guid userId,
        SendNotificationDigestRequest request,
        CancellationToken cancellationToken = default
    );

    Task<NotificationDispatchResultDto> ProcessScheduledNotificationsAsync(
        DateTimeOffset utcNow,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<NotificationDeliveryLogDto>> GetRecentDeliveriesAsync(
        Guid userId,
        int limit = 30,
        CancellationToken cancellationToken = default
    );
}
