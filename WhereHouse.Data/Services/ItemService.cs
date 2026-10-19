using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Items;
using WhereHouse.Core.QrCodes;
using WhereHouse.Core.Storage;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class ItemService(
    WhereHouseDbContext dbContext,
    IFileStorageService fileStorageService
) : IItemService
{
    public async Task<IReadOnlyList<ItemDto>> GetItemsAsync(
        Guid userId,
        Guid? locationId = null,
        bool includeSubtreeLocations = false,
        Guid? categoryId = null,
        ItemType? itemType = null,
        ItemStatus? status = null,
        bool? lowStockOnly = null,
        string? search = null,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var locationDict = allLocations.ToDictionary(l => l.Id);

        var query = dbContext
            .InventoryItems.AsNoTracking()
            .Include(i => i.Category)
            .Include(i => i.HomeLocation)
            .Include(i => i.ParentItem)
            .Include(i => i.AttributeValues)
            .Include(i => i.ChildItems)
            .Include(i => i.Attachments)
            .AsQueryable();

        if (categoryId.HasValue)
        {
            query = query.Where(i => i.CategoryId == categoryId.Value);
        }

        if (itemType.HasValue)
        {
            query = query.Where(i => i.ItemType == itemType.Value);
        }

        if (status.HasValue)
        {
            query = query.Where(i => i.Status == status.Value);
        }

        var itemsList = await query.ToListAsync(cancellationToken);

        // Filter by accessibility
        var accessibleItems = itemsList
            .Where(i => IsItemAccessible(i, userId, locationDict))
            .ToList();

        // Subtree location filtering
        if (locationId.HasValue)
        {
            if (includeSubtreeLocations)
            {
                var subtreeLocationIds = GetLocationSubtreeIds(locationId.Value, allLocations);
                accessibleItems = accessibleItems
                    .Where(i =>
                        i.HomeLocationId.HasValue
                        && subtreeLocationIds.Contains(i.HomeLocationId.Value)
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

        // Low stock filter
        if (lowStockOnly == true)
        {
            accessibleItems = accessibleItems
                .Where(i =>
                    i.ItemType == ItemType.Quantity
                    && (
                        (i.MinQuantity.HasValue && i.CurrentQuantity <= i.MinQuantity.Value)
                        || i.CurrentQuantity <= 0
                    )
                )
                .ToList();
        }

        // Search query filter
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim();
            accessibleItems = accessibleItems
                .Where(i =>
                    i.Name.Contains(s, StringComparison.OrdinalIgnoreCase)
                    || i.ShortCode.Contains(s, StringComparison.OrdinalIgnoreCase)
                    || (i.Description?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false)
                    || (i.Brand?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false)
                    || (i.ModelNumber?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false)
                    || (i.SerialNumber?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false)
                    || (i.Aliases?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false)
                    || (i.Tags?.Contains(s, StringComparison.OrdinalIgnoreCase) ?? false)
                )
                .ToList();
        }

        return accessibleItems
            .Select(i => MapToDto(i, locationDict, userId))
            .OrderBy(i => i.Name)
            .ToList();
    }

    public async Task<ItemDto?> GetItemByIdAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        var item = await dbContext
            .InventoryItems.AsNoTracking()
            .Include(i => i.Category)
            .Include(i => i.HomeLocation)
            .Include(i => i.ParentItem)
            .Include(i => i.AttributeValues)
            .Include(i => i.ChildItems)
            .Include(i => i.Attachments)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (item is null)
        {
            return null;
        }

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        if (!IsItemAccessible(item, userId, allLocations))
        {
            throw new ForbiddenException();
        }

        return MapToDto(item, allLocations, userId);
    }

    public async Task<ItemDto> CreateItemAsync(
        Guid userId,
        CreateItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        if (request.HomeLocationId.HasValue)
        {
            if (!allLocations.TryGetValue(request.HomeLocationId.Value, out var homeLoc))
            {
                throw new NotFoundException("Home location not found.");
            }

            if (!IsLocationAccessible(homeLoc, userId, allLocations))
            {
                throw new ForbiddenException();
            }
        }

        if (request.CategoryId.HasValue)
        {
            var catExists = await dbContext.Categories.AnyAsync(
                c => c.Id == request.CategoryId.Value,
                cancellationToken
            );
            if (!catExists)
            {
                throw new NotFoundException("Category not found.");
            }
        }

        if (request.ParentItemId.HasValue)
        {
            var parentItem = await dbContext.InventoryItems.FirstOrDefaultAsync(
                i => i.Id == request.ParentItemId.Value,
                cancellationToken
            );
            if (parentItem is null)
            {
                throw new NotFoundException("Parent item not found.");
            }
            if (!IsItemAccessible(parentItem, userId, allLocations))
            {
                throw new ForbiddenException();
            }
        }

        string shortCode;
        if (!string.IsNullOrWhiteSpace(request.ShortCode))
        {
            shortCode = ItemShortCodeGenerator.NormalizeShortCode(request.ShortCode);
            var exists = await dbContext.InventoryItems.AnyAsync(
                i => i.ShortCode == shortCode,
                cancellationToken
            );
            if (exists)
            {
                throw new ConflictException(
                    $"Short code '{shortCode}' is already in use.",
                    "Duplicate short code"
                );
            }
        }
        else
        {
            var existingCodes = await dbContext
                .InventoryItems.Select(i => i.ShortCode)
                .ToListAsync(cancellationToken);
            shortCode = ItemShortCodeGenerator.GenerateNextShortCode(existingCodes);
        }

        var item = new InventoryItem
        {
            Id = Guid.NewGuid(),
            ShortCode = shortCode,
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description)
                ? null
                : request.Description.Trim(),
            Aliases = request.Aliases is { Count: > 0 }
                ? string.Join(
                    ", ",
                    request.Aliases.Where(a => !string.IsNullOrWhiteSpace(a)).Select(a => a.Trim())
                )
                : null,
            Tags = request.Tags is { Count: > 0 }
                ? string.Join(
                    ", ",
                    request.Tags.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim())
                )
                : null,
            ItemType = request.ItemType,
            Status = ItemStatus.InPlace,
            Condition = request.Condition,
            HomeLocationId = request.HomeLocationId,
            CategoryId = request.CategoryId,
            ParentItemId = request.ParentItemId,
            Brand = string.IsNullOrWhiteSpace(request.Brand) ? null : request.Brand.Trim(),
            ModelNumber = string.IsNullOrWhiteSpace(request.ModelNumber)
                ? null
                : request.ModelNumber.Trim(),
            SerialNumber = string.IsNullOrWhiteSpace(request.SerialNumber)
                ? null
                : request.SerialNumber.Trim(),
            CurrentQuantity = request.CurrentQuantity,
            Unit = string.IsNullOrWhiteSpace(request.Unit) ? null : request.Unit.Trim(),
            MinQuantity = request.MinQuantity,
            PurchaseDate = request.PurchaseDate,
            Retailer = string.IsNullOrWhiteSpace(request.Retailer) ? null : request.Retailer.Trim(),
            PurchasePrice = request.PurchasePrice,
            EstimatedReplacementValue = request.EstimatedReplacementValue,
            ReturnWindowEndDate = request.ReturnWindowEndDate,
            WarrantyExpirationDate = request.WarrantyExpirationDate,
            WarrantyNotes = string.IsNullOrWhiteSpace(request.WarrantyNotes)
                ? null
                : request.WarrantyNotes.Trim(),
            IsPrivate = request.IsPrivate,
            OwnerId = userId,
            LastTouchedAt = DateTimeOffset.UtcNow,
        };

        if (request.AttributeValues is { Count: > 0 })
        {
            foreach (var attr in request.AttributeValues)
            {
                item.AttributeValues.Add(
                    new ItemAttributeValue
                    {
                        Id = Guid.NewGuid(),
                        ItemId = item.Id,
                        AttributeTemplateId = attr.AttributeTemplateId,
                        AttributeName = attr.AttributeName.Trim(),
                        FieldType = attr.FieldType,
                        Unit = string.IsNullOrWhiteSpace(attr.Unit) ? null : attr.Unit.Trim(),
                        Value = attr.Value.Trim(),
                    }
                );
            }
        }

        dbContext.InventoryItems.Add(item);
        await dbContext.SaveChangesAsync(cancellationToken);

        return (await GetItemByIdAsync(userId, item.Id, cancellationToken))!;
    }

    public async Task<ItemDto?> UpdateItemAsync(
        Guid userId,
        Guid id,
        UpdateItemRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var item = await dbContext
            .InventoryItems.Include(i => i.AttributeValues)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (item is null)
        {
            return null;
        }

        if (!IsItemAccessible(item, userId, allLocations))
        {
            throw new ForbiddenException();
        }

        if (request.HomeLocationId.HasValue)
        {
            if (!allLocations.TryGetValue(request.HomeLocationId.Value, out var homeLoc))
            {
                throw new NotFoundException("Home location not found.");
            }

            if (!IsLocationAccessible(homeLoc, userId, allLocations))
            {
                throw new ForbiddenException();
            }
        }

        if (request.CategoryId.HasValue)
        {
            var catExists = await dbContext.Categories.AnyAsync(
                c => c.Id == request.CategoryId.Value,
                cancellationToken
            );
            if (!catExists)
            {
                throw new NotFoundException("Category not found.");
            }
        }

        if (request.ParentItemId.HasValue)
        {
            if (request.ParentItemId.Value == id)
            {
                throw new ConflictException(
                    "An item cannot be its own parent/kit.",
                    "Invalid parent item"
                );
            }

            var parentItem = await dbContext.InventoryItems.FirstOrDefaultAsync(
                i => i.Id == request.ParentItemId.Value,
                cancellationToken
            );
            if (parentItem is null)
            {
                throw new NotFoundException("Parent item not found.");
            }
            if (!IsItemAccessible(parentItem, userId, allLocations))
            {
                throw new ForbiddenException();
            }
        }

        if (request.IsPrivate && item.OwnerId != userId)
        {
            item.OwnerId = userId;
        }

        item.Name = request.Name.Trim();
        item.ItemType = request.ItemType;
        item.HomeLocationId = request.HomeLocationId;
        item.CategoryId = request.CategoryId;
        item.ParentItemId = request.ParentItemId;
        item.Description = string.IsNullOrWhiteSpace(request.Description)
            ? null
            : request.Description.Trim();
        item.Aliases = request.Aliases is { Count: > 0 }
            ? string.Join(
                ", ",
                request.Aliases.Where(a => !string.IsNullOrWhiteSpace(a)).Select(a => a.Trim())
            )
            : null;
        item.Tags = request.Tags is { Count: > 0 }
            ? string.Join(
                ", ",
                request.Tags.Where(t => !string.IsNullOrWhiteSpace(t)).Select(t => t.Trim())
            )
            : null;
        item.Status = request.Status;
        item.Condition = request.Condition;
        item.Brand = string.IsNullOrWhiteSpace(request.Brand) ? null : request.Brand.Trim();
        item.ModelNumber = string.IsNullOrWhiteSpace(request.ModelNumber)
            ? null
            : request.ModelNumber.Trim();
        item.SerialNumber = string.IsNullOrWhiteSpace(request.SerialNumber)
            ? null
            : request.SerialNumber.Trim();
        item.CurrentQuantity = request.CurrentQuantity;
        item.Unit = string.IsNullOrWhiteSpace(request.Unit) ? null : request.Unit.Trim();
        item.MinQuantity = request.MinQuantity;
        item.PurchaseDate = request.PurchaseDate;
        item.Retailer = string.IsNullOrWhiteSpace(request.Retailer)
            ? null
            : request.Retailer.Trim();
        item.PurchasePrice = request.PurchasePrice;
        item.EstimatedReplacementValue = request.EstimatedReplacementValue;
        item.ReturnWindowEndDate = request.ReturnWindowEndDate;
        item.WarrantyExpirationDate = request.WarrantyExpirationDate;
        item.WarrantyNotes = string.IsNullOrWhiteSpace(request.WarrantyNotes)
            ? null
            : request.WarrantyNotes.Trim();
        item.IsPrivate = request.IsPrivate;
        item.LastTouchedAt = DateTimeOffset.UtcNow;

        // Sync AttributeValues
        dbContext.ItemAttributeValues.RemoveRange(item.AttributeValues);
        item.AttributeValues.Clear();

        if (request.AttributeValues is { Count: > 0 })
        {
            foreach (var attr in request.AttributeValues)
            {
                item.AttributeValues.Add(
                    new ItemAttributeValue
                    {
                        Id = Guid.NewGuid(),
                        ItemId = item.Id,
                        AttributeTemplateId = attr.AttributeTemplateId,
                        AttributeName = attr.AttributeName.Trim(),
                        FieldType = attr.FieldType,
                        Unit = string.IsNullOrWhiteSpace(attr.Unit) ? null : attr.Unit.Trim(),
                        Value = attr.Value.Trim(),
                    }
                );
            }
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return (await GetItemByIdAsync(userId, item.Id, cancellationToken))!;
    }

    public async Task<ItemDto?> AdjustItemQuantityAsync(
        Guid userId,
        Guid id,
        AdjustItemQuantityRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var item = await dbContext.InventoryItems.FirstOrDefaultAsync(
            i => i.Id == id,
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

        if (request.AbsoluteQuantity.HasValue)
        {
            item.CurrentQuantity = Math.Max(0, request.AbsoluteQuantity.Value);
        }
        else if (request.Delta.HasValue)
        {
            item.CurrentQuantity = Math.Max(0, item.CurrentQuantity + request.Delta.Value);
        }

        item.LastTouchedAt = DateTimeOffset.UtcNow;
        await dbContext.SaveChangesAsync(cancellationToken);

        return (await GetItemByIdAsync(userId, item.Id, cancellationToken))!;
    }

    public async Task<ItemDto?> DuplicateItemAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var source = await dbContext
            .InventoryItems.Include(i => i.AttributeValues)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (source is null)
        {
            return null;
        }

        if (!IsItemAccessible(source, userId, allLocations))
        {
            throw new ForbiddenException();
        }

        var existingCodes = await dbContext
            .InventoryItems.Select(i => i.ShortCode)
            .ToListAsync(cancellationToken);
        var nextCode = ItemShortCodeGenerator.GenerateNextShortCode(existingCodes);

        var duplicate = new InventoryItem
        {
            Id = Guid.NewGuid(),
            ShortCode = nextCode,
            Name = $"{source.Name} (Copy)",
            Description = source.Description,
            Aliases = source.Aliases,
            Tags = source.Tags,
            ItemType = source.ItemType,
            Status = ItemStatus.InPlace,
            Condition = source.Condition,
            HomeLocationId = source.HomeLocationId,
            CategoryId = source.CategoryId,
            ParentItemId = source.ParentItemId,
            Brand = source.Brand,
            ModelNumber = source.ModelNumber,
            SerialNumber = null, // 1-of-1 serial numbers are cleared
            CurrentQuantity = source.CurrentQuantity,
            Unit = source.Unit,
            MinQuantity = source.MinQuantity,
            PurchaseDate = source.PurchaseDate,
            Retailer = source.Retailer,
            PurchasePrice = source.PurchasePrice,
            EstimatedReplacementValue = source.EstimatedReplacementValue,
            ReturnWindowEndDate = source.ReturnWindowEndDate,
            WarrantyExpirationDate = source.WarrantyExpirationDate,
            WarrantyNotes = source.WarrantyNotes,
            IsPrivate = source.IsPrivate,
            OwnerId = userId,
            LastTouchedAt = DateTimeOffset.UtcNow,
        };

        foreach (var attr in source.AttributeValues)
        {
            duplicate.AttributeValues.Add(
                new ItemAttributeValue
                {
                    Id = Guid.NewGuid(),
                    ItemId = duplicate.Id,
                    AttributeTemplateId = attr.AttributeTemplateId,
                    AttributeName = attr.AttributeName,
                    FieldType = attr.FieldType,
                    Unit = attr.Unit,
                    Value = attr.Value,
                }
            );
        }

        dbContext.InventoryItems.Add(duplicate);
        await dbContext.SaveChangesAsync(cancellationToken);

        return (await GetItemByIdAsync(userId, duplicate.Id, cancellationToken))!;
    }

    public async Task<bool> DeleteItemAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var item = await dbContext
            .InventoryItems.Include(i => i.AttributeValues)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        if (item is null)
        {
            return false;
        }

        if (!IsItemAccessible(item, userId, allLocations))
        {
            throw new ForbiddenException();
        }

        var hasChildren = await dbContext.InventoryItems.AnyAsync(
            i => i.ParentItemId == id,
            cancellationToken
        );
        if (hasChildren)
        {
            throw new ConflictException(
                "Cannot delete an item or kit that still contains member/nested child items.",
                "Item has child components"
            );
        }

        var attachments = await dbContext
            .ItemAttachments.Where(a => a.ItemId == id)
            .ToListAsync(cancellationToken);

        foreach (var att in attachments)
        {
            await fileStorageService.DeleteFileAsync(att.StorageRelativePath, cancellationToken);
        }

        var boundQrCodes = await dbContext
            .QrCodes.Where(q => q.ItemId == id)
            .ToListAsync(cancellationToken);
        foreach (var qr in boundQrCodes)
        {
            qr.TargetType = QrTargetType.Unassigned;
            qr.ItemId = null;
            qr.BoundAt = null;
            qr.BoundByUserId = null;
        }

        dbContext.InventoryItems.Remove(item);
        await dbContext.SaveChangesAsync(cancellationToken);

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

    private static HashSet<Guid> GetLocationSubtreeIds(
        Guid rootId,
        IEnumerable<LocationNode> allLocations
    )
    {
        var childrenLookup = allLocations
            .Where(n => n.ParentId.HasValue)
            .GroupBy(n => n.ParentId!.Value)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());

        var result = new HashSet<Guid> { rootId };
        var queue = new Queue<Guid>();
        queue.Enqueue(rootId);

        while (queue.Count > 0)
        {
            var currentId = queue.Dequeue();
            if (childrenLookup.TryGetValue(currentId, out var childIds))
            {
                foreach (var childId in childIds)
                {
                    if (result.Add(childId))
                    {
                        queue.Enqueue(childId);
                    }
                }
            }
        }

        return result;
    }

    private static ItemDto MapToDto(
        InventoryItem item,
        IReadOnlyDictionary<Guid, LocationNode> allLocations,
        Guid userId
    )
    {
        var aliases = !string.IsNullOrWhiteSpace(item.Aliases)
            ? item.Aliases.Split(
                ',',
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
            )
            : [];

        var tags = !string.IsNullOrWhiteSpace(item.Tags)
            ? item.Tags.Split(
                ',',
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
            )
            : [];

        string? homeLocationFullPath = null;
        if (
            item.HomeLocationId.HasValue
            && allLocations.TryGetValue(item.HomeLocationId.Value, out var homeLoc)
        )
        {
            var breadcrumbs = new List<string>();
            var cur = homeLoc;
            while (cur is not null)
            {
                breadcrumbs.Insert(0, cur.Name);
                if (!cur.ParentId.HasValue)
                {
                    break;
                }
                allLocations.TryGetValue(cur.ParentId.Value, out cur!);
            }
            homeLocationFullPath = string.Join(" > ", breadcrumbs);
        }

        var isLowStock =
            item.ItemType == ItemType.Quantity
            && (
                (item.MinQuantity.HasValue && item.CurrentQuantity <= item.MinQuantity.Value)
                || item.CurrentQuantity <= 0
            );

        var warnings = new List<string>();
        var childSummaries = new List<ItemChildSummaryDto>();

        if (item.ChildItems is { Count: > 0 })
        {
            foreach (var child in item.ChildItems)
            {
                if (!IsItemAccessible(child, userId, allLocations))
                {
                    continue;
                }

                var childLowStock =
                    child.ItemType == ItemType.Quantity
                    && (
                        (
                            child.MinQuantity.HasValue
                            && child.CurrentQuantity <= child.MinQuantity.Value
                        )
                        || child.CurrentQuantity <= 0
                    );

                string? childLocPath = null;
                if (
                    child.HomeLocationId.HasValue
                    && allLocations.TryGetValue(child.HomeLocationId.Value, out var cLoc)
                )
                {
                    childLocPath = cLoc.Name;
                }

                childSummaries.Add(
                    new ItemChildSummaryDto(
                        child.Id,
                        child.ShortCode,
                        child.Name,
                        child.ItemType,
                        child.Status,
                        child.Condition,
                        child.CurrentQuantity,
                        child.Unit,
                        child.MinQuantity,
                        childLowStock,
                        childLocPath
                    )
                );

                if (item.ItemType == ItemType.Kit)
                {
                    if (child.Condition == ItemCondition.Broken)
                    {
                        warnings.Add($"{child.Name} ({child.ShortCode}) is marked Broken");
                    }
                    else if (child.Status != ItemStatus.InPlace)
                    {
                        warnings.Add(
                            $"{child.Name} ({child.ShortCode}) is currently {child.Status}"
                        );
                    }
                    else if (childLowStock)
                    {
                        warnings.Add(
                            $"{child.Name} ({child.ShortCode}) is low or out of stock ({child.CurrentQuantity} {child.Unit ?? "units"})"
                        );
                    }
                }
            }
        }

        var isIncompleteKit = item.ItemType == ItemType.Kit && warnings.Count > 0;

        var attributeValues = item
            .AttributeValues.Select(v => new ItemAttributeValueDto(
                v.Id,
                v.AttributeTemplateId,
                v.AttributeName,
                v.FieldType,
                v.Unit,
                v.Value
            ))
            .ToList();

        var primaryPhoto =
            item.Attachments.FirstOrDefault(a => a.IsPrimaryPhoto)?.Id
            ?? item.Attachments.FirstOrDefault(a =>
                a.AttachmentType == Core.Attachments.AttachmentType.Photo
            )?.Id;

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
            item.HomeLocation?.Name,
            item.HomeLocation?.ShortCode,
            homeLocationFullPath,
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
            attributeValues,
            childSummaries,
            item.LastTouchedAt,
            item.CreatedAt,
            item.ModifiedAt,
            item.Attachments.Count,
            primaryPhoto
        );
    }
}
