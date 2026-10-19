using System.ComponentModel.DataAnnotations;

namespace WhereHouse.Core.Maintenance;

public enum MaintenanceIntervalUnit
{
    Days = 0,
    Weeks = 1,
    Months = 2,
    Years = 3,
}

public enum MaintenanceDueStatus
{
    UpToDate = 0,
    DueSoon = 1,
    Overdue = 2,
    Paused = 3,
}

public sealed record MaintenanceScheduleDto(
    Guid Id,
    Guid ItemId,
    string ItemShortCode,
    string ItemName,
    string? ItemLocationFullPath,
    string Title,
    string? Description,
    int IntervalValue,
    MaintenanceIntervalUnit IntervalUnit,
    DateTimeOffset? LastCompletedAt,
    DateTimeOffset NextDueAt,
    bool IsActive,
    MaintenanceDueStatus DueStatus,
    int DaysUntilDue,
    DateTimeOffset CreatedAt,
    DateTimeOffset ModifiedAt
);

public sealed record MaintenanceLogDto(
    Guid Id,
    Guid ScheduleId,
    Guid ItemId,
    string ItemShortCode,
    string ItemName,
    string ScheduleTitle,
    DateTimeOffset CompletedAt,
    Guid CompletedByUserId,
    string CompletedByUsername,
    string? Notes,
    decimal? Cost
);

public sealed record MaintenanceSummaryDto(
    int TotalActiveSchedules,
    int OverdueCount,
    int DueSoonCount,
    int UpToDateCount,
    IReadOnlyList<MaintenanceScheduleDto> Schedules,
    IReadOnlyList<MaintenanceLogDto> RecentLogs
);

public sealed record CreateMaintenanceScheduleRequest(
    [Required, MaxLength(200)] string Title,
    [MaxLength(1000)] string? Description = null,
    [Range(1, 3650)] int IntervalValue = 90,
    MaintenanceIntervalUnit IntervalUnit = MaintenanceIntervalUnit.Days,
    DateTimeOffset? FirstDueAt = null,
    DateTimeOffset? LastCompletedAt = null
);

public sealed record UpdateMaintenanceScheduleRequest(
    [Required, MaxLength(200)] string Title,
    [MaxLength(1000)] string? Description = null,
    [Range(1, 3650)] int IntervalValue = 90,
    MaintenanceIntervalUnit IntervalUnit = MaintenanceIntervalUnit.Days,
    DateTimeOffset? NextDueAt = null,
    bool IsActive = true
);

public sealed record CompleteMaintenanceTaskRequest(
    [MaxLength(1000)] string? Notes = null,
    [Range(0, 1000000)] decimal? Cost = null,
    DateTimeOffset? CompletedAt = null
);
