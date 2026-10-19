namespace WhereHouse.Core.Maintenance;

public interface IMaintenanceService
{
    Task<MaintenanceSummaryDto> GetSummaryAsync(
        Guid userId,
        Guid? itemId = null,
        bool dueOnly = false,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<MaintenanceScheduleDto>?> GetItemSchedulesAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    );

    Task<IReadOnlyList<MaintenanceLogDto>?> GetItemLogsAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    );

    Task<MaintenanceScheduleDto?> CreateScheduleAsync(
        Guid userId,
        Guid itemId,
        CreateMaintenanceScheduleRequest request,
        CancellationToken cancellationToken = default
    );

    Task<MaintenanceScheduleDto?> UpdateScheduleAsync(
        Guid userId,
        Guid scheduleId,
        UpdateMaintenanceScheduleRequest request,
        CancellationToken cancellationToken = default
    );

    Task<MaintenanceScheduleDto?> CompleteTaskAsync(
        Guid userId,
        Guid scheduleId,
        CompleteMaintenanceTaskRequest request,
        CancellationToken cancellationToken = default
    );

    Task<bool> DeleteScheduleAsync(
        Guid userId,
        Guid scheduleId,
        CancellationToken cancellationToken = default
    );
}
