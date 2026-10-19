using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Maintenance;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class MaintenanceService(WhereHouseDbContext dbContext) : IMaintenanceService
{
    public async Task<MaintenanceSummaryDto> GetSummaryAsync(
        Guid userId,
        Guid? itemId = null,
        bool dueOnly = false,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var locationMap = allLocations.ToDictionary(l => l.Id);
        var accessibleLocationIds = ComputeAccessibleLocationIds(allLocations, userId);

        var utcNow = DateTimeOffset.UtcNow;

        var schedulesQuery = dbContext
            .MaintenanceSchedules.AsNoTracking()
            .Include(s => s.Item)
            .Where(s => s.Item.Status != Core.Items.ItemStatus.Archived);

        if (itemId.HasValue)
        {
            schedulesQuery = schedulesQuery.Where(s => s.ItemId == itemId.Value);
        }

        var allSchedules = await schedulesQuery.ToListAsync(cancellationToken);

        var accessibleSchedules = allSchedules
            .Where(s =>
            {
                if (s.Item.IsPrivate && s.Item.OwnerId != userId)
                {
                    return false;
                }

                if (
                    s.Item.HomeLocationId.HasValue
                    && !accessibleLocationIds.Contains(s.Item.HomeLocationId.Value)
                )
                {
                    return false;
                }

                return true;
            })
            .ToList();

        var scheduleDtos = accessibleSchedules
            .Select(s => MapScheduleToDto(s, locationMap, utcNow))
            .ToList();

        var totalActive = scheduleDtos.Count(s => s.IsActive);
        var overdueCount = scheduleDtos.Count(s =>
            s.IsActive && s.DueStatus == MaintenanceDueStatus.Overdue
        );
        var dueSoonCount = scheduleDtos.Count(s =>
            s.IsActive && s.DueStatus == MaintenanceDueStatus.DueSoon
        );
        var upToDateCount = scheduleDtos.Count(s =>
            s.IsActive && s.DueStatus == MaintenanceDueStatus.UpToDate
        );

        var filteredSchedules = scheduleDtos;
        if (dueOnly)
        {
            filteredSchedules = scheduleDtos
                .Where(s =>
                    s.IsActive
                    && (
                        s.DueStatus == MaintenanceDueStatus.Overdue
                        || s.DueStatus == MaintenanceDueStatus.DueSoon
                    )
                )
                .ToList();
        }

        // Sort by DueStatus priority (Overdue=2, DueSoon=1, UpToDate=0, Paused=3), then NextDueAt
        var sortedSchedules = filteredSchedules
            .OrderBy(s => GetStatusSortOrder(s.DueStatus))
            .ThenBy(s => s.NextDueAt)
            .ToList();

        // Logs query
        var logsQuery = dbContext
            .MaintenanceLogs.AsNoTracking()
            .Include(l => l.Schedule)
                .ThenInclude(s => s.Item)
            .AsQueryable();

        if (itemId.HasValue)
        {
            logsQuery = logsQuery.Where(l => l.ItemId == itemId.Value);
        }

        var candidateLogs = await logsQuery
            .OrderByDescending(l => l.CompletedAt)
            .Take(50)
            .ToListAsync(cancellationToken);

        var accessibleLogs = candidateLogs
            .Where(l =>
            {
                var itm = l.Schedule?.Item;
                if (itm == null)
                {
                    return false;
                }

                if (itm.IsPrivate && itm.OwnerId != userId)
                {
                    return false;
                }

                if (
                    itm.HomeLocationId.HasValue
                    && !accessibleLocationIds.Contains(itm.HomeLocationId.Value)
                )
                {
                    return false;
                }

                return true;
            })
            .Take(20)
            .Select(MapLogToDto)
            .ToList();

        return new MaintenanceSummaryDto(
            totalActive,
            overdueCount,
            dueSoonCount,
            upToDateCount,
            sortedSchedules,
            accessibleLogs
        );
    }

    public async Task<IReadOnlyList<MaintenanceScheduleDto>?> GetItemSchedulesAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    )
    {
        var item = await VerifyItemAccessAsync(userId, itemId, cancellationToken);
        if (item is null)
        {
            return null;
        }

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var locationMap = allLocations.ToDictionary(l => l.Id);
        var utcNow = DateTimeOffset.UtcNow;

        var schedules = await dbContext
            .MaintenanceSchedules.AsNoTracking()
            .Include(s => s.Item)
            .Where(s => s.ItemId == itemId)
            .OrderBy(s => s.NextDueAt)
            .ToListAsync(cancellationToken);

        return schedules.Select(s => MapScheduleToDto(s, locationMap, utcNow)).ToList();
    }

    public async Task<IReadOnlyList<MaintenanceLogDto>?> GetItemLogsAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    )
    {
        var item = await VerifyItemAccessAsync(userId, itemId, cancellationToken);
        if (item is null)
        {
            return null;
        }

        var logs = await dbContext
            .MaintenanceLogs.AsNoTracking()
            .Include(l => l.Schedule)
                .ThenInclude(s => s.Item)
            .Where(l => l.ItemId == itemId)
            .OrderByDescending(l => l.CompletedAt)
            .ToListAsync(cancellationToken);

        return logs.Select(MapLogToDto).ToList();
    }

    public async Task<MaintenanceScheduleDto?> CreateScheduleAsync(
        Guid userId,
        Guid itemId,
        CreateMaintenanceScheduleRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var item = await VerifyItemAccessAsync(userId, itemId, cancellationToken);
        if (item is null)
        {
            return null;
        }

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            throw new ArgumentException("Title is required.");
        }

        if (request.IntervalValue < 1)
        {
            throw new ArgumentException("Interval value must be at least 1.");
        }

        var nextDueAt =
            request.FirstDueAt.HasValue ? request.FirstDueAt.Value
            : request.LastCompletedAt.HasValue
                ? ComputeNextDueDate(
                    request.LastCompletedAt.Value,
                    request.IntervalValue,
                    request.IntervalUnit
                )
            : ComputeNextDueDate(
                DateTimeOffset.UtcNow,
                request.IntervalValue,
                request.IntervalUnit
            );

        var schedule = new MaintenanceSchedule
        {
            ItemId = itemId,
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            IntervalValue = request.IntervalValue,
            IntervalUnit = request.IntervalUnit,
            LastCompletedAt = request.LastCompletedAt,
            NextDueAt = nextDueAt,
            IsActive = true,
            CreatedByUserId = userId,
        };

        dbContext.MaintenanceSchedules.Add(schedule);
        item.LastTouchedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var locationMap = allLocations.ToDictionary(l => l.Id);
        schedule.Item = item;

        return MapScheduleToDto(schedule, locationMap, DateTimeOffset.UtcNow);
    }

    public async Task<MaintenanceScheduleDto?> UpdateScheduleAsync(
        Guid userId,
        Guid scheduleId,
        UpdateMaintenanceScheduleRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var schedule = await dbContext
            .MaintenanceSchedules.Include(s => s.Item)
            .SingleOrDefaultAsync(s => s.Id == scheduleId, cancellationToken);

        if (schedule is null)
        {
            return null;
        }

        await VerifyItemAccessInternalAsync(userId, schedule.Item, cancellationToken);

        if (string.IsNullOrWhiteSpace(request.Title))
        {
            throw new ArgumentException("Title is required.");
        }

        if (request.IntervalValue < 1)
        {
            throw new ArgumentException("Interval value must be at least 1.");
        }

        schedule.Title = request.Title.Trim();
        schedule.Description = request.Description?.Trim();
        schedule.IntervalValue = request.IntervalValue;
        schedule.IntervalUnit = request.IntervalUnit;
        schedule.IsActive = request.IsActive;

        if (request.NextDueAt.HasValue)
        {
            schedule.NextDueAt = request.NextDueAt.Value;
        }

        schedule.Item.LastTouchedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var locationMap = allLocations.ToDictionary(l => l.Id);

        return MapScheduleToDto(schedule, locationMap, DateTimeOffset.UtcNow);
    }

    public async Task<MaintenanceScheduleDto?> CompleteTaskAsync(
        Guid userId,
        Guid scheduleId,
        CompleteMaintenanceTaskRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var schedule = await dbContext
            .MaintenanceSchedules.Include(s => s.Item)
            .SingleOrDefaultAsync(s => s.Id == scheduleId, cancellationToken);

        if (schedule is null)
        {
            return null;
        }

        await VerifyItemAccessInternalAsync(userId, schedule.Item, cancellationToken);

        var user = await dbContext
            .Users.AsNoTracking()
            .SingleOrDefaultAsync(u => u.Id == userId, cancellationToken);
        var username = user?.Username ?? "Household User";

        var completedAt = request.CompletedAt ?? DateTimeOffset.UtcNow;

        var log = new MaintenanceLog
        {
            ScheduleId = schedule.Id,
            ItemId = schedule.ItemId,
            CompletedAt = completedAt,
            CompletedByUserId = userId,
            CompletedByUsername = username,
            Notes = request.Notes?.Trim(),
            Cost = request.Cost,
        };

        dbContext.MaintenanceLogs.Add(log);

        schedule.LastCompletedAt = completedAt;
        schedule.NextDueAt = ComputeNextDueDate(
            completedAt,
            schedule.IntervalValue,
            schedule.IntervalUnit
        );
        schedule.Item.LastTouchedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var locationMap = allLocations.ToDictionary(l => l.Id);

        return MapScheduleToDto(schedule, locationMap, DateTimeOffset.UtcNow);
    }

    public async Task<bool> DeleteScheduleAsync(
        Guid userId,
        Guid scheduleId,
        CancellationToken cancellationToken = default
    )
    {
        var schedule = await dbContext
            .MaintenanceSchedules.Include(s => s.Item)
            .SingleOrDefaultAsync(s => s.Id == scheduleId, cancellationToken);

        if (schedule is null)
        {
            return false;
        }

        await VerifyItemAccessInternalAsync(userId, schedule.Item, cancellationToken);

        dbContext.MaintenanceSchedules.Remove(schedule);
        schedule.Item.LastTouchedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    public static DateTimeOffset ComputeNextDueDate(
        DateTimeOffset fromDate,
        int intervalValue,
        MaintenanceIntervalUnit unit
    )
    {
        return unit switch
        {
            MaintenanceIntervalUnit.Days => fromDate.AddDays(intervalValue),
            MaintenanceIntervalUnit.Weeks => fromDate.AddDays(intervalValue * 7),
            MaintenanceIntervalUnit.Months => fromDate.AddMonths(intervalValue),
            MaintenanceIntervalUnit.Years => fromDate.AddYears(intervalValue),
            _ => fromDate.AddDays(intervalValue),
        };
    }

    public static (MaintenanceDueStatus Status, int DaysUntilDue) ComputeDueStatus(
        DateTimeOffset nextDueAt,
        bool isActive,
        DateTimeOffset utcNow
    )
    {
        var daysUntilDue = (int)Math.Ceiling((nextDueAt - utcNow).TotalDays);

        if (!isActive)
        {
            return (MaintenanceDueStatus.Paused, daysUntilDue);
        }

        if (nextDueAt < utcNow)
        {
            return (MaintenanceDueStatus.Overdue, daysUntilDue);
        }

        if (nextDueAt <= utcNow.AddDays(14))
        {
            return (MaintenanceDueStatus.DueSoon, daysUntilDue);
        }

        return (MaintenanceDueStatus.UpToDate, daysUntilDue);
    }

    private static int GetStatusSortOrder(MaintenanceDueStatus status) =>
        status switch
        {
            MaintenanceDueStatus.Overdue => 0,
            MaintenanceDueStatus.DueSoon => 1,
            MaintenanceDueStatus.UpToDate => 2,
            MaintenanceDueStatus.Paused => 3,
            _ => 4,
        };

    private async Task<InventoryItem?> VerifyItemAccessAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken
    )
    {
        var item = await dbContext.InventoryItems.SingleOrDefaultAsync(
            i => i.Id == itemId,
            cancellationToken
        );

        if (item is null)
        {
            return null;
        }

        await VerifyItemAccessInternalAsync(userId, item, cancellationToken);
        return item;
    }

    private async Task VerifyItemAccessInternalAsync(
        Guid userId,
        InventoryItem item,
        CancellationToken cancellationToken
    )
    {
        if (item.IsPrivate && item.OwnerId != userId)
        {
            throw new ForbiddenException(
                "You do not have permission to access maintenance schedules for this private item."
            );
        }

        if (item.HomeLocationId.HasValue)
        {
            var allLocations = await dbContext
                .LocationNodes.AsNoTracking()
                .ToListAsync(cancellationToken);

            var locationMap = allLocations.ToDictionary(n => n.Id);
            var currentId = item.HomeLocationId;

            while (currentId.HasValue && locationMap.TryGetValue(currentId.Value, out var loc))
            {
                if (loc.IsPrivate && loc.OwnerId != userId)
                {
                    throw new ForbiddenException(
                        "You do not have permission to access maintenance schedules for this item stored in a private location."
                    );
                }
                currentId = loc.ParentId;
            }
        }
    }

    private static HashSet<Guid> ComputeAccessibleLocationIds(
        IReadOnlyList<LocationNode> allLocations,
        Guid userId
    )
    {
        var locationMap = allLocations.ToDictionary(l => l.Id);
        var accessible = new HashSet<Guid>();

        foreach (var loc in allLocations)
        {
            var isAccessible = true;
            LocationNode? curr = loc;
            while (curr != null)
            {
                if (curr.IsPrivate && curr.OwnerId != userId)
                {
                    isAccessible = false;
                    break;
                }
                curr =
                    curr.ParentId.HasValue
                    && locationMap.TryGetValue(curr.ParentId.Value, out var parent)
                        ? parent
                        : null;
            }

            if (isAccessible)
            {
                accessible.Add(loc.Id);
            }
        }

        return accessible;
    }

    private static string? BuildFullPath(
        Guid? locationId,
        IReadOnlyDictionary<Guid, LocationNode> locationMap
    )
    {
        if (!locationId.HasValue || !locationMap.TryGetValue(locationId.Value, out var node))
        {
            return null;
        }

        var segments = new List<string>();
        LocationNode? current = node;
        while (current != null)
        {
            segments.Add(current.Name);
            current =
                current.ParentId.HasValue
                && locationMap.TryGetValue(current.ParentId.Value, out var p)
                    ? p
                    : null;
        }

        segments.Reverse();
        return string.Join(" / ", segments);
    }

    private static MaintenanceScheduleDto MapScheduleToDto(
        MaintenanceSchedule s,
        IReadOnlyDictionary<Guid, LocationNode> locationMap,
        DateTimeOffset utcNow
    )
    {
        var (dueStatus, daysUntilDue) = ComputeDueStatus(s.NextDueAt, s.IsActive, utcNow);
        var locationFullPath = BuildFullPath(s.Item.HomeLocationId, locationMap);

        return new MaintenanceScheduleDto(
            s.Id,
            s.ItemId,
            s.Item.ShortCode,
            s.Item.Name,
            locationFullPath,
            s.Title,
            s.Description,
            s.IntervalValue,
            s.IntervalUnit,
            s.LastCompletedAt,
            s.NextDueAt,
            s.IsActive,
            dueStatus,
            daysUntilDue,
            s.CreatedAt,
            s.ModifiedAt
        );
    }

    private static MaintenanceLogDto MapLogToDto(MaintenanceLog l) =>
        new(
            l.Id,
            l.ScheduleId,
            l.ItemId,
            l.Schedule?.Item?.ShortCode ?? string.Empty,
            l.Schedule?.Item?.Name ?? string.Empty,
            l.Schedule?.Title ?? string.Empty,
            l.CompletedAt,
            l.CompletedByUserId,
            l.CompletedByUsername,
            l.Notes,
            l.Cost
        );
}
