namespace WhereHouse.Core.ActionCenter;

public interface INotificationDispatcher
{
    Task<NotificationTransportOutcome> DispatchAsync(
        NotificationDispatchCommand command,
        CancellationToken cancellationToken = default
    );
}
