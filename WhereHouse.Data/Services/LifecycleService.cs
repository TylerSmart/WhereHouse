using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Items;
using WhereHouse.Core.Lifecycle;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class LifecycleService(WhereHouseDbContext dbContext, IItemService itemService)
    : ILifecycleService
{
    public async Task<ItemDto?> StageItemAsync(
        Guid userId,
        Guid itemId,
        StageItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.TargetPrice.HasValue && request.TargetPrice.Value < 0)
        {
            throw new ArgumentException("Target price cannot be negative.", nameof(request));
        }

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var item = await dbContext.InventoryItems.FirstOrDefaultAsync(
            i => i.Id == itemId,
            cancellationToken
        );

        if (item is null)
        {
            return null;
        }

        if (!IsItemAccessible(item, userId, allLocations))
        {
            throw new ForbiddenException();
        }

        var now = DateTimeOffset.UtcNow;
        item.Status = request.IsToSell ? ItemStatus.StagedToSell : ItemStatus.StagedToDonate;
        item.StagingTargetPrice = request.TargetPrice;
        item.StagingListingNotes = string.IsNullOrWhiteSpace(request.ListingNotes)
            ? null
            : request.ListingNotes.Trim();
        item.StagedAt = now;
        item.LastTouchedAt = now;

        // Clear active checkout fields if any
        item.CheckedOutByUserId = null;
        item.CheckedOutByUsername = null;
        item.CheckedOutToBorrower = null;
        item.CheckedOutBorrowerContact = null;
        item.CheckoutNote = null;
        item.CheckedOutAt = null;
        item.CheckoutDueAt = null;
        item.ActiveLoadoutId = null;
        item.ActiveLoadoutName = null;

        // Clear prior archive fields if any
        item.DispositionReason = null;
        item.DispositionNote = null;
        item.SalePrice = null;
        item.ArchivedAt = null;
        item.ArchivedByUserId = null;
        item.ArchivedByUsername = null;

        await dbContext.SaveChangesAsync(cancellationToken);
        return await itemService.GetItemByIdAsync(userId, itemId, cancellationToken);
    }

    public async Task<ItemDto?> UnstageItemAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var item = await dbContext.InventoryItems.FirstOrDefaultAsync(
            i => i.Id == itemId,
            cancellationToken
        );

        if (item is null)
        {
            return null;
        }

        if (!IsItemAccessible(item, userId, allLocations))
        {
            throw new ForbiddenException();
        }

        item.Status = ItemStatus.InPlace;
        item.StagingTargetPrice = null;
        item.StagingListingNotes = null;
        item.StagedAt = null;
        item.LastTouchedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return await itemService.GetItemByIdAsync(userId, itemId, cancellationToken);
    }

    public async Task<ItemDto?> ArchiveItemAsync(
        Guid userId,
        Guid itemId,
        ArchiveItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.SalePrice.HasValue && request.SalePrice.Value < 0)
        {
            throw new ArgumentException("Sale price cannot be negative.", nameof(request));
        }

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var item = await dbContext.InventoryItems.FirstOrDefaultAsync(
            i => i.Id == itemId,
            cancellationToken
        );

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
        var username = user?.Username ?? "System";
        var now = DateTimeOffset.UtcNow;

        item.Status = ItemStatus.Archived;
        item.DispositionReason = request.DispositionReason;
        item.DispositionNote = string.IsNullOrWhiteSpace(request.DispositionNote)
            ? null
            : request.DispositionNote.Trim();
        item.SalePrice =
            request.DispositionReason == DispositionReason.Sold
                ? (request.SalePrice ?? item.StagingTargetPrice)
                : request.SalePrice;
        item.ArchivedAt = now;
        item.ArchivedByUserId = userId;
        item.ArchivedByUsername = username;
        item.LastTouchedAt = now;

        // Clear active checkout fields
        item.CheckedOutByUserId = null;
        item.CheckedOutByUsername = null;
        item.CheckedOutToBorrower = null;
        item.CheckedOutBorrowerContact = null;
        item.CheckoutNote = null;
        item.CheckedOutAt = null;
        item.CheckoutDueAt = null;
        item.ActiveLoadoutId = null;
        item.ActiveLoadoutName = null;

        // Clear staging fields
        item.StagingTargetPrice = null;
        item.StagingListingNotes = null;
        item.StagedAt = null;

        await dbContext.SaveChangesAsync(cancellationToken);
        return await itemService.GetItemByIdAsync(userId, itemId, cancellationToken);
    }

    public async Task<ItemDto?> RestoreArchivedItemAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var item = await dbContext.InventoryItems.FirstOrDefaultAsync(
            i => i.Id == itemId,
            cancellationToken
        );

        if (item is null)
        {
            return null;
        }

        if (!IsItemAccessible(item, userId, allLocations))
        {
            throw new ForbiddenException();
        }

        item.Status = ItemStatus.InPlace;
        item.DispositionReason = null;
        item.DispositionNote = null;
        item.SalePrice = null;
        item.ArchivedAt = null;
        item.ArchivedByUserId = null;
        item.ArchivedByUsername = null;
        item.StagingTargetPrice = null;
        item.StagingListingNotes = null;
        item.StagedAt = null;
        item.LastTouchedAt = DateTimeOffset.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        return await itemService.GetItemByIdAsync(userId, itemId, cancellationToken);
    }

    public async Task<ItemDto?> TouchItemAsync(
        Guid userId,
        Guid itemId,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var item = await dbContext.InventoryItems.FirstOrDefaultAsync(
            i => i.Id == itemId,
            cancellationToken
        );

        if (item is null)
        {
            return null;
        }

        if (!IsItemAccessible(item, userId, allLocations))
        {
            throw new ForbiddenException();
        }

        item.LastTouchedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return await itemService.GetItemByIdAsync(userId, itemId, cancellationToken);
    }

    public async Task<BulkLifecycleResultDto> BulkArchiveItemsAsync(
        Guid userId,
        BulkArchiveRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.ItemIds == null || request.ItemIds.Count == 0)
        {
            throw new ArgumentException("At least one item ID must be provided.", nameof(request));
        }

        if (request.SalePrice.HasValue && request.SalePrice.Value < 0)
        {
            throw new ArgumentException("Sale price cannot be negative.", nameof(request));
        }

        var distinctIds = request.ItemIds.Distinct().ToList();
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var user = await dbContext
            .Users.AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
        var username = user?.Username ?? "System";
        var now = DateTimeOffset.UtcNow;

        var items = await dbContext
            .InventoryItems.Where(i => distinctIds.Contains(i.Id))
            .ToListAsync(cancellationToken);

        var updatedIds = new List<Guid>();

        foreach (var item in items)
        {
            if (!IsItemAccessible(item, userId, allLocations))
            {
                continue;
            }

            item.Status = ItemStatus.Archived;
            item.DispositionReason = request.DispositionReason;
            item.DispositionNote = string.IsNullOrWhiteSpace(request.DispositionNote)
                ? null
                : request.DispositionNote.Trim();
            item.SalePrice =
                request.DispositionReason == DispositionReason.Sold
                    ? (request.SalePrice ?? item.StagingTargetPrice)
                    : request.SalePrice;
            item.ArchivedAt = now;
            item.ArchivedByUserId = userId;
            item.ArchivedByUsername = username;
            item.LastTouchedAt = now;

            // Clear checkout
            item.CheckedOutByUserId = null;
            item.CheckedOutByUsername = null;
            item.CheckedOutToBorrower = null;
            item.CheckedOutBorrowerContact = null;
            item.CheckoutNote = null;
            item.CheckedOutAt = null;
            item.CheckoutDueAt = null;
            item.ActiveLoadoutId = null;
            item.ActiveLoadoutName = null;

            // Clear staging
            item.StagingTargetPrice = null;
            item.StagingListingNotes = null;
            item.StagedAt = null;

            updatedIds.Add(item.Id);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var processedDtos = new List<ItemDto>();
        foreach (var id in updatedIds)
        {
            var dto = await itemService.GetItemByIdAsync(userId, id, cancellationToken);
            if (dto is not null)
            {
                processedDtos.Add(dto);
            }
        }

        return new BulkLifecycleResultDto(processedDtos.Count, processedDtos);
    }

    public async Task<BulkLifecycleResultDto> BulkUnstageItemsAsync(
        Guid userId,
        BulkUnstageRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.ItemIds == null || request.ItemIds.Count == 0)
        {
            throw new ArgumentException("At least one item ID must be provided.", nameof(request));
        }

        var distinctIds = request.ItemIds.Distinct().ToList();
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var items = await dbContext
            .InventoryItems.Where(i => distinctIds.Contains(i.Id))
            .ToListAsync(cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var updatedIds = new List<Guid>();

        foreach (var item in items)
        {
            if (!IsItemAccessible(item, userId, allLocations))
            {
                continue;
            }

            item.Status = ItemStatus.InPlace;
            item.StagingTargetPrice = null;
            item.StagingListingNotes = null;
            item.StagedAt = null;
            item.LastTouchedAt = now;

            updatedIds.Add(item.Id);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var processedDtos = new List<ItemDto>();
        foreach (var id in updatedIds)
        {
            var dto = await itemService.GetItemByIdAsync(userId, id, cancellationToken);
            if (dto is not null)
            {
                processedDtos.Add(dto);
            }
        }

        return new BulkLifecycleResultDto(processedDtos.Count, processedDtos);
    }

    public async Task<DeclutterStagingSummaryDto> GetStagedItemsAsync(
        Guid userId,
        ItemStatus? statusFilter = null,
        Guid? locationId = null,
        bool includeSubtreeLocations = true,
        CancellationToken cancellationToken = default
    )
    {
        var allLocationsList = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var allLocations = allLocationsList.ToDictionary(l => l.Id);

        var query = dbContext
            .InventoryItems.AsNoTracking()
            .Where(i =>
                i.Status == ItemStatus.StagedToSell || i.Status == ItemStatus.StagedToDonate
            );

        if (statusFilter.HasValue)
        {
            query = query.Where(i => i.Status == statusFilter.Value);
        }

        var stagedList = await query.ToListAsync(cancellationToken);

        // Filter by accessibility
        var accessibleItems = stagedList
            .Where(i => IsItemAccessible(i, userId, allLocations))
            .ToList();

        // Location filtering
        if (locationId.HasValue)
        {
            if (includeSubtreeLocations)
            {
                var subtreeIds = GetLocationSubtreeIds(locationId.Value, allLocationsList);
                accessibleItems = accessibleItems
                    .Where(i =>
                        i.HomeLocationId.HasValue && subtreeIds.Contains(i.HomeLocationId.Value)
                    )
                    .ToList();
            }
            else
            {
                accessibleItems = accessibleItems
                    .Where(i => i.HomeLocationId == locationId.Value)
                    .ToList();
            }
        }

        var stagedToSellCount = accessibleItems.Count(i => i.Status == ItemStatus.StagedToSell);
        var stagedToDonateCount = accessibleItems.Count(i => i.Status == ItemStatus.StagedToDonate);

        var totalTargetResaleValue = accessibleItems
            .Where(i => i.Status == ItemStatus.StagedToSell)
            .Sum(i => i.StagingTargetPrice ?? i.EstimatedReplacementValue ?? i.PurchasePrice ?? 0m);

        var totalEstimatedDonationValue = accessibleItems
            .Where(i => i.Status == ItemStatus.StagedToDonate)
            .Sum(i => i.StagingTargetPrice ?? i.EstimatedReplacementValue ?? i.PurchasePrice ?? 0m);

        var orderedItems = accessibleItems
            .OrderByDescending(i => i.StagedAt)
            .ThenBy(i => i.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var itemDtos = new List<ItemDto>();
        foreach (var item in orderedItems)
        {
            var dto = await itemService.GetItemByIdAsync(userId, item.Id, cancellationToken);
            if (dto is not null)
            {
                itemDtos.Add(dto);
            }
        }

        return new DeclutterStagingSummaryDto(
            itemDtos.Count,
            stagedToSellCount,
            stagedToDonateCount,
            totalTargetResaleValue,
            totalEstimatedDonationValue,
            itemDtos
        );
    }

    public async Task<GraveyardSummaryDto> GetGraveyardItemsAsync(
        Guid userId,
        DispositionReason? dispositionReason = null,
        string? search = null,
        CancellationToken cancellationToken = default
    )
    {
        var allLocationsList = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var allLocations = allLocationsList.ToDictionary(l => l.Id);

        var allArchived = await dbContext
            .InventoryItems.AsNoTracking()
            .Where(i => i.Status == ItemStatus.Archived)
            .ToListAsync(cancellationToken);

        var accessibleArchived = allArchived
            .Where(i => IsItemAccessible(i, userId, allLocations))
            .ToList();

        var totalArchivedCount = accessibleArchived.Count;
        var soldCount = accessibleArchived.Count(i =>
            i.DispositionReason == DispositionReason.Sold
        );
        var donatedCount = accessibleArchived.Count(i =>
            i.DispositionReason == DispositionReason.Donated
        );
        var recycledCount = accessibleArchived.Count(i =>
            i.DispositionReason == DispositionReason.Recycled
        );
        var brokenTrashedCount = accessibleArchived.Count(i =>
            i.DispositionReason == DispositionReason.BrokenTrashed
        );
        var consumedCount = accessibleArchived.Count(i =>
            i.DispositionReason == DispositionReason.Consumed
        );

        var totalSaleProceeds = accessibleArchived
            .Where(i => i.DispositionReason == DispositionReason.Sold)
            .Sum(i => i.SalePrice ?? 0m);

        var totalDonatedEstimatedValue = accessibleArchived
            .Where(i => i.DispositionReason == DispositionReason.Donated)
            .Sum(i => i.EstimatedReplacementValue ?? i.PurchasePrice ?? 0m);

        IEnumerable<InventoryItem> filtered = accessibleArchived;

        if (dispositionReason.HasValue)
        {
            filtered = filtered.Where(i => i.DispositionReason == dispositionReason.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            filtered = filtered.Where(i =>
            {
                var homePath =
                    i.HomeLocationId.HasValue
                    && allLocations.TryGetValue(i.HomeLocationId.Value, out var loc)
                        ? BuildLocationFullPath(loc, allLocations)
                        : string.Empty;

                return i.Name.Contains(s, StringComparison.OrdinalIgnoreCase)
                    || i.ShortCode.Contains(s, StringComparison.OrdinalIgnoreCase)
                    || (i.Brand?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false)
                    || (i.ModelNumber?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false)
                    || (i.DispositionNote?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false)
                    || homePath.Contains(s, StringComparison.OrdinalIgnoreCase);
            });
        }

        var orderedFiltered = filtered
            .OrderByDescending(i => i.ArchivedAt)
            .ThenBy(i => i.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var itemDtos = new List<ItemDto>();
        foreach (var item in orderedFiltered)
        {
            var dto = await itemService.GetItemByIdAsync(userId, item.Id, cancellationToken);
            if (dto is not null)
            {
                itemDtos.Add(dto);
            }
        }

        return new GraveyardSummaryDto(
            totalArchivedCount,
            soldCount,
            donatedCount,
            recycledCount,
            brokenTrashedCount,
            consumedCount,
            totalSaleProceeds,
            totalDonatedEstimatedValue,
            itemDtos
        );
    }

    public async Task<DustCollectorInsightsDto> GetDustCollectorsAsync(
        Guid userId,
        int minUntouchedDays = 365,
        Guid? locationId = null,
        bool includeSubtreeLocations = true,
        Guid? categoryId = null,
        CancellationToken cancellationToken = default
    )
    {
        var days = Math.Max(1, minUntouchedDays);
        var cutoffDate = DateTimeOffset.UtcNow.AddDays(-days);

        var allLocationsList = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var allLocations = allLocationsList.ToDictionary(l => l.Id);

        var query = dbContext
            .InventoryItems.AsNoTracking()
            .Where(i => i.Status == ItemStatus.InPlace && i.LastTouchedAt <= cutoffDate);

        if (categoryId.HasValue)
        {
            query = query.Where(i => i.CategoryId == categoryId.Value);
        }

        var untouchedList = await query.ToListAsync(cancellationToken);

        // Filter by accessibility
        var accessibleItems = untouchedList
            .Where(i => IsItemAccessible(i, userId, allLocations))
            .ToList();

        // Location filtering
        if (locationId.HasValue)
        {
            if (includeSubtreeLocations)
            {
                var subtreeIds = GetLocationSubtreeIds(locationId.Value, allLocationsList);
                accessibleItems = accessibleItems
                    .Where(i =>
                        i.HomeLocationId.HasValue && subtreeIds.Contains(i.HomeLocationId.Value)
                    )
                    .ToList();
            }
            else
            {
                accessibleItems = accessibleItems
                    .Where(i => i.HomeLocationId == locationId.Value)
                    .ToList();
            }
        }

        var now = DateTimeOffset.UtcNow;
        var dustItems = new List<DustCollectorItemDto>();

        foreach (var item in accessibleItems)
        {
            var dto = await itemService.GetItemByIdAsync(userId, item.Id, cancellationToken);
            if (dto is null)
            {
                continue;
            }

            var daysUntouched = Math.Max(1, (int)Math.Floor((now - item.LastTouchedAt).TotalDays));
            var estimatedValue = item.EstimatedReplacementValue ?? item.PurchasePrice ?? 0m;

            dustItems.Add(new DustCollectorItemDto(dto, daysUntouched, estimatedValue));
        }

        var grouped = dustItems
            .GroupBy(d => d.Item.HomeLocationId)
            .Select(g =>
            {
                LocationNode? loc = null;
                if (g.Key.HasValue)
                {
                    allLocations.TryGetValue(g.Key.Value, out loc);
                }

                var locName = loc?.Name ?? "Unassigned Location";
                var locShortCode = loc?.ShortCode;
                var locFullPath = loc is not null
                    ? BuildLocationFullPath(loc, allLocations)
                    : "Unassigned";

                var groupItems = g.OrderByDescending(x => x.DaysUntouched)
                    .ThenBy(x => x.Item.Name, StringComparer.OrdinalIgnoreCase)
                    .ToList();

                var groupValue = groupItems.Sum(x => x.EstimatedValue);

                return new DustCollectorLocationGroupDto(
                    g.Key,
                    locName,
                    locShortCode,
                    locFullPath,
                    groupItems.Count,
                    groupValue,
                    groupItems
                );
            })
            .OrderBy(g => g.LocationFullPath, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var totalItemsCount = dustItems.Count;
        var totalEstimatedValue = dustItems.Sum(d => d.EstimatedValue);

        return new DustCollectorInsightsDto(
            days,
            cutoffDate,
            totalItemsCount,
            totalEstimatedValue,
            grouped
        );
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

            allLocations.TryGetValue(current.ParentId.Value, out current);
        }

        return true;
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

        if (
            item.HomeLocationId.HasValue
            && allLocations.TryGetValue(item.HomeLocationId.Value, out var loc)
        )
        {
            return IsLocationAccessible(loc, userId, allLocations);
        }

        return true;
    }

    private static string BuildLocationFullPath(
        LocationNode node,
        IReadOnlyDictionary<Guid, LocationNode> allLocations
    )
    {
        var breadcrumbs = new List<string>();
        var cur = node;
        while (cur is not null)
        {
            breadcrumbs.Insert(0, cur.Name);
            if (!cur.ParentId.HasValue)
            {
                break;
            }
            allLocations.TryGetValue(cur.ParentId.Value, out cur!);
        }

        return string.Join(" > ", breadcrumbs);
    }

    private static HashSet<Guid> GetLocationSubtreeIds(
        Guid rootId,
        IEnumerable<LocationNode> allLocations
    )
    {
        var lookup = allLocations.ToLookup(l => l.ParentId);
        var result = new HashSet<Guid> { rootId };
        var queue = new Queue<Guid>();
        queue.Enqueue(rootId);

        while (queue.Count > 0)
        {
            var cur = queue.Dequeue();
            foreach (var child in lookup[cur])
            {
                if (result.Add(child.Id))
                {
                    queue.Enqueue(child.Id);
                }
            }
        }

        return result;
    }
}
