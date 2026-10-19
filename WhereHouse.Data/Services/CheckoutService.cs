using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Checkouts;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Items;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class CheckoutService(WhereHouseDbContext dbContext, IItemService itemService)
    : ICheckoutService
{
    public async Task<ItemDto?> CheckoutItemAsync(
        Guid userId,
        Guid itemId,
        CheckoutItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.IsExternalLoan && string.IsNullOrWhiteSpace(request.BorrowerName))
        {
            throw new ArgumentException("Borrower name is required for external loans.");
        }

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var item = await dbContext
            .InventoryItems.Include(i => i.ChildItems)
            .FirstOrDefaultAsync(i => i.Id == itemId, cancellationToken);

        if (item is null)
        {
            return null;
        }

        if (!IsItemAccessible(item, userId, allLocations))
        {
            throw new ForbiddenException();
        }

        var user = await dbContext
            .Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        var username = user?.Username ?? "User";

        var now = DateTimeOffset.UtcNow;
        var targetStatus = request.IsExternalLoan ? ItemStatus.LoanedOut : ItemStatus.InUse;
        var actionType = request.IsExternalLoan
            ? CheckoutActionType.LoanOutExternal
            : CheckoutActionType.CheckOutInUse;
        var borrowerName = request.IsExternalLoan ? request.BorrowerName?.Trim() : null;
        var borrowerContact = request.IsExternalLoan ? request.BorrowerContact?.Trim() : null;
        var note = request.ProjectOrNote?.Trim();

        item.Status = targetStatus;
        item.CheckedOutByUserId = userId;
        item.CheckedOutByUsername = username;
        item.CheckedOutToBorrower = borrowerName;
        item.CheckedOutBorrowerContact = borrowerContact;
        item.CheckoutNote = note;
        item.CheckedOutAt = now;
        item.CheckoutDueAt = request.ExpectedReturnAt;
        item.LastTouchedAt = now;

        var qtyAffected =
            request.Quantity ?? (item.ItemType == ItemType.Quantity ? item.CurrentQuantity : 1m);

        var log = new CheckoutLog
        {
            Id = Guid.NewGuid(),
            ItemId = item.Id,
            ActionType = actionType,
            PerformedByUserId = userId,
            PerformedByUsername = username,
            BorrowerName = borrowerName,
            BorrowerContact = borrowerContact,
            ProjectOrNote = note,
            QuantityAffected = qtyAffected,
            OccurredAt = now,
            ExpectedReturnAt = request.ExpectedReturnAt,
            CreatedBy = username,
            ModifiedBy = username,
        };
        dbContext.CheckoutLogs.Add(log);

        if (item.ItemType == ItemType.Kit && item.ChildItems.Count > 0)
        {
            foreach (var child in item.ChildItems)
            {
                if (
                    child.Status == ItemStatus.InPlace
                    && IsItemAccessible(child, userId, allLocations)
                )
                {
                    child.Status = targetStatus;
                    child.CheckedOutByUserId = userId;
                    child.CheckedOutByUsername = username;
                    child.CheckedOutToBorrower = borrowerName;
                    child.CheckedOutBorrowerContact = borrowerContact;
                    child.CheckoutNote = note ?? $"Kit: {item.Name}";
                    child.CheckedOutAt = now;
                    child.CheckoutDueAt = request.ExpectedReturnAt;
                    child.LastTouchedAt = now;

                    dbContext.CheckoutLogs.Add(
                        new CheckoutLog
                        {
                            Id = Guid.NewGuid(),
                            ItemId = child.Id,
                            ActionType = actionType,
                            PerformedByUserId = userId,
                            PerformedByUsername = username,
                            BorrowerName = borrowerName,
                            BorrowerContact = borrowerContact,
                            ProjectOrNote = note ?? $"Kit: {item.Name}",
                            QuantityAffected =
                                child.ItemType == ItemType.Quantity ? child.CurrentQuantity : 1m,
                            OccurredAt = now,
                            ExpectedReturnAt = request.ExpectedReturnAt,
                            CreatedBy = username,
                            ModifiedBy = username,
                        }
                    );
                }
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return await itemService.GetItemByIdAsync(userId, itemId, cancellationToken);
    }

    public async Task<ItemDto?> ReturnItemAsync(
        Guid userId,
        Guid itemId,
        ReturnItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var item = await dbContext
            .InventoryItems.Include(i => i.ChildItems)
            .FirstOrDefaultAsync(i => i.Id == itemId, cancellationToken);

        if (item is null)
        {
            return null;
        }

        if (!IsItemAccessible(item, userId, allLocations))
        {
            throw new ForbiddenException();
        }

        var user = await dbContext
            .Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        var username = user?.Username ?? "User";

        var now = DateTimeOffset.UtcNow;

        if (
            request.QuantityUsed.HasValue
            && request.QuantityUsed.Value > 0
            && item.ItemType == ItemType.Quantity
        )
        {
            item.CurrentQuantity = Math.Max(0, item.CurrentQuantity - request.QuantityUsed.Value);
        }

        if (request.UpdatedCondition.HasValue)
        {
            item.Condition = request.UpdatedCondition.Value;
        }

        item.Status = ItemStatus.InPlace;
        item.CheckedOutByUserId = null;
        item.CheckedOutByUsername = null;
        item.CheckedOutToBorrower = null;
        item.CheckedOutBorrowerContact = null;
        item.CheckoutNote = null;
        item.CheckedOutAt = null;
        item.CheckoutDueAt = null;
        item.ActiveLoadoutId = null;
        item.ActiveLoadoutName = null;
        item.LastTouchedAt = now;

        var activeLogs = await dbContext
            .CheckoutLogs.Where(l =>
                l.ItemId == item.Id
                && l.ReturnedAt == null
                && l.ActionType != CheckoutActionType.ReturnToHome
            )
            .ToListAsync(cancellationToken);
        foreach (var activeLog in activeLogs)
        {
            activeLog.ReturnedAt = now;
            activeLog.ModifiedBy = username;
        }

        var returnLog = new CheckoutLog
        {
            Id = Guid.NewGuid(),
            ItemId = item.Id,
            ActionType = CheckoutActionType.ReturnToHome,
            PerformedByUserId = userId,
            PerformedByUsername = username,
            ProjectOrNote = request.ReturnNote?.Trim(),
            QuantityAffected = item.ItemType == ItemType.Quantity ? item.CurrentQuantity : 1m,
            QuantityConsumed = request.QuantityUsed,
            OccurredAt = now,
            ReturnedAt = now,
            CreatedBy = username,
            ModifiedBy = username,
        };
        dbContext.CheckoutLogs.Add(returnLog);

        if (item.ItemType == ItemType.Kit && item.ChildItems.Count > 0)
        {
            foreach (var child in item.ChildItems)
            {
                if (
                    (child.Status == ItemStatus.InUse || child.Status == ItemStatus.LoanedOut)
                    && IsItemAccessible(child, userId, allLocations)
                )
                {
                    child.Status = ItemStatus.InPlace;
                    child.CheckedOutByUserId = null;
                    child.CheckedOutByUsername = null;
                    child.CheckedOutToBorrower = null;
                    child.CheckedOutBorrowerContact = null;
                    child.CheckoutNote = null;
                    child.CheckedOutAt = null;
                    child.CheckoutDueAt = null;
                    child.ActiveLoadoutId = null;
                    child.ActiveLoadoutName = null;
                    child.LastTouchedAt = now;

                    var childActiveLogs = await dbContext
                        .CheckoutLogs.Where(l =>
                            l.ItemId == child.Id
                            && l.ReturnedAt == null
                            && l.ActionType != CheckoutActionType.ReturnToHome
                        )
                        .ToListAsync(cancellationToken);
                    foreach (var cl in childActiveLogs)
                    {
                        cl.ReturnedAt = now;
                        cl.ModifiedBy = username;
                    }

                    dbContext.CheckoutLogs.Add(
                        new CheckoutLog
                        {
                            Id = Guid.NewGuid(),
                            ItemId = child.Id,
                            ActionType = CheckoutActionType.ReturnToHome,
                            PerformedByUserId = userId,
                            PerformedByUsername = username,
                            ProjectOrNote =
                                request.ReturnNote?.Trim() ?? $"Returned with Kit: {item.Name}",
                            QuantityAffected =
                                child.ItemType == ItemType.Quantity ? child.CurrentQuantity : 1m,
                            OccurredAt = now,
                            ReturnedAt = now,
                            CreatedBy = username,
                            ModifiedBy = username,
                        }
                    );
                }
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return await itemService.GetItemByIdAsync(userId, itemId, cancellationToken);
    }

    public async Task<BatchCheckoutResultDto> BatchCheckoutItemsAsync(
        Guid userId,
        BatchCheckoutRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var processedItems = new List<ItemDto>();
        foreach (var itemId in request.ItemIds.Distinct())
        {
            var singleRequest = new CheckoutItemRequest(
                IsExternalLoan: request.IsExternalLoan,
                BorrowerName: request.BorrowerName,
                BorrowerContact: request.BorrowerContact,
                ProjectOrNote: request.ProjectOrNote,
                ExpectedReturnAt: request.ExpectedReturnAt
            );

            var res = await CheckoutItemAsync(userId, itemId, singleRequest, cancellationToken);
            if (res is not null)
            {
                processedItems.Add(res);
            }
        }

        return new BatchCheckoutResultDto(processedItems.Count, processedItems);
    }

    public async Task<BatchCheckoutResultDto> BatchReturnItemsAsync(
        Guid userId,
        BatchReturnRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var processedItems = new List<ItemDto>();
        foreach (var entry in request.Items)
        {
            var singleRequest = new ReturnItemRequest(
                ReturnNote: request.ReturnNote,
                QuantityUsed: entry.QuantityUsed
            );

            var res = await ReturnItemAsync(userId, entry.ItemId, singleRequest, cancellationToken);
            if (res is not null)
            {
                processedItems.Add(res);
            }
        }

        return new BatchCheckoutResultDto(processedItems.Count, processedItems);
    }

    public async Task<IReadOnlyList<ItemDto>> GetActiveCheckoutsAsync(
        Guid userId,
        bool? externalLoansOnly = null,
        bool? overdueOnly = null,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var query = dbContext
            .InventoryItems.AsNoTracking()
            .Where(i => i.Status == ItemStatus.InUse || i.Status == ItemStatus.LoanedOut);

        if (externalLoansOnly == true)
        {
            query = query.Where(i => i.Status == ItemStatus.LoanedOut);
        }

        var items = await query.ToListAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var filtered = items.Where(i => IsItemAccessible(i, userId, allLocations));

        if (overdueOnly == true)
        {
            filtered = filtered.Where(i =>
                i.Status == ItemStatus.LoanedOut
                && i.CheckoutDueAt.HasValue
                && i.CheckoutDueAt.Value < now
            );
        }

        var result = new List<ItemDto>();
        foreach (var itm in filtered)
        {
            var dto = await itemService.GetItemByIdAsync(userId, itm.Id, cancellationToken);
            if (dto is not null)
            {
                result.Add(dto);
            }
        }

        return result
            .OrderBy(i => i.CheckoutDueAt ?? i.CheckedOutAt ?? DateTimeOffset.MaxValue)
            .ToList();
    }

    public async Task<IReadOnlyList<CheckoutLogDto>> GetItemCheckoutHistoryAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var item = await dbContext
            .InventoryItems.AsNoTracking()
            .FirstOrDefaultAsync(i => i.Id == itemId, cancellationToken);

        if (item is null)
        {
            throw new NotFoundException("Item not found.");
        }

        if (!IsItemAccessible(item, userId, allLocations))
        {
            throw new ForbiddenException();
        }

        var logs = await dbContext
            .CheckoutLogs.AsNoTracking()
            .Where(l => l.ItemId == itemId)
            .OrderByDescending(l => l.OccurredAt)
            .ToListAsync(cancellationToken);

        return logs.Select(l => new CheckoutLogDto(
                l.Id,
                l.ItemId,
                item.ShortCode,
                item.Name,
                l.ActionType,
                l.PerformedByUserId,
                l.PerformedByUsername,
                l.BorrowerName,
                l.BorrowerContact,
                l.ProjectOrNote,
                l.LoadoutId,
                l.LoadoutName,
                l.QuantityAffected,
                l.QuantityConsumed,
                l.OccurredAt,
                l.ExpectedReturnAt,
                l.ReturnedAt
            ))
            .ToList();
    }

    private static bool IsItemAccessible(
        InventoryItem item,
        Guid userId,
        IReadOnlyDictionary<Guid, LocationNode> allLocations
    )
    {
        if (item.IsPrivate && item.OwnerId != userId)
        {
            return false;
        }

        if (item.HomeLocationId.HasValue)
        {
            if (allLocations.TryGetValue(item.HomeLocationId.Value, out var loc))
            {
                if (!IsLocationAccessible(loc, userId, allLocations))
                {
                    return false;
                }
            }
        }

        return true;
    }

    private static bool IsLocationAccessible(
        LocationNode node,
        Guid userId,
        IReadOnlyDictionary<Guid, LocationNode> allLocations
    )
    {
        var current = node;
        while (current is not null)
        {
            if (current.IsPrivate && current.OwnerId != userId)
            {
                return false;
            }

            if (!current.ParentId.HasValue)
            {
                break;
            }

            allLocations.TryGetValue(current.ParentId.Value, out current!);
        }

        return true;
    }
}
