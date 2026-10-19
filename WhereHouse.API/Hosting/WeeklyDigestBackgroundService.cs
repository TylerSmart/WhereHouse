using WhereHouse.Core.ActionCenter;

namespace WhereHouse.API.Hosting;

public sealed class WeeklyDigestBackgroundService(
    IServiceScopeFactory scopeFactory,
    ILogger<WeeklyDigestBackgroundService> logger
) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("WeeklyDigestBackgroundService started.");

        using var timer = new PeriodicTimer(Interval);

        try
        {
            // Initial check shortly after startup
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
            await RunDigestCheckAsync(stoppingToken);

            while (
                !stoppingToken.IsCancellationRequested
                && await timer.WaitForNextTickAsync(stoppingToken)
            )
            {
                await RunDigestCheckAsync(stoppingToken);
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
            logger.LogInformation("WeeklyDigestBackgroundService stopping.");
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled error in WeeklyDigestBackgroundService.");
        }
    }

    private async Task RunDigestCheckAsync(CancellationToken cancellationToken)
    {
        try
        {
            using var scope = scopeFactory.CreateScope();
            var actionCenterService =
                scope.ServiceProvider.GetRequiredService<IActionCenterService>();
            var result = await actionCenterService.ProcessScheduledNotificationsAsync(
                DateTimeOffset.UtcNow,
                cancellationToken
            );

            if (result.ChannelsTargeted > 0)
            {
                logger.LogInformation(
                    "Processed scheduled notifications: {Dispatched} dispatched ({Success} succeeded, {Failure} failed).",
                    result.ChannelsTargeted,
                    result.SuccessCount,
                    result.FailureCount
                );
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Clean shutdown
        }
        catch (Exception ex)
        {
            logger.LogError(
                ex,
                "Error processing scheduled digests in WeeklyDigestBackgroundService."
            );
        }
    }
}
