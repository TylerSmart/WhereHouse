using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Checkouts;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Items;
using WhereHouse.Core.Loadouts;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class LoadoutService(WhereHouseDbContext dbContext) : ILoadoutService
{
    public async Task<IReadOnlyList<LoadoutDto>> GetLoadoutsAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var loadouts = await dbContext
            .Loadouts.AsNoTracking()
            .Include(l => l.Items)
                .ThenInclude(li => li.Item)
                    .ThenInclude(i => i.HomeLocation)
            .Where(l => !l.IsPrivate || l.OwnerId == userId)
            .OrderBy(l => l.Name)
            .ToListAsync(cancellationToken);

        return loadouts.Select(l => MapLoadoutToDto(l, userId, allLocations)).ToList();
    }

    public async Task<LoadoutDto?> GetLoadoutByIdAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var loadout = await dbContext
            .Loadouts.AsNoTracking()
            .Include(l => l.Items)
                .ThenInclude(li => li.Item)
                    .ThenInclude(i => i.HomeLocation)
            .FirstOrDefaultAsync(l => l.Id == id, cancellationToken);

        if (loadout is null)
        {
            return null;
        }

        if (loadout.IsPrivate && loadout.OwnerId != userId)
        {
            throw new ForbiddenException();
        }

        return MapLoadoutToDto(loadout, userId, allLocations);
    }

    public async Task<LoadoutDto> CreateLoadoutAsync(
        Guid userId,
        CreateLoadoutRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var user = await dbContext
            .Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        var username = user?.Username ?? "User";

        if (request.Items is { Count: > 0 })
        {
            var requestedItemIds = request.Items.Select(i => i.ItemId).Distinct().ToList();
            var items = await dbContext
                .InventoryItems.Where(i => requestedItemIds.Contains(i.Id))
                .ToListAsync(cancellationToken);

            if (items.Count != requestedItemIds.Count)
            {
                throw new NotFoundException("One or more items in the loadout were not found.");
            }

            foreach (var itm in items)
            {
                if (!IsItemAccessible(itm, userId, allLocations))
                {
                    throw new ForbiddenException();
                }
            }
        }

        var now = DateTimeOffset.UtcNow;
        var loadout = new Loadout
        {
            Id = Guid.NewGuid(),
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description)
                ? null
                : request.Description.Trim(),
            Icon = string.IsNullOrWhiteSpace(request.Icon) ? "backpack" : request.Icon.Trim(),
            IsPrivate = request.IsPrivate,
            OwnerId = userId,
            Status = LoadoutStatus.Ready,
            CreatedAt = now,
            ModifiedAt = now,
            CreatedBy = username,
            ModifiedBy = username,
        };

        if (request.Items != null)
        {
            var order = 0;
            foreach (var reqItem in request.Items)
            {
                loadout.Items.Add(
                    new LoadoutItem
                    {
                        Id = Guid.NewGuid(),
                        LoadoutId = loadout.Id,
                        ItemId = reqItem.ItemId,
                        RequiredQuantity = reqItem.RequiredQuantity,
                        IsConsumable = reqItem.IsConsumable,
                        SortOrder = reqItem.SortOrder != 0 ? reqItem.SortOrder : order++,
                        CreatedAt = now,
                        ModifiedAt = now,
                        CreatedBy = username,
                        ModifiedBy = username,
                    }
                );
            }
        }

        dbContext.Loadouts.Add(loadout);
        await dbContext.SaveChangesAsync(cancellationToken);

        return (await GetLoadoutByIdAsync(userId, loadout.Id, cancellationToken))!;
    }

    public async Task<LoadoutDto?> UpdateLoadoutAsync(
        Guid userId,
        Guid id,
        UpdateLoadoutRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var loadout = await dbContext
            .Loadouts.Include(l => l.Items)
            .FirstOrDefaultAsync(l => l.Id == id, cancellationToken);

        if (loadout is null)
        {
            return null;
        }

        if (loadout.IsPrivate && loadout.OwnerId != userId)
        {
            throw new ForbiddenException();
        }

        var user = await dbContext
            .Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        var username = user?.Username ?? "User";

        if (request.Items is { Count: > 0 })
        {
            var requestedItemIds = request.Items.Select(i => i.ItemId).Distinct().ToList();
            var items = await dbContext
                .InventoryItems.Where(i => requestedItemIds.Contains(i.Id))
                .ToListAsync(cancellationToken);

            if (items.Count != requestedItemIds.Count)
            {
                throw new NotFoundException("One or more items in the loadout were not found.");
            }

            foreach (var itm in items)
            {
                if (!IsItemAccessible(itm, userId, allLocations))
                {
                    throw new ForbiddenException();
                }
            }
        }

        var now = DateTimeOffset.UtcNow;
        loadout.Name = request.Name.Trim();
        loadout.Description = string.IsNullOrWhiteSpace(request.Description)
            ? null
            : request.Description.Trim();
        loadout.Icon = string.IsNullOrWhiteSpace(request.Icon) ? "backpack" : request.Icon.Trim();
        loadout.IsPrivate = request.IsPrivate;
        loadout.ModifiedAt = now;
        loadout.ModifiedBy = username;

        if (request.Items != null)
        {
            dbContext.LoadoutItems.RemoveRange(loadout.Items);
            var order = 0;
            foreach (var reqItem in request.Items)
            {
                loadout.Items.Add(
                    new LoadoutItem
                    {
                        Id = Guid.NewGuid(),
                        LoadoutId = loadout.Id,
                        ItemId = reqItem.ItemId,
                        RequiredQuantity = reqItem.RequiredQuantity,
                        IsConsumable = reqItem.IsConsumable,
                        SortOrder = reqItem.SortOrder != 0 ? reqItem.SortOrder : order++,
                        CreatedAt = now,
                        ModifiedAt = now,
                        CreatedBy = username,
                        ModifiedBy = username,
                    }
                );
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        return await GetLoadoutByIdAsync(userId, id, cancellationToken);
    }

    public async Task<bool> DeleteLoadoutAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        var loadout = await dbContext.Loadouts.FirstOrDefaultAsync(
            l => l.Id == id,
            cancellationToken
        );

        if (loadout is null)
        {
            return false;
        }

        if (loadout.IsPrivate && loadout.OwnerId != userId)
        {
            throw new ForbiddenException();
        }

        dbContext.Loadouts.Remove(loadout);
        await dbContext.SaveChangesAsync(cancellationToken);
        return true;
    }

    public async Task<LoadoutDto?> CheckoutLoadoutAsync(
        Guid userId,
        Guid id,
        CheckoutLoadoutRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var loadout = await dbContext
            .Loadouts.Include(l => l.Items)
                .ThenInclude(li => li.Item)
                    .ThenInclude(i => i.ChildItems)
            .FirstOrDefaultAsync(l => l.Id == id, cancellationToken);

        if (loadout is null)
        {
            return null;
        }

        if (loadout.IsPrivate && loadout.OwnerId != userId)
        {
            throw new ForbiddenException();
        }

        var user = await dbContext
            .Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        var username = user?.Username ?? "User";

        var now = DateTimeOffset.UtcNow;
        var note = string.IsNullOrWhiteSpace(request.CheckoutNote)
            ? $"Loadout: {loadout.Name}"
            : $"{loadout.Name} — {request.CheckoutNote.Trim()}";

        foreach (var li in loadout.Items)
        {
            var itm = li.Item;
            if (
                itm is not null
                && IsItemAccessible(itm, userId, allLocations)
                && itm.Condition != ItemCondition.Broken
                && itm.Status != ItemStatus.Archived
            )
            {
                li.IsCurrentlyCheckedOut = true;
                li.QuantityCheckedOut = li.RequiredQuantity;
                li.QuantityUsed = 0;
                li.QuantityReturned = 0;
                li.CheckedOutAt = now;
                li.ReturnedAt = null;

                itm.Status = ItemStatus.InUse;
                itm.CheckedOutByUserId = userId;
                itm.CheckedOutByUsername = username;
                itm.CheckoutNote = note;
                itm.CheckedOutAt = now;
                itm.ActiveLoadoutId = loadout.Id;
                itm.ActiveLoadoutName = loadout.Name;
                itm.LastTouchedAt = now;

                dbContext.CheckoutLogs.Add(
                    new CheckoutLog
                    {
                        Id = Guid.NewGuid(),
                        ItemId = itm.Id,
                        ActionType = CheckoutActionType.CheckOutInUse,
                        PerformedByUserId = userId,
                        PerformedByUsername = username,
                        ProjectOrNote = note,
                        LoadoutId = loadout.Id,
                        LoadoutName = loadout.Name,
                        QuantityAffected = li.RequiredQuantity,
                        OccurredAt = now,
                        CreatedBy = username,
                        ModifiedBy = username,
                    }
                );

                if (itm.ItemType == ItemType.Kit && itm.ChildItems.Count > 0)
                {
                    foreach (var child in itm.ChildItems)
                    {
                        if (
                            child.Status == ItemStatus.InPlace
                            && IsItemAccessible(child, userId, allLocations)
                        )
                        {
                            child.Status = ItemStatus.InUse;
                            child.CheckedOutByUserId = userId;
                            child.CheckedOutByUsername = username;
                            child.CheckoutNote = $"Loadout: {loadout.Name} (Kit: {itm.Name})";
                            child.CheckedOutAt = now;
                            child.ActiveLoadoutId = loadout.Id;
                            child.ActiveLoadoutName = loadout.Name;
                            child.LastTouchedAt = now;

                            dbContext.CheckoutLogs.Add(
                                new CheckoutLog
                                {
                                    Id = Guid.NewGuid(),
                                    ItemId = child.Id,
                                    ActionType = CheckoutActionType.CheckOutInUse,
                                    PerformedByUserId = userId,
                                    PerformedByUsername = username,
                                    ProjectOrNote = $"Loadout: {loadout.Name} (Kit: {itm.Name})",
                                    LoadoutId = loadout.Id,
                                    LoadoutName = loadout.Name,
                                    QuantityAffected =
                                        child.ItemType == ItemType.Quantity
                                            ? child.CurrentQuantity
                                            : 1m,
                                    OccurredAt = now,
                                    CreatedBy = username,
                                    ModifiedBy = username,
                                }
                            );
                        }
                    }
                }
            }
        }

        loadout.Status = LoadoutStatus.ActiveCheckout;
        loadout.LastCheckedOutAt = now;
        loadout.ActiveCheckoutNote = request.CheckoutNote?.Trim();
        loadout.ModifiedAt = now;
        loadout.ModifiedBy = username;

        await dbContext.SaveChangesAsync(cancellationToken);
        return await GetLoadoutByIdAsync(userId, id, cancellationToken);
    }

    public async Task<LoadoutDto?> PackBackLoadoutAsync(
        Guid userId,
        Guid id,
        PackBackLoadoutRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var loadout = await dbContext
            .Loadouts.Include(l => l.Items)
                .ThenInclude(li => li.Item)
                    .ThenInclude(i => i.ChildItems)
            .FirstOrDefaultAsync(l => l.Id == id, cancellationToken);

        if (loadout is null)
        {
            return null;
        }

        if (loadout.IsPrivate && loadout.OwnerId != userId)
        {
            throw new ForbiddenException();
        }

        var user = await dbContext
            .Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        var username = user?.Username ?? "User";

        var now = DateTimeOffset.UtcNow;
        var entryMap = request.Items.ToDictionary(e => e.ItemId);

        foreach (var li in loadout.Items)
        {
            if (!entryMap.TryGetValue(li.ItemId, out var entry))
            {
                continue;
            }

            var itm = li.Item;
            if (itm is null || !IsItemAccessible(itm, userId, allLocations))
            {
                continue;
            }

            if (entry.IsReturned)
            {
                var qtyUsed = Math.Max(0, entry.QuantityUsed);
                var qtyReturned =
                    entry.QuantityReturned ?? Math.Max(0, li.QuantityCheckedOut - qtyUsed);

                li.QuantityUsed = qtyUsed;
                li.QuantityReturned = qtyReturned;
                li.IsCurrentlyCheckedOut = false;
                li.ReturnedAt = now;

                if ((li.IsConsumable || itm.ItemType == ItemType.Quantity) && qtyUsed > 0)
                {
                    itm.CurrentQuantity = Math.Max(0, itm.CurrentQuantity - qtyUsed);
                }

                itm.Status = ItemStatus.InPlace;
                itm.CheckedOutByUserId = null;
                itm.CheckedOutByUsername = null;
                itm.CheckedOutToBorrower = null;
                itm.CheckedOutBorrowerContact = null;
                itm.CheckoutNote = null;
                itm.CheckedOutAt = null;
                itm.CheckoutDueAt = null;
                itm.ActiveLoadoutId = null;
                itm.ActiveLoadoutName = null;
                itm.LastTouchedAt = now;

                var activeLogs = await dbContext
                    .CheckoutLogs.Where(l =>
                        l.ItemId == itm.Id
                        && l.ReturnedAt == null
                        && l.ActionType != CheckoutActionType.ReturnToHome
                    )
                    .ToListAsync(cancellationToken);
                foreach (var al in activeLogs)
                {
                    al.ReturnedAt = now;
                    al.ModifiedBy = username;
                }

                dbContext.CheckoutLogs.Add(
                    new CheckoutLog
                    {
                        Id = Guid.NewGuid(),
                        ItemId = itm.Id,
                        ActionType = CheckoutActionType.ReturnToHome,
                        PerformedByUserId = userId,
                        PerformedByUsername = username,
                        LoadoutId = loadout.Id,
                        LoadoutName = loadout.Name,
                        ProjectOrNote =
                            request.ReturnNote?.Trim() ?? $"Returned from Loadout: {loadout.Name}",
                        QuantityAffected = qtyReturned,
                        QuantityConsumed = qtyUsed > 0 ? qtyUsed : null,
                        OccurredAt = now,
                        ReturnedAt = now,
                        CreatedBy = username,
                        ModifiedBy = username,
                    }
                );

                if (itm.ItemType == ItemType.Kit && itm.ChildItems.Count > 0)
                {
                    foreach (var child in itm.ChildItems)
                    {
                        if (
                            child.ActiveLoadoutId == loadout.Id
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

                            var childLogs = await dbContext
                                .CheckoutLogs.Where(l =>
                                    l.ItemId == child.Id
                                    && l.ReturnedAt == null
                                    && l.ActionType != CheckoutActionType.ReturnToHome
                                )
                                .ToListAsync(cancellationToken);
                            foreach (var cl in childLogs)
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
                                    LoadoutId = loadout.Id,
                                    LoadoutName = loadout.Name,
                                    ProjectOrNote = $"Returned with Kit: {itm.Name}",
                                    QuantityAffected =
                                        child.ItemType == ItemType.Quantity
                                            ? child.CurrentQuantity
                                            : 1m,
                                    OccurredAt = now,
                                    ReturnedAt = now,
                                    CreatedBy = username,
                                    ModifiedBy = username,
                                }
                            );
                        }
                    }
                }
            }
            else
            {
                li.IsCurrentlyCheckedOut = true;
            }
        }

        if (loadout.Items.All(i => !i.IsCurrentlyCheckedOut))
        {
            loadout.Status = LoadoutStatus.Ready;
            loadout.LastReturnedAt = now;
            loadout.ActiveCheckoutNote = null;
        }

        loadout.ModifiedAt = now;
        loadout.ModifiedBy = username;

        await dbContext.SaveChangesAsync(cancellationToken);
        return await GetLoadoutByIdAsync(userId, id, cancellationToken);
    }

    private static LoadoutDto MapLoadoutToDto(
        Loadout loadout,
        Guid userId,
        IReadOnlyDictionary<Guid, LocationNode> allLocations
    )
    {
        var items = new List<LoadoutItemDto>();
        var preFlightWarnings = new List<string>();

        foreach (var li in loadout.Items.OrderBy(i => i.SortOrder))
        {
            var item = li.Item;
            if (item is null)
            {
                continue;
            }

            if (!IsItemAccessible(item, userId, allLocations))
            {
                continue;
            }

            string? warningMessage = null;
            if (item.Condition == ItemCondition.Broken)
            {
                warningMessage = "Item is marked Broken";
            }
            else if (item.Status == ItemStatus.LoanedOut)
            {
                warningMessage = $"Loaned out to {item.CheckedOutToBorrower ?? "borrower"}";
            }
            else if (item.Status == ItemStatus.InUse && item.ActiveLoadoutId != loadout.Id)
            {
                warningMessage =
                    $"Already in use ({item.CheckoutNote ?? item.CheckedOutByUsername ?? "active"})";
            }
            else if (item.Status == ItemStatus.Archived)
            {
                warningMessage = "Item is Archived";
            }
            else if (
                item.ItemType == ItemType.Quantity
                && item.CurrentQuantity < li.RequiredQuantity
                && !li.IsCurrentlyCheckedOut
            )
            {
                warningMessage =
                    $"Insufficient stock: {item.CurrentQuantity} available, {li.RequiredQuantity} required";
            }

            if (warningMessage != null)
            {
                preFlightWarnings.Add($"{item.Name} ({item.ShortCode}): {warningMessage}");
            }

            var homeLoc = item.HomeLocationId.HasValue
                ? allLocations.GetValueOrDefault(item.HomeLocationId.Value)
                : null;
            var fullPath = homeLoc != null ? BuildFullPath(homeLoc, allLocations) : null;

            items.Add(
                new LoadoutItemDto(
                    li.Id,
                    li.LoadoutId,
                    li.ItemId,
                    item.ShortCode,
                    item.Name,
                    item.ItemType,
                    item.Status,
                    item.Condition,
                    item.HomeLocationId,
                    homeLoc?.Name,
                    homeLoc?.ShortCode,
                    fullPath,
                    homeLoc?.ContainerStyle,
                    homeLoc?.PrimaryColor,
                    homeLoc?.AccentColor,
                    homeLoc?.ColorLabel,
                    item.CurrentQuantity,
                    item.Unit,
                    li.RequiredQuantity,
                    li.IsConsumable,
                    li.IsCurrentlyCheckedOut,
                    li.QuantityCheckedOut,
                    li.QuantityUsed,
                    li.QuantityReturned,
                    warningMessage != null,
                    warningMessage,
                    li.SortOrder
                )
            );
        }

        var stops = items
            .GroupBy(i => i.HomeLocationId)
            .Select(g =>
            {
                var first = g.First();
                var locNode = g.Key.HasValue ? allLocations.GetValueOrDefault(g.Key.Value) : null;
                var locName = locNode?.Name ?? "Unassigned Location";
                var locFullPath =
                    locNode != null ? BuildFullPath(locNode, allLocations) : "Unassigned";

                return new LoadoutPickListStopDto(
                    g.Key,
                    locName,
                    locNode?.ShortCode,
                    locFullPath,
                    locNode?.ContainerStyle,
                    locNode?.PrimaryColor,
                    locNode?.AccentColor,
                    locNode?.ColorLabel,
                    g.OrderBy(i => i.SortOrder).ToList()
                );
            })
            .OrderBy(s => s.LocationFullPath)
            .ToList();

        var checkedOutCount = items.Count(i => i.IsCurrentlyCheckedOut);
        var warningCount = items.Count(i => i.HasPreFlightWarning);

        return new LoadoutDto(
            loadout.Id,
            loadout.Name,
            loadout.Description,
            loadout.Icon,
            loadout.Status,
            loadout.LastCheckedOutAt,
            loadout.LastReturnedAt,
            loadout.ActiveCheckoutNote,
            loadout.IsPrivate,
            loadout.OwnerId,
            items.Count,
            checkedOutCount,
            warningCount,
            preFlightWarnings,
            items,
            stops,
            loadout.CreatedAt,
            loadout.ModifiedAt
        );
    }

    private static string BuildFullPath(
        LocationNode node,
        IReadOnlyDictionary<Guid, LocationNode> nodeMap
    )
    {
        var parts = new List<string> { node.Name };
        var current = node.ParentId.HasValue
            ? nodeMap.GetValueOrDefault(node.ParentId.Value)
            : null;

        while (current != null)
        {
            parts.Add(current.Name);
            current = current.ParentId.HasValue
                ? nodeMap.GetValueOrDefault(current.ParentId.Value)
                : null;
        }

        parts.Reverse();
        return string.Join(" > ", parts);
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
