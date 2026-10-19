using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Attachments;
using WhereHouse.Core.Categories;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.Search;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class SearchService(WhereHouseDbContext dbContext) : ISearchService
{
    public async Task<SmartSearchResponseDto> SearchAsync(
        Guid userId,
        SmartSearchQuery searchQuery,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(searchQuery);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);

        var locationMap = allLocations.ToDictionary(n => n.Id);
        var accessibleLocationIds = ComputeAccessibleLocationIds(allLocations, userId);

        HashSet<Guid>? subtreeLocationIds = null;
        if (searchQuery.LocationId.HasValue)
        {
            var targetId = searchQuery.LocationId.Value;
            if (!accessibleLocationIds.Contains(targetId))
            {
                return new SmartSearchResponseDto(
                    searchQuery.Query ?? string.Empty,
                    Array.Empty<LocationSearchHitDto>(),
                    Array.Empty<ItemDto>(),
                    Array.Empty<ItemDto>(),
                    0
                );
            }

            subtreeLocationIds = ComputeSubtreeLocationIds(allLocations, targetId);
            subtreeLocationIds.IntersectWith(accessibleLocationIds);
        }

        var rawQuery = searchQuery.Query?.Trim() ?? string.Empty;
        var tokens = string.IsNullOrWhiteSpace(rawQuery)
            ? Array.Empty<string>()
            : rawQuery
                .ToLowerInvariant()
                .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

        var isItemSpecificSearch =
            searchQuery.CategoryId.HasValue
            || searchQuery.ItemType.HasValue
            || searchQuery.Status.HasValue
            || searchQuery.OutOfPlaceOnly
            || searchQuery.LowStockOnly
            || !string.IsNullOrWhiteSpace(searchQuery.AttributeName);

        var matchingLocations = new List<LocationSearchHitDto>();
        if (!isItemSpecificSearch)
        {
            var candidateLocations = allLocations.Where(l =>
                accessibleLocationIds.Contains(l.Id)
                && (subtreeLocationIds == null || subtreeLocationIds.Contains(l.Id))
            );

            foreach (var loc in candidateLocations)
            {
                var fullPath = BuildFullPath(loc, locationMap);
                if (tokens.Length > 0)
                {
                    var matchesAllTokens = tokens.All(t =>
                        loc.Name.Contains(t, StringComparison.OrdinalIgnoreCase)
                        || loc.ShortCode.Contains(t, StringComparison.OrdinalIgnoreCase)
                        || (
                            loc.Description != null
                            && loc.Description.Contains(t, StringComparison.OrdinalIgnoreCase)
                        )
                        || (
                            loc.ContainerStyle != null
                            && loc.ContainerStyle.Contains(t, StringComparison.OrdinalIgnoreCase)
                        )
                        || (
                            loc.ColorLabel != null
                            && loc.ColorLabel.Contains(t, StringComparison.OrdinalIgnoreCase)
                        )
                        || fullPath.Contains(t, StringComparison.OrdinalIgnoreCase)
                    );

                    if (!matchesAllTokens)
                    {
                        continue;
                    }
                }

                var childCount = allLocations.Count(c => c.ParentId == loc.Id);
                var itemCount = await dbContext
                    .InventoryItems.AsNoTracking()
                    .CountAsync(
                        i =>
                            i.HomeLocationId == loc.Id
                            && (!i.IsPrivate || i.OwnerId == userId)
                            && i.Status != ItemStatus.Archived,
                        cancellationToken
                    );

                matchingLocations.Add(
                    new LocationSearchHitDto(
                        loc.Id,
                        loc.ParentId,
                        loc.Name,
                        loc.Description,
                        loc.NodeType,
                        loc.ShortCode,
                        loc.Icon,
                        loc.ContainerStyle,
                        loc.PrimaryColor,
                        loc.AccentColor,
                        loc.ColorLabel,
                        loc.IsPrivate,
                        fullPath,
                        itemCount,
                        childCount
                    )
                );
            }

            matchingLocations = matchingLocations
                .OrderBy(l => l.NodeType)
                .ThenBy(l => l.Name, StringComparer.OrdinalIgnoreCase)
                .Take(25)
                .ToList();
        }

        var allItems = await dbContext
            .InventoryItems.AsNoTracking()
            .Include(x => x.Category)
            .Include(x => x.ParentItem)
            .Include(x => x.AttributeValues)
            .Include(x => x.Attachments)
            .Include(x => x.ChildItems)
            .ToListAsync(cancellationToken);

        var candidateItems = allItems.Where(i =>
        {
            if (i.IsPrivate && i.OwnerId != userId)
            {
                return false;
            }

            if (
                i.HomeLocationId.HasValue && !accessibleLocationIds.Contains(i.HomeLocationId.Value)
            )
            {
                return false;
            }

            if (
                subtreeLocationIds != null
                && (
                    !i.HomeLocationId.HasValue
                    || !subtreeLocationIds.Contains(i.HomeLocationId.Value)
                )
            )
            {
                return false;
            }

            if (searchQuery.CategoryId.HasValue && i.CategoryId != searchQuery.CategoryId.Value)
            {
                return false;
            }

            if (searchQuery.ItemType.HasValue && i.ItemType != searchQuery.ItemType.Value)
            {
                return false;
            }

            if (searchQuery.Status.HasValue && i.Status != searchQuery.Status.Value)
            {
                return false;
            }

            if (
                searchQuery.OutOfPlaceOnly
                && i.Status != ItemStatus.InUse
                && i.Status != ItemStatus.LoanedOut
            )
            {
                return false;
            }

            if (
                searchQuery.LowStockOnly
                && (
                    i.ItemType != ItemType.Quantity
                    || !i.MinQuantity.HasValue
                    || i.CurrentQuantity > i.MinQuantity.Value
                )
            )
            {
                return false;
            }

            if (!string.IsNullOrWhiteSpace(searchQuery.AttributeName))
            {
                var targetAttr = searchQuery.AttributeName.Trim();
                var matchingVal = i.AttributeValues.FirstOrDefault(av =>
                    av.AttributeName.Equals(targetAttr, StringComparison.OrdinalIgnoreCase)
                );

                if (matchingVal == null)
                {
                    return false;
                }

                if (
                    !string.IsNullOrWhiteSpace(searchQuery.AttributeValue)
                    && !matchingVal.Value.Contains(
                        searchQuery.AttributeValue.Trim(),
                        StringComparison.OrdinalIgnoreCase
                    )
                )
                {
                    return false;
                }

                if (
                    searchQuery.AttributeMinNumber.HasValue
                    || searchQuery.AttributeMaxNumber.HasValue
                )
                {
                    if (!decimal.TryParse(matchingVal.Value, out var numVal))
                    {
                        return false;
                    }

                    if (
                        searchQuery.AttributeMinNumber.HasValue
                        && numVal < searchQuery.AttributeMinNumber.Value
                    )
                    {
                        return false;
                    }

                    if (
                        searchQuery.AttributeMaxNumber.HasValue
                        && numVal > searchQuery.AttributeMaxNumber.Value
                    )
                    {
                        return false;
                    }
                }
            }

            return true;
        });

        var matchedItems = new List<InventoryItem>();
        foreach (var itm in candidateItems)
        {
            if (tokens.Length == 0)
            {
                matchedItems.Add(itm);
                continue;
            }

            var homePath =
                itm.HomeLocationId.HasValue
                && locationMap.TryGetValue(itm.HomeLocationId.Value, out var loc)
                    ? BuildFullPath(loc, locationMap)
                    : string.Empty;

            var matchesAllTokens = tokens.All(t =>
                itm.Name.Contains(t, StringComparison.OrdinalIgnoreCase)
                || itm.ShortCode.Contains(t, StringComparison.OrdinalIgnoreCase)
                || (
                    itm.Description != null
                    && itm.Description.Contains(t, StringComparison.OrdinalIgnoreCase)
                )
                || (
                    itm.Aliases != null
                    && itm.Aliases.Contains(t, StringComparison.OrdinalIgnoreCase)
                )
                || (itm.Tags != null && itm.Tags.Contains(t, StringComparison.OrdinalIgnoreCase))
                || (itm.Brand != null && itm.Brand.Contains(t, StringComparison.OrdinalIgnoreCase))
                || (
                    itm.ModelNumber != null
                    && itm.ModelNumber.Contains(t, StringComparison.OrdinalIgnoreCase)
                )
                || (
                    itm.SerialNumber != null
                    && itm.SerialNumber.Contains(t, StringComparison.OrdinalIgnoreCase)
                )
                || (
                    itm.BarcodeNumber != null
                    && itm.BarcodeNumber.Contains(t, StringComparison.OrdinalIgnoreCase)
                )
                || (
                    itm.Category != null
                    && itm.Category.Name.Contains(t, StringComparison.OrdinalIgnoreCase)
                )
                || homePath.Contains(t, StringComparison.OrdinalIgnoreCase)
                || itm.AttributeValues.Any(av =>
                    av.AttributeName.Contains(t, StringComparison.OrdinalIgnoreCase)
                    || av.Value.Contains(t, StringComparison.OrdinalIgnoreCase)
                )
                || itm.Attachments.Any(a =>
                    a.FileName.Contains(t, StringComparison.OrdinalIgnoreCase)
                    || (a.Notes != null && a.Notes.Contains(t, StringComparison.OrdinalIgnoreCase))
                )
            );

            if (matchesAllTokens)
            {
                matchedItems.Add(itm);
            }
        }

        var activeDtos = new List<ItemDto>();
        var archivedDtos = new List<ItemDto>();

        foreach (var itm in matchedItems)
        {
            var dto = MapItemToDto(itm, locationMap);

            if (itm.Status == ItemStatus.Archived)
            {
                if (searchQuery.Status == ItemStatus.Archived)
                {
                    activeDtos.Add(dto);
                }
                else if (searchQuery.IncludeArchived)
                {
                    archivedDtos.Add(dto);
                }
            }
            else
            {
                activeDtos.Add(dto);
            }
        }

        activeDtos = activeDtos
            .OrderBy(i =>
            {
                if (!string.IsNullOrWhiteSpace(rawQuery))
                {
                    if (i.ShortCode.Equals(rawQuery, StringComparison.OrdinalIgnoreCase))
                    {
                        return 0;
                    }
                    if (i.Name.StartsWith(rawQuery, StringComparison.OrdinalIgnoreCase))
                    {
                        return 1;
                    }
                    if (i.Name.Contains(rawQuery, StringComparison.OrdinalIgnoreCase))
                    {
                        return 2;
                    }
                }
                return 3;
            })
            .ThenBy(i => i.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        archivedDtos = archivedDtos.OrderByDescending(i => i.ModifiedAt).ToList();

        var total = matchingLocations.Count + activeDtos.Count + archivedDtos.Count;

        return new SmartSearchResponseDto(
            rawQuery,
            matchingLocations,
            activeDtos,
            archivedDtos,
            total
        );
    }

    private static HashSet<Guid> ComputeAccessibleLocationIds(
        IEnumerable<LocationNode> allNodes,
        Guid userId
    )
    {
        var nodeMap = allNodes.ToDictionary(n => n.Id);
        var accessible = new HashSet<Guid>();

        foreach (var node in nodeMap.Values)
        {
            var current = node;
            var isAccessible = true;

            while (current != null)
            {
                if (current.IsPrivate && current.OwnerId != userId)
                {
                    isAccessible = false;
                    break;
                }
                current = current.ParentId.HasValue
                    ? nodeMap.GetValueOrDefault(current.ParentId.Value)
                    : null;
            }

            if (isAccessible)
            {
                accessible.Add(node.Id);
            }
        }

        return accessible;
    }

    private static HashSet<Guid> ComputeSubtreeLocationIds(
        IEnumerable<LocationNode> allNodes,
        Guid rootId
    )
    {
        var lookup = allNodes.ToLookup(n => n.ParentId);
        var result = new HashSet<Guid> { rootId };
        var queue = new Queue<Guid>();
        queue.Enqueue(rootId);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            foreach (var child in lookup[current])
            {
                if (result.Add(child.Id))
                {
                    queue.Enqueue(child.Id);
                }
            }
        }

        return result;
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

    private static ItemDto MapItemToDto(
        InventoryItem item,
        IReadOnlyDictionary<Guid, LocationNode> locationMap
    )
    {
        var aliases = (item.Aliases ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();

        var tags = (item.Tags ?? "")
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .ToList();

        var homeNode = item.HomeLocationId.HasValue
            ? locationMap.GetValueOrDefault(item.HomeLocationId.Value)
            : null;

        var fullPath = homeNode != null ? BuildFullPath(homeNode, locationMap) : null;

        var isLowStock =
            item.ItemType == ItemType.Quantity
            && item.MinQuantity.HasValue
            && item.CurrentQuantity <= item.MinQuantity.Value;

        var (isIncompleteKit, warnings) = CalculateKitStatus(item, locationMap);

        var primaryPhoto =
            item.Attachments.FirstOrDefault(a => a.IsPrimaryPhoto)?.Id
            ?? item.Attachments.FirstOrDefault(a => a.AttachmentType == AttachmentType.Photo)?.Id;

        return new ItemDto(
            item.Id,
            item.ShortCode,
            item.Name,
            item.Description,
            aliases,
            tags,
            item.ItemType,
            item.Status,
            item.Condition,
            item.HomeLocationId,
            homeNode?.Name,
            homeNode?.ShortCode,
            fullPath,
            item.CategoryId,
            item.Category?.Name,
            item.ParentItemId,
            item.ParentItem?.Name,
            item.Brand,
            item.ModelNumber,
            item.SerialNumber,
            item.CurrentQuantity,
            item.Unit,
            item.MinQuantity,
            isLowStock,
            isIncompleteKit,
            warnings,
            item.PurchaseDate,
            item.Retailer,
            item.PurchasePrice,
            item.EstimatedReplacementValue,
            item.ReturnWindowEndDate,
            item.WarrantyExpirationDate,
            item.WarrantyNotes,
            item.IsPrivate,
            item.OwnerId,
            item.AttributeValues.Select(v => new ItemAttributeValueDto(
                    v.Id,
                    v.AttributeTemplateId,
                    v.AttributeName,
                    v.FieldType,
                    v.Unit,
                    v.Value
                ))
                .ToList(),
            item.ChildItems.Select(c =>
                {
                    var childLowStock =
                        c.ItemType == ItemType.Quantity
                        && c.MinQuantity.HasValue
                        && c.CurrentQuantity <= c.MinQuantity.Value;
                    var childNode = c.HomeLocationId.HasValue
                        ? locationMap.GetValueOrDefault(c.HomeLocationId.Value)
                        : null;
                    return new ItemChildSummaryDto(
                        c.Id,
                        c.ShortCode,
                        c.Name,
                        c.ItemType,
                        c.Status,
                        c.Condition,
                        c.CurrentQuantity,
                        c.Unit,
                        c.MinQuantity,
                        childLowStock,
                        childNode != null ? BuildFullPath(childNode, locationMap) : null
                    );
                })
                .ToList(),
            item.LastTouchedAt,
            item.CreatedAt,
            item.ModifiedAt,
            item.Attachments.Count,
            primaryPhoto,
            item.BarcodeNumber
        );
    }

    private static (bool IsIncomplete, IReadOnlyList<string> Warnings) CalculateKitStatus(
        InventoryItem item,
        IReadOnlyDictionary<Guid, LocationNode> locationMap
    )
    {
        if (item.ItemType != ItemType.Kit || item.ChildItems.Count == 0)
        {
            return (false, Array.Empty<string>());
        }

        var warnings = new List<string>();

        foreach (var child in item.ChildItems)
        {
            if (child.Condition == ItemCondition.Broken)
            {
                warnings.Add($"Item '{child.Name}' ({child.ShortCode}) is Broken.");
            }

            if (child.Status != ItemStatus.InPlace)
            {
                warnings.Add(
                    $"Item '{child.Name}' ({child.ShortCode}) is not In Place (Status: {child.Status})."
                );
            }

            if (child.ItemType == ItemType.Quantity)
            {
                if (child.CurrentQuantity <= 0)
                {
                    warnings.Add($"Consumable '{child.Name}' ({child.ShortCode}) is Out of Stock.");
                }
                else if (
                    child.MinQuantity.HasValue
                    && child.CurrentQuantity <= child.MinQuantity.Value
                )
                {
                    warnings.Add($"Consumable '{child.Name}' ({child.ShortCode}) is Low Stock.");
                }
            }
        }

        return (warnings.Count > 0, warnings);
    }
}
