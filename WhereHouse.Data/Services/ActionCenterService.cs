using System.Text;
using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.ActionCenter;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Items;
using WhereHouse.Core.Maintenance;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class ActionCenterService(
    WhereHouseDbContext dbContext,
    INotificationDispatcher notificationDispatcher
) : IActionCenterService
{
    public async Task<ActionCenterOverviewDto> GetOverviewAsync(
        Guid userId,
        int coverageWindowDays = 30,
        CancellationToken cancellationToken = default
    )
    {
        coverageWindowDays = Math.Clamp(coverageWindowDays, 1, 365);
        var utcNow = DateTimeOffset.UtcNow;
        var coverageMinDate = utcNow.AddDays(-7);
        var coverageMaxDate = utcNow.AddDays(coverageWindowDays);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var locationMap = allLocations.ToDictionary(l => l.Id);
        var accessibleLocationIds = ComputeAccessibleLocationIds(allLocations, userId);

        var allItems = await dbContext
            .InventoryItems.AsNoTracking()
            .Include(i => i.Category)
            .Where(i => i.Status != ItemStatus.Archived)
            .ToListAsync(cancellationToken);

        var accessibleItems = allItems
            .Where(i =>
            {
                if (i.IsPrivate && i.OwnerId != userId)
                {
                    return false;
                }

                if (
                    i.HomeLocationId.HasValue
                    && !accessibleLocationIds.Contains(i.HomeLocationId.Value)
                )
                {
                    return false;
                }

                return true;
            })
            .ToList();

        // 1. Out of Place items (InUse)
        var outOfPlaceList = accessibleItems
            .Where(i => i.Status == ItemStatus.InUse)
            .OrderBy(i => i.CheckedOutAt ?? i.ModifiedAt)
            .Select(i =>
            {
                var daysOut = i.CheckedOutAt.HasValue
                    ? Math.Max(0, (int)Math.Floor((utcNow - i.CheckedOutAt.Value).TotalDays))
                    : 0;

                return new OutOfPlaceItemAlertDto(
                    i.Id,
                    i.ShortCode,
                    i.Name,
                    i.HomeLocationId?.ToString(),
                    ResolveLocationPath(i.HomeLocationId, locationMap),
                    i.CheckedOutByUserId,
                    i.CheckedOutByUsername,
                    i.CheckoutNote,
                    i.ActiveLoadoutId,
                    i.ActiveLoadoutName,
                    i.CheckedOutAt,
                    daysOut
                );
            })
            .ToList();

        // 2. Active External Loans (LoanedOut)
        var loansList = accessibleItems
            .Where(i => i.Status == ItemStatus.LoanedOut)
            .Select(i =>
            {
                var isOverdue = i.CheckoutDueAt.HasValue && i.CheckoutDueAt.Value < utcNow;
                var daysUntilDue = i.CheckoutDueAt.HasValue
                    ? (int)Math.Ceiling((i.CheckoutDueAt.Value - utcNow).TotalDays)
                    : (int?)null;

                return new ExternalLoanAlertDto(
                    i.Id,
                    i.ShortCode,
                    i.Name,
                    ResolveLocationPath(i.HomeLocationId, locationMap),
                    i.CheckedOutToBorrower,
                    i.CheckedOutBorrowerContact,
                    i.CheckoutNote,
                    i.CheckedOutAt,
                    i.CheckoutDueAt,
                    isOverdue,
                    daysUntilDue
                );
            })
            .OrderByDescending(l => l.IsOverdue)
            .ThenBy(l => l.DueAt ?? DateTimeOffset.MaxValue)
            .ToList();

        // 3. Maintenance Due (Overdue or DueSoon)
        var allSchedules = await dbContext
            .MaintenanceSchedules.AsNoTracking()
            .Include(s => s.Item)
            .Where(s => s.IsActive && s.Item.Status != ItemStatus.Archived)
            .ToListAsync(cancellationToken);

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

        var dueMaintenanceList = new List<MaintenanceScheduleDto>();
        foreach (var s in accessibleSchedules)
        {
            var dueStatus = CalculateDueStatus(s.NextDueAt, utcNow, s.IsActive);
            if (dueStatus is MaintenanceDueStatus.Overdue or MaintenanceDueStatus.DueSoon)
            {
                var daysUntil = (int)Math.Ceiling((s.NextDueAt - utcNow).TotalDays);
                dueMaintenanceList.Add(
                    new MaintenanceScheduleDto(
                        s.Id,
                        s.ItemId,
                        s.Item.ShortCode,
                        s.Item.Name,
                        ResolveLocationPath(s.Item.HomeLocationId, locationMap),
                        s.Title,
                        s.Description,
                        s.IntervalValue,
                        s.IntervalUnit,
                        s.LastCompletedAt,
                        s.NextDueAt,
                        s.IsActive,
                        dueStatus,
                        daysUntil,
                        s.CreatedAt,
                        s.ModifiedAt
                    )
                );
            }
        }

        dueMaintenanceList = dueMaintenanceList
            .OrderByDescending(s => s.DueStatus == MaintenanceDueStatus.Overdue)
            .ThenBy(s => s.NextDueAt)
            .ToList();

        // 4. Expiring Warranties & Return Windows
        var coverageList = new List<ExpiringCoverageAlertDto>();
        foreach (var i in accessibleItems)
        {
            var locationPath = ResolveLocationPath(i.HomeLocationId, locationMap);

            if (
                i.ReturnWindowEndDate.HasValue
                && i.ReturnWindowEndDate.Value >= coverageMinDate
                && i.ReturnWindowEndDate.Value <= coverageMaxDate
            )
            {
                var isExpired = i.ReturnWindowEndDate.Value < utcNow;
                var daysRemaining = (int)
                    Math.Ceiling((i.ReturnWindowEndDate.Value - utcNow).TotalDays);

                coverageList.Add(
                    new ExpiringCoverageAlertDto(
                        i.Id,
                        i.ShortCode,
                        i.Name,
                        i.Brand,
                        i.ModelNumber,
                        i.Retailer,
                        i.PurchasePrice,
                        locationPath,
                        WarrantyOrReturnAlertType.ReturnWindow,
                        i.ReturnWindowEndDate.Value,
                        daysRemaining,
                        isExpired,
                        i.WarrantyNotes
                    )
                );
            }

            if (
                i.WarrantyExpirationDate.HasValue
                && i.WarrantyExpirationDate.Value >= coverageMinDate
                && i.WarrantyExpirationDate.Value <= coverageMaxDate
            )
            {
                var isExpired = i.WarrantyExpirationDate.Value < utcNow;
                var daysRemaining = (int)
                    Math.Ceiling((i.WarrantyExpirationDate.Value - utcNow).TotalDays);

                coverageList.Add(
                    new ExpiringCoverageAlertDto(
                        i.Id,
                        i.ShortCode,
                        i.Name,
                        i.Brand,
                        i.ModelNumber,
                        i.Retailer,
                        i.PurchasePrice,
                        locationPath,
                        WarrantyOrReturnAlertType.WarrantyExpiration,
                        i.WarrantyExpirationDate.Value,
                        daysRemaining,
                        isExpired,
                        i.WarrantyNotes
                    )
                );
            }
        }

        coverageList = coverageList.OrderBy(c => c.ExpirationDate).ToList();

        // 5. Low Stock Items
        var lowStockList = accessibleItems
            .Where(i => i.MinQuantity.HasValue && i.CurrentQuantity <= i.MinQuantity.Value)
            .Select(i => new LowStockItemAlertDto(
                i.Id,
                i.ShortCode,
                i.Name,
                i.Category?.Name,
                ResolveLocationPath(i.HomeLocationId, locationMap),
                i.CurrentQuantity,
                i.MinQuantity!.Value,
                i.Unit
            ))
            .OrderBy(i => i.CurrentQuantity / Math.Max(1m, i.MinQuantity))
            .ThenBy(i => i.Name)
            .ToList();

        var outOfPlaceCount = outOfPlaceList.Count;
        var activeLoansCount = loansList.Count;
        var overdueLoansCount = loansList.Count(l => l.IsOverdue);
        var maintenanceDueCount = dueMaintenanceList.Count;
        var maintenanceOverdueCount = dueMaintenanceList.Count(s =>
            s.DueStatus == MaintenanceDueStatus.Overdue
        );
        var expiringCoverageCount = coverageList.Count;
        var lowStockCount = lowStockList.Count;
        var totalAlertsCount =
            outOfPlaceCount
            + activeLoansCount
            + maintenanceDueCount
            + expiringCoverageCount
            + lowStockCount;

        return new ActionCenterOverviewDto(
            totalAlertsCount,
            outOfPlaceCount,
            activeLoansCount,
            overdueLoansCount,
            maintenanceDueCount,
            maintenanceOverdueCount,
            expiringCoverageCount,
            lowStockCount,
            outOfPlaceList,
            loansList,
            dueMaintenanceList,
            coverageList,
            lowStockList
        );
    }

    public async Task<IReadOnlyList<NotificationChannelDto>> GetChannelsAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    )
    {
        var channels = await dbContext
            .NotificationChannels.AsNoTracking()
            .Where(c => c.OwnerId == userId || c.IsSharedHouseholdChannel)
            .OrderBy(c => c.Name)
            .ToListAsync(cancellationToken);

        return channels.Select(MapChannelToDto).ToList();
    }

    public async Task<NotificationChannelDto?> GetChannelByIdAsync(
        Guid userId,
        Guid channelId,
        CancellationToken cancellationToken = default
    )
    {
        var channel = await dbContext
            .NotificationChannels.AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == channelId, cancellationToken);

        if (channel is null)
        {
            return null;
        }

        if (channel.OwnerId != userId && !channel.IsSharedHouseholdChannel)
        {
            throw new ForbiddenException(
                "You do not have permission to view this notification channel."
            );
        }

        return MapChannelToDto(channel);
    }

    public async Task<NotificationChannelDto> CreateChannelAsync(
        Guid userId,
        CreateNotificationChannelRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        ValidateChannelConfiguration(
            request.Name,
            request.ChannelType,
            request.EndpointUrl,
            request.AccessTokenOrKey,
            request.RecipientOrUserKey,
            request.SmtpHost
        );

        var channel = new NotificationChannel
        {
            OwnerId = userId,
            Name = request.Name.Trim(),
            ChannelType = request.ChannelType,
            IsEnabled = request.IsEnabled,
            IsSharedHouseholdChannel = request.IsSharedHouseholdChannel,
            EndpointUrl = string.IsNullOrWhiteSpace(request.EndpointUrl)
                ? null
                : request.EndpointUrl.Trim(),
            AccessTokenOrKey = string.IsNullOrWhiteSpace(request.AccessTokenOrKey)
                ? null
                : request.AccessTokenOrKey.Trim(),
            RecipientOrUserKey = string.IsNullOrWhiteSpace(request.RecipientOrUserKey)
                ? null
                : request.RecipientOrUserKey.Trim(),
            SmtpHost = string.IsNullOrWhiteSpace(request.SmtpHost) ? null : request.SmtpHost.Trim(),
            SmtpPort = request.SmtpPort,
            SmtpUsername = string.IsNullOrWhiteSpace(request.SmtpUsername)
                ? null
                : request.SmtpUsername.Trim(),
            SmtpFromAddress = string.IsNullOrWhiteSpace(request.SmtpFromAddress)
                ? null
                : request.SmtpFromAddress.Trim(),
            SmtpUseSsl = request.SmtpUseSsl,
            NotifyOnOverdueLoans = request.NotifyOnOverdueLoans,
            NotifyOnMaintenanceDue = request.NotifyOnMaintenanceDue,
            NotifyOnExpiringWarranties = request.NotifyOnExpiringWarranties,
            NotifyOnLowStock = request.NotifyOnLowStock,
            EnableWeeklyDigest = request.EnableWeeklyDigest,
            DigestDayOfWeek = request.DigestDayOfWeek,
            DigestHourUtc = Math.Clamp(request.DigestHourUtc, 0, 23),
        };

        dbContext.NotificationChannels.Add(channel);
        await dbContext.SaveChangesAsync(cancellationToken);

        return MapChannelToDto(channel);
    }

    public async Task<NotificationChannelDto?> UpdateChannelAsync(
        Guid userId,
        Guid channelId,
        UpdateNotificationChannelRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var channel = await dbContext.NotificationChannels.FirstOrDefaultAsync(
            c => c.Id == channelId,
            cancellationToken
        );

        if (channel is null)
        {
            return null;
        }

        if (channel.OwnerId != userId)
        {
            throw new ForbiddenException(
                "You do not have permission to modify this notification channel."
            );
        }

        var effectiveTokenOrKey = request.ClearAccessTokenOrKey
            ? null
            : (
                !string.IsNullOrWhiteSpace(request.AccessTokenOrKey)
                    ? request.AccessTokenOrKey
                    : channel.AccessTokenOrKey
            );

        ValidateChannelConfiguration(
            request.Name,
            request.ChannelType,
            request.EndpointUrl,
            effectiveTokenOrKey,
            request.RecipientOrUserKey,
            request.SmtpHost
        );

        channel.Name = request.Name.Trim();
        channel.ChannelType = request.ChannelType;
        channel.IsEnabled = request.IsEnabled;
        channel.IsSharedHouseholdChannel = request.IsSharedHouseholdChannel;
        channel.EndpointUrl = string.IsNullOrWhiteSpace(request.EndpointUrl)
            ? null
            : request.EndpointUrl.Trim();
        channel.RecipientOrUserKey = string.IsNullOrWhiteSpace(request.RecipientOrUserKey)
            ? null
            : request.RecipientOrUserKey.Trim();
        channel.SmtpHost = string.IsNullOrWhiteSpace(request.SmtpHost)
            ? null
            : request.SmtpHost.Trim();
        channel.SmtpPort = request.SmtpPort;
        channel.SmtpUsername = string.IsNullOrWhiteSpace(request.SmtpUsername)
            ? null
            : request.SmtpUsername.Trim();
        channel.SmtpFromAddress = string.IsNullOrWhiteSpace(request.SmtpFromAddress)
            ? null
            : request.SmtpFromAddress.Trim();
        channel.SmtpUseSsl = request.SmtpUseSsl;
        channel.NotifyOnOverdueLoans = request.NotifyOnOverdueLoans;
        channel.NotifyOnMaintenanceDue = request.NotifyOnMaintenanceDue;
        channel.NotifyOnExpiringWarranties = request.NotifyOnExpiringWarranties;
        channel.NotifyOnLowStock = request.NotifyOnLowStock;
        channel.EnableWeeklyDigest = request.EnableWeeklyDigest;
        channel.DigestDayOfWeek = request.DigestDayOfWeek;
        channel.DigestHourUtc = Math.Clamp(request.DigestHourUtc, 0, 23);

        if (request.ClearAccessTokenOrKey)
        {
            channel.AccessTokenOrKey = null;
        }
        else if (!string.IsNullOrWhiteSpace(request.AccessTokenOrKey))
        {
            channel.AccessTokenOrKey = request.AccessTokenOrKey.Trim();
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return MapChannelToDto(channel);
    }

    public async Task<bool> DeleteChannelAsync(
        Guid userId,
        Guid channelId,
        CancellationToken cancellationToken = default
    )
    {
        var channel = await dbContext.NotificationChannels.FirstOrDefaultAsync(
            c => c.Id == channelId,
            cancellationToken
        );

        if (channel is null)
        {
            return false;
        }

        if (channel.OwnerId != userId)
        {
            throw new ForbiddenException(
                "You do not have permission to delete this notification channel."
            );
        }

        dbContext.NotificationChannels.Remove(channel);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<NotificationDeliveryLogDto?> SendTestNotificationAsync(
        Guid userId,
        Guid channelId,
        CancellationToken cancellationToken = default
    )
    {
        var channel = await dbContext.NotificationChannels.FirstOrDefaultAsync(
            c => c.Id == channelId,
            cancellationToken
        );

        if (channel is null)
        {
            return null;
        }

        if (channel.OwnerId != userId && !channel.IsSharedHouseholdChannel)
        {
            throw new ForbiddenException(
                "You do not have permission to trigger tests for this notification channel."
            );
        }

        var command = new NotificationDispatchCommand(
            channel.ChannelType,
            channel.Name,
            channel.EndpointUrl,
            channel.AccessTokenOrKey,
            channel.RecipientOrUserKey,
            channel.SmtpHost,
            channel.SmtpPort,
            channel.SmtpUsername,
            channel.SmtpFromAddress,
            channel.SmtpUseSsl,
            "WhereHouse — Test Notification",
            $"This is a test notification from your WhereHouse Action Center for channel '{channel.Name}'."
        );

        var outcome = await notificationDispatcher.DispatchAsync(command, cancellationToken);
        var now = DateTimeOffset.UtcNow;

        var log = new NotificationDeliveryLog
        {
            ChannelId = channel.Id,
            OwnerId = userId,
            ChannelName = channel.Name,
            ChannelType = channel.ChannelType,
            EventType = NotificationEventType.TestNotification,
            Subject = command.Subject,
            MessageBody = command.MessageBody,
            Success = outcome.Success,
            ResponseSummary = outcome.ResponseSummary,
            DeliveredAt = now,
        };

        channel.LastTriggeredAt = now;
        channel.LastDeliveryStatus = outcome.ResponseSummary;

        dbContext.NotificationDeliveryLogs.Add(log);
        await dbContext.SaveChangesAsync(cancellationToken);

        return new NotificationDeliveryLogDto(
            log.Id,
            log.ChannelId,
            log.ChannelName,
            log.ChannelType,
            log.EventType,
            log.Subject,
            log.MessageBody,
            log.Success,
            log.ResponseSummary,
            log.DeliveredAt
        );
    }

    public async Task<NotificationDispatchResultDto> SendDigestAsync(
        Guid userId,
        SendNotificationDigestRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        List<NotificationChannel> targets;

        if (request.ChannelId.HasValue)
        {
            var single = await dbContext.NotificationChannels.FirstOrDefaultAsync(
                c => c.Id == request.ChannelId.Value,
                cancellationToken
            );

            if (single is null)
            {
                throw new ArgumentException("Notification channel not found.", nameof(request));
            }

            if (single.OwnerId != userId && !single.IsSharedHouseholdChannel)
            {
                throw new ForbiddenException(
                    "You do not have permission to send a digest to this channel."
                );
            }

            targets = [single];
        }
        else
        {
            targets = await dbContext
                .NotificationChannels.Where(c =>
                    c.IsEnabled && (c.OwnerId == userId || c.IsSharedHouseholdChannel)
                )
                .ToListAsync(cancellationToken);
        }

        if (targets.Count == 0)
        {
            return new NotificationDispatchResultDto(
                0,
                0,
                0,
                "No Active Channels",
                "No enabled notification channels targeted.",
                []
            );
        }

        var now = DateTimeOffset.UtcNow;
        var subject = $"WhereHouse — Household Digest ({now:MMM d, yyyy})";
        var deliveries = new List<NotificationDeliveryLogDto>();
        var successCount = 0;
        var failureCount = 0;
        string previewBody = string.Empty;

        foreach (var channel in targets)
        {
            // Strict Privacy Rule: shared household channels must NOT leak private items!
            var overview = await GetOverviewInternalAsync(
                channel.IsSharedHouseholdChannel ? null : channel.OwnerId,
                request.CoverageWindowDays,
                cancellationToken
            );

            var body = FormatDigestBody(channel, overview, now);
            if (string.IsNullOrEmpty(previewBody))
            {
                previewBody = body;
            }

            var command = new NotificationDispatchCommand(
                channel.ChannelType,
                channel.Name,
                channel.EndpointUrl,
                channel.AccessTokenOrKey,
                channel.RecipientOrUserKey,
                channel.SmtpHost,
                channel.SmtpPort,
                channel.SmtpUsername,
                channel.SmtpFromAddress,
                channel.SmtpUseSsl,
                subject,
                body
            );

            var outcome = await notificationDispatcher.DispatchAsync(command, cancellationToken);
            if (outcome.Success)
            {
                successCount++;
            }
            else
            {
                failureCount++;
            }

            var log = new NotificationDeliveryLog
            {
                ChannelId = channel.Id,
                OwnerId = userId,
                ChannelName = channel.Name,
                ChannelType = channel.ChannelType,
                EventType = NotificationEventType.WeeklyDigest,
                Subject = subject,
                MessageBody = body,
                Success = outcome.Success,
                ResponseSummary = outcome.ResponseSummary,
                DeliveredAt = now,
            };

            channel.LastTriggeredAt = now;
            channel.LastDeliveryStatus = outcome.ResponseSummary;

            dbContext.NotificationDeliveryLogs.Add(log);
            deliveries.Add(
                new NotificationDeliveryLogDto(
                    log.Id,
                    log.ChannelId,
                    log.ChannelName,
                    log.ChannelType,
                    log.EventType,
                    log.Subject,
                    log.MessageBody,
                    log.Success,
                    log.ResponseSummary,
                    log.DeliveredAt
                )
            );
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return new NotificationDispatchResultDto(
            targets.Count,
            successCount,
            failureCount,
            subject,
            previewBody,
            deliveries
        );
    }

    public async Task<IReadOnlyList<NotificationDeliveryLogDto>> GetRecentDeliveriesAsync(
        Guid userId,
        int limit = 30,
        CancellationToken cancellationToken = default
    )
    {
        limit = Math.Clamp(limit, 1, 100);

        var accessibleChannelIds = await dbContext
            .NotificationChannels.AsNoTracking()
            .Where(c => c.OwnerId == userId || c.IsSharedHouseholdChannel)
            .Select(c => c.Id)
            .ToListAsync(cancellationToken);

        var logs = await dbContext
            .NotificationDeliveryLogs.AsNoTracking()
            .Where(l => accessibleChannelIds.Contains(l.ChannelId) || l.OwnerId == userId)
            .OrderByDescending(l => l.DeliveredAt)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return logs.Select(l => new NotificationDeliveryLogDto(
                l.Id,
                l.ChannelId,
                l.ChannelName,
                l.ChannelType,
                l.EventType,
                l.Subject,
                l.MessageBody,
                l.Success,
                l.ResponseSummary,
                l.DeliveredAt
            ))
            .ToList();
    }

    private async Task<ActionCenterOverviewDto> GetOverviewInternalAsync(
        Guid? userScopeId,
        int coverageWindowDays,
        CancellationToken cancellationToken
    )
    {
        coverageWindowDays = Math.Clamp(coverageWindowDays, 1, 365);
        var utcNow = DateTimeOffset.UtcNow;
        var coverageMinDate = utcNow.AddDays(-7);
        var coverageMaxDate = utcNow.AddDays(coverageWindowDays);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var locationMap = allLocations.ToDictionary(l => l.Id);
        var accessibleLocationIds = ComputeAccessibleLocationIds(allLocations, userScopeId);

        var allItems = await dbContext
            .InventoryItems.AsNoTracking()
            .Include(i => i.Category)
            .Where(i => i.Status != ItemStatus.Archived)
            .ToListAsync(cancellationToken);

        var accessibleItems = allItems
            .Where(i =>
            {
                if (userScopeId.HasValue)
                {
                    if (i.IsPrivate && i.OwnerId != userScopeId.Value)
                    {
                        return false;
                    }
                }
                else
                {
                    // Strict Household Sharing Scope: strip all private items
                    if (i.IsPrivate)
                    {
                        return false;
                    }
                }

                if (
                    i.HomeLocationId.HasValue
                    && !accessibleLocationIds.Contains(i.HomeLocationId.Value)
                )
                {
                    return false;
                }

                return true;
            })
            .ToList();

        var outOfPlaceList = accessibleItems
            .Where(i => i.Status == ItemStatus.InUse)
            .OrderBy(i => i.CheckedOutAt ?? i.ModifiedAt)
            .Select(i =>
            {
                var daysOut = i.CheckedOutAt.HasValue
                    ? Math.Max(0, (int)Math.Floor((utcNow - i.CheckedOutAt.Value).TotalDays))
                    : 0;

                return new OutOfPlaceItemAlertDto(
                    i.Id,
                    i.ShortCode,
                    i.Name,
                    i.HomeLocationId?.ToString(),
                    ResolveLocationPath(i.HomeLocationId, locationMap),
                    i.CheckedOutByUserId,
                    i.CheckedOutByUsername,
                    i.CheckoutNote,
                    i.ActiveLoadoutId,
                    i.ActiveLoadoutName,
                    i.CheckedOutAt,
                    daysOut
                );
            })
            .ToList();

        var loansList = accessibleItems
            .Where(i => i.Status == ItemStatus.LoanedOut)
            .Select(i =>
            {
                var isOverdue = i.CheckoutDueAt.HasValue && i.CheckoutDueAt.Value < utcNow;
                var daysUntilDue = i.CheckoutDueAt.HasValue
                    ? (int)Math.Ceiling((i.CheckoutDueAt.Value - utcNow).TotalDays)
                    : (int?)null;

                return new ExternalLoanAlertDto(
                    i.Id,
                    i.ShortCode,
                    i.Name,
                    ResolveLocationPath(i.HomeLocationId, locationMap),
                    i.CheckedOutToBorrower,
                    i.CheckedOutBorrowerContact,
                    i.CheckoutNote,
                    i.CheckedOutAt,
                    i.CheckoutDueAt,
                    isOverdue,
                    daysUntilDue
                );
            })
            .OrderByDescending(l => l.IsOverdue)
            .ThenBy(l => l.DueAt ?? DateTimeOffset.MaxValue)
            .ToList();

        var allSchedules = await dbContext
            .MaintenanceSchedules.AsNoTracking()
            .Include(s => s.Item)
            .Where(s => s.IsActive && s.Item.Status != ItemStatus.Archived)
            .ToListAsync(cancellationToken);

        var accessibleSchedules = allSchedules
            .Where(s =>
            {
                if (userScopeId.HasValue)
                {
                    if (s.Item.IsPrivate && s.Item.OwnerId != userScopeId.Value)
                    {
                        return false;
                    }
                }
                else
                {
                    if (s.Item.IsPrivate)
                    {
                        return false;
                    }
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

        var dueMaintenanceList = new List<MaintenanceScheduleDto>();
        foreach (var s in accessibleSchedules)
        {
            var dueStatus = CalculateDueStatus(s.NextDueAt, utcNow, s.IsActive);
            if (dueStatus is MaintenanceDueStatus.Overdue or MaintenanceDueStatus.DueSoon)
            {
                var daysUntil = (int)Math.Ceiling((s.NextDueAt - utcNow).TotalDays);
                dueMaintenanceList.Add(
                    new MaintenanceScheduleDto(
                        s.Id,
                        s.ItemId,
                        s.Item.ShortCode,
                        s.Item.Name,
                        ResolveLocationPath(s.Item.HomeLocationId, locationMap),
                        s.Title,
                        s.Description,
                        s.IntervalValue,
                        s.IntervalUnit,
                        s.LastCompletedAt,
                        s.NextDueAt,
                        s.IsActive,
                        dueStatus,
                        daysUntil,
                        s.CreatedAt,
                        s.ModifiedAt
                    )
                );
            }
        }

        dueMaintenanceList = dueMaintenanceList
            .OrderByDescending(s => s.DueStatus == MaintenanceDueStatus.Overdue)
            .ThenBy(s => s.NextDueAt)
            .ToList();

        var coverageList = new List<ExpiringCoverageAlertDto>();
        foreach (var i in accessibleItems)
        {
            var locationPath = ResolveLocationPath(i.HomeLocationId, locationMap);

            if (
                i.ReturnWindowEndDate.HasValue
                && i.ReturnWindowEndDate.Value >= coverageMinDate
                && i.ReturnWindowEndDate.Value <= coverageMaxDate
            )
            {
                var isExpired = i.ReturnWindowEndDate.Value < utcNow;
                var daysRemaining = (int)
                    Math.Ceiling((i.ReturnWindowEndDate.Value - utcNow).TotalDays);

                coverageList.Add(
                    new ExpiringCoverageAlertDto(
                        i.Id,
                        i.ShortCode,
                        i.Name,
                        i.Brand,
                        i.ModelNumber,
                        i.Retailer,
                        i.PurchasePrice,
                        locationPath,
                        WarrantyOrReturnAlertType.ReturnWindow,
                        i.ReturnWindowEndDate.Value,
                        daysRemaining,
                        isExpired,
                        i.WarrantyNotes
                    )
                );
            }

            if (
                i.WarrantyExpirationDate.HasValue
                && i.WarrantyExpirationDate.Value >= coverageMinDate
                && i.WarrantyExpirationDate.Value <= coverageMaxDate
            )
            {
                var isExpired = i.WarrantyExpirationDate.Value < utcNow;
                var daysRemaining = (int)
                    Math.Ceiling((i.WarrantyExpirationDate.Value - utcNow).TotalDays);

                coverageList.Add(
                    new ExpiringCoverageAlertDto(
                        i.Id,
                        i.ShortCode,
                        i.Name,
                        i.Brand,
                        i.ModelNumber,
                        i.Retailer,
                        i.PurchasePrice,
                        locationPath,
                        WarrantyOrReturnAlertType.WarrantyExpiration,
                        i.WarrantyExpirationDate.Value,
                        daysRemaining,
                        isExpired,
                        i.WarrantyNotes
                    )
                );
            }
        }

        coverageList = coverageList.OrderBy(c => c.ExpirationDate).ToList();

        var lowStockList = accessibleItems
            .Where(i => i.MinQuantity.HasValue && i.CurrentQuantity <= i.MinQuantity.Value)
            .Select(i => new LowStockItemAlertDto(
                i.Id,
                i.ShortCode,
                i.Name,
                i.Category?.Name,
                ResolveLocationPath(i.HomeLocationId, locationMap),
                i.CurrentQuantity,
                i.MinQuantity!.Value,
                i.Unit
            ))
            .OrderBy(i => i.CurrentQuantity / Math.Max(1m, i.MinQuantity))
            .ThenBy(i => i.Name)
            .ToList();

        var outOfPlaceCount = outOfPlaceList.Count;
        var activeLoansCount = loansList.Count;
        var overdueLoansCount = loansList.Count(l => l.IsOverdue);
        var maintenanceDueCount = dueMaintenanceList.Count;
        var maintenanceOverdueCount = dueMaintenanceList.Count(s =>
            s.DueStatus == MaintenanceDueStatus.Overdue
        );
        var expiringCoverageCount = coverageList.Count;
        var lowStockCount = lowStockList.Count;
        var totalAlertsCount =
            outOfPlaceCount
            + activeLoansCount
            + maintenanceDueCount
            + expiringCoverageCount
            + lowStockCount;

        return new ActionCenterOverviewDto(
            totalAlertsCount,
            outOfPlaceCount,
            activeLoansCount,
            overdueLoansCount,
            maintenanceDueCount,
            maintenanceOverdueCount,
            expiringCoverageCount,
            lowStockCount,
            outOfPlaceList,
            loansList,
            dueMaintenanceList,
            coverageList,
            lowStockList
        );
    }

    private static string FormatDigestBody(
        NotificationChannel channel,
        ActionCenterOverviewDto overview,
        DateTimeOffset timestamp
    )
    {
        var sb = new StringBuilder();
        sb.AppendLine($"# WhereHouse Action Center Digest");
        sb.AppendLine($"Generated: {timestamp:yyyy-MM-dd HH:mm} UTC");
        sb.AppendLine();

        sb.AppendLine($"Summary: {overview.TotalAlertsCount} Total Alerts across your household.");
        sb.AppendLine();

        if (channel.NotifyOnOverdueLoans && overview.ActiveLoansCount > 0)
        {
            sb.AppendLine(
                $"## External Loans ({overview.ActiveLoansCount} Active, {overview.OverdueLoansCount} Overdue)"
            );
            foreach (var loan in overview.ExternalLoans.Take(5))
            {
                var dueStr = loan.DueAt.HasValue
                    ? $"Due: {loan.DueAt.Value:yyyy-MM-dd}"
                    : "No due date";
                var statusStr = loan.IsOverdue ? "**[OVERDUE]** " : string.Empty;
                sb.AppendLine(
                    $"- {statusStr}{loan.ShortCode} {loan.Name} -> {loan.BorrowerName ?? "Borrower"} ({dueStr})"
                );
            }
            if (overview.ExternalLoans.Count > 5)
            {
                sb.AppendLine($"  *(and {overview.ExternalLoans.Count - 5} more loans...)*");
            }
            sb.AppendLine();
        }

        if (channel.NotifyOnMaintenanceDue && overview.MaintenanceDueCount > 0)
        {
            sb.AppendLine(
                $"## Maintenance Due ({overview.MaintenanceDueCount} Tasks, {overview.MaintenanceOverdueCount} Overdue)"
            );
            foreach (var task in overview.DueMaintenanceSchedules.Take(5))
            {
                var statusStr =
                    task.DueStatus == MaintenanceDueStatus.Overdue
                        ? "**[OVERDUE]** "
                        : string.Empty;
                sb.AppendLine(
                    $"- {statusStr}{task.Title} on {task.ItemShortCode} {task.ItemName} (Due: {task.NextDueAt:yyyy-MM-dd})"
                );
            }
            if (overview.DueMaintenanceSchedules.Count > 5)
            {
                sb.AppendLine(
                    $"  *(and {overview.DueMaintenanceSchedules.Count - 5} more maintenance tasks...)*"
                );
            }
            sb.AppendLine();
        }

        if (channel.NotifyOnExpiringWarranties && overview.ExpiringCoverageCount > 0)
        {
            sb.AppendLine($"## Expiring Coverages ({overview.ExpiringCoverageCount} Items)");
            foreach (var cov in overview.ExpiringCoverages.Take(5))
            {
                var typeStr =
                    cov.AlertType == WarrantyOrReturnAlertType.ReturnWindow
                        ? "Return Window"
                        : "Warranty";
                var expiredStr = cov.IsExpired ? "**[EXPIRED]** " : string.Empty;
                sb.AppendLine(
                    $"- {expiredStr}{cov.ShortCode} {cov.Name} ({typeStr} expires {cov.ExpirationDate:yyyy-MM-dd})"
                );
            }
            if (overview.ExpiringCoverages.Count > 5)
            {
                sb.AppendLine(
                    $"  *(and {overview.ExpiringCoverages.Count - 5} more coverage items...)*"
                );
            }
            sb.AppendLine();
        }

        if (channel.NotifyOnLowStock && overview.LowStockCount > 0)
        {
            sb.AppendLine($"## Low Stock Alerts ({overview.LowStockCount} Items)");
            foreach (var item in overview.LowStockItems.Take(5))
            {
                sb.AppendLine(
                    $"- {item.ShortCode} {item.Name}: {item.CurrentQuantity} / {item.MinQuantity} {item.Unit ?? "units"}"
                );
            }
            if (overview.LowStockItems.Count > 5)
            {
                sb.AppendLine(
                    $"  *(and {overview.LowStockItems.Count - 5} more low stock items...)*"
                );
            }
            sb.AppendLine();
        }

        if (overview.OutOfPlaceCount > 0)
        {
            sb.AppendLine($"## Out of Place ({overview.OutOfPlaceCount} Items In Use)");
            foreach (var item in overview.OutOfPlaceItems.Take(5))
            {
                var userStr = !string.IsNullOrWhiteSpace(item.CheckedOutByUsername)
                    ? $"by {item.CheckedOutByUsername}"
                    : string.Empty;
                sb.AppendLine(
                    $"- {item.ShortCode} {item.Name} {userStr} ({item.DaysOut} days out)"
                );
            }
            if (overview.OutOfPlaceItems.Count > 5)
            {
                sb.AppendLine(
                    $"  *(and {overview.OutOfPlaceItems.Count - 5} more out of place items...)*"
                );
            }
            sb.AppendLine();
        }

        return sb.ToString().TrimEnd();
    }

    private static void ValidateChannelConfiguration(
        string name,
        NotificationChannelType type,
        string? endpointUrl,
        string? accessTokenOrKey,
        string? recipientOrUserKey,
        string? smtpHost
    )
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Channel name cannot be empty.", nameof(name));
        }

        switch (type)
        {
            case NotificationChannelType.Ntfy:
            case NotificationChannelType.SlackWebhook:
                if (string.IsNullOrWhiteSpace(endpointUrl))
                {
                    throw new ArgumentException(
                        $"{type} requires a valid endpoint URL.",
                        nameof(endpointUrl)
                    );
                }
                break;

            case NotificationChannelType.Pushover:
                if (
                    string.IsNullOrWhiteSpace(accessTokenOrKey)
                    || string.IsNullOrWhiteSpace(recipientOrUserKey)
                )
                {
                    throw new ArgumentException(
                        "Pushover requires both an API token and a user/group key."
                    );
                }
                break;

            case NotificationChannelType.SmtpEmail:
                if (
                    string.IsNullOrWhiteSpace(smtpHost)
                    || string.IsNullOrWhiteSpace(recipientOrUserKey)
                )
                {
                    throw new ArgumentException(
                        "SMTP Email requires both an SMTP host and a recipient email address."
                    );
                }
                break;
        }
    }

    private static NotificationChannelDto MapChannelToDto(NotificationChannel c)
    {
        return new NotificationChannelDto(
            c.Id,
            c.OwnerId,
            c.Name,
            c.ChannelType,
            c.IsEnabled,
            c.IsSharedHouseholdChannel,
            c.EndpointUrl,
            !string.IsNullOrWhiteSpace(c.AccessTokenOrKey),
            c.RecipientOrUserKey,
            c.SmtpHost,
            c.SmtpPort,
            c.SmtpUsername,
            c.SmtpFromAddress,
            c.SmtpUseSsl,
            c.NotifyOnOverdueLoans,
            c.NotifyOnMaintenanceDue,
            c.NotifyOnExpiringWarranties,
            c.NotifyOnLowStock,
            c.EnableWeeklyDigest,
            c.DigestDayOfWeek,
            c.DigestHourUtc,
            c.LastTriggeredAt,
            c.LastDeliveryStatus,
            c.CreatedAt,
            c.ModifiedAt
        );
    }

    private static MaintenanceDueStatus CalculateDueStatus(
        DateTimeOffset nextDueAt,
        DateTimeOffset utcNow,
        bool isActive
    )
    {
        if (!isActive)
        {
            return MaintenanceDueStatus.Paused;
        }

        if (nextDueAt < utcNow)
        {
            return MaintenanceDueStatus.Overdue;
        }

        if (nextDueAt <= utcNow.AddDays(14))
        {
            return MaintenanceDueStatus.DueSoon;
        }

        return MaintenanceDueStatus.UpToDate;
    }

    private static string? ResolveLocationPath(
        Guid? locationId,
        Dictionary<Guid, LocationNode> locationMap
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

    private static HashSet<Guid> ComputeAccessibleLocationIds(
        IReadOnlyList<LocationNode> allLocations,
        Guid? userId
    )
    {
        var locationMap = allLocations.ToDictionary(l => l.Id);
        var accessibleIds = new HashSet<Guid>();

        foreach (var loc in allLocations)
        {
            if (IsLocationAccessible(loc, locationMap, userId))
            {
                accessibleIds.Add(loc.Id);
            }
        }

        return accessibleIds;
    }

    private static bool IsLocationAccessible(
        LocationNode node,
        Dictionary<Guid, LocationNode> locationMap,
        Guid? userId
    )
    {
        var current = node;
        while (current != null)
        {
            if (current.IsPrivate)
            {
                if (!userId.HasValue || current.OwnerId != userId.Value)
                {
                    return false;
                }
            }

            if (!current.ParentId.HasValue)
            {
                break;
            }

            if (!locationMap.TryGetValue(current.ParentId.Value, out var parent))
            {
                break;
            }

            current = parent;
        }

        return true;
    }
}
