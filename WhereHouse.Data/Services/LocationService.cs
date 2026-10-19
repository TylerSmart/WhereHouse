using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.QrCodes;
using WhereHouse.Core.Storage;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class LocationService(
    WhereHouseDbContext dbContext,
    IFileStorageService fileStorageService
) : ILocationService
{
    public async Task<IReadOnlyList<LocationTreeNodeDto>> GetLocationTreeAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    )
    {
        var allNodesList = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);

        var allNodes = allNodesList.ToDictionary(n => n.Id);
        var accessibleNodes = allNodesList.Where(n => IsAccessible(n, userId, allNodes)).ToList();

        var nodesByParent = accessibleNodes.ToLookup(n => n.ParentId);

        List<LocationTreeNodeDto> BuildTree(Guid? parentId)
        {
            var children = nodesByParent[parentId];

            return children
                .OrderBy(c => c.NodeType)
                .ThenBy(c => c.Name, StringComparer.OrdinalIgnoreCase)
                .Select(c =>
                {
                    var (fullPath, _) = ResolvePathAndBreadcrumbs(c, allNodes);
                    return new LocationTreeNodeDto(
                        c.Id,
                        c.ParentId,
                        c.Name,
                        c.NodeType,
                        c.ShortCode,
                        c.Icon,
                        c.ContainerStyle,
                        c.PrimaryColor,
                        c.AccentColor,
                        c.ColorLabel,
                        c.IsPrivate,
                        c.OwnerId,
                        fullPath,
                        BuildTree(c.Id),
                        c.CoverAttachmentId?.ToString()
                    );
                })
                .ToList();
        }

        return BuildTree(null);
    }

    public async Task<IReadOnlyList<LocationNodeDto>> GetLocationNodesAsync(
        Guid userId,
        Guid? parentId = null,
        bool includeAllDepths = false,
        string? search = null,
        CancellationToken cancellationToken = default
    )
    {
        var allNodesList = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);

        var allNodes = allNodesList.ToDictionary(n => n.Id);

        if (parentId.HasValue)
        {
            if (!allNodes.TryGetValue(parentId.Value, out var parentNode))
            {
                throw new NotFoundException("Parent location not found.");
            }

            if (!IsAccessible(parentNode, userId, allNodes))
            {
                throw new ForbiddenException();
            }
        }

        var accessibleNodes = allNodesList.Where(n => IsAccessible(n, userId, allNodes)).ToList();

        var childCounts = accessibleNodes
            .Where(n => n.ParentId.HasValue)
            .GroupBy(n => n.ParentId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        var allItems = await dbContext
            .InventoryItems.AsNoTracking()
            .Select(i => new
            {
                i.Id,
                i.HomeLocationId,
                i.IsPrivate,
                i.OwnerId,
                i.Status,
            })
            .ToListAsync(cancellationToken);

        var accessibleLocationIds = new HashSet<Guid>(accessibleNodes.Select(n => n.Id));
        var itemCounts = allItems
            .Where(i =>
                i.HomeLocationId.HasValue
                && accessibleLocationIds.Contains(i.HomeLocationId.Value)
                && (!i.IsPrivate || i.OwnerId == userId)
                && i.Status != ItemStatus.Archived
            )
            .GroupBy(i => i.HomeLocationId!.Value)
            .ToDictionary(g => g.Key, g => g.Count());

        IEnumerable<LocationNode> filtered = accessibleNodes;

        if (parentId.HasValue)
        {
            if (includeAllDepths)
            {
                var subtreeIds = GetSubtreeIds(parentId.Value, accessibleNodes);
                filtered = filtered.Where(n => subtreeIds.Contains(n.Id));
            }
            else if (string.IsNullOrWhiteSpace(search))
            {
                filtered = filtered.Where(n => n.ParentId == parentId.Value);
            }
        }
        else if (!includeAllDepths && string.IsNullOrWhiteSpace(search))
        {
            filtered = filtered.Where(n => n.ParentId == null);
        }

        var resultList = new List<LocationNodeDto>();
        var searchTrimmed = search?.Trim();

        foreach (var node in filtered)
        {
            var (fullPath, breadcrumbs) = ResolvePathAndBreadcrumbs(node, allNodes);

            if (!string.IsNullOrWhiteSpace(searchTrimmed))
            {
                var matches =
                    node.Name.Contains(searchTrimmed, StringComparison.OrdinalIgnoreCase)
                    || node.ShortCode.Contains(searchTrimmed, StringComparison.OrdinalIgnoreCase)
                    || (
                        node.Description?.Contains(
                            searchTrimmed,
                            StringComparison.OrdinalIgnoreCase
                        ) ?? false
                    )
                    || (
                        node.ContainerStyle?.Contains(
                            searchTrimmed,
                            StringComparison.OrdinalIgnoreCase
                        ) ?? false
                    )
                    || (
                        node.ColorLabel?.Contains(searchTrimmed, StringComparison.OrdinalIgnoreCase)
                        ?? false
                    )
                    || fullPath.Contains(searchTrimmed, StringComparison.OrdinalIgnoreCase);

                if (!matches)
                {
                    continue;
                }
            }

            var count = childCounts.GetValueOrDefault(node.Id, 0);
            var itemsInside = itemCounts.GetValueOrDefault(node.Id, 0);
            resultList.Add(MapToDto(node, fullPath, breadcrumbs, count, itemsInside));
        }

        return resultList
            .OrderBy(r => r.NodeType)
            .ThenBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
    }

    public async Task<LocationNodeDto?> GetLocationNodeByIdAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        var allNodesList = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);

        var allNodes = allNodesList.ToDictionary(n => n.Id);

        if (!allNodes.TryGetValue(id, out var node))
        {
            return null;
        }

        if (!IsAccessible(node, userId, allNodes))
        {
            throw new ForbiddenException();
        }

        var (fullPath, breadcrumbs) = ResolvePathAndBreadcrumbs(node, allNodes);
        var childCount = allNodesList.Count(n =>
            n.ParentId == id && IsAccessible(n, userId, allNodes)
        );
        var itemCount = await dbContext.InventoryItems.CountAsync(
            i =>
                i.HomeLocationId == id
                && (!i.IsPrivate || i.OwnerId == userId)
                && i.Status != ItemStatus.Archived,
            cancellationToken
        );

        return MapToDto(node, fullPath, breadcrumbs, childCount, itemCount);
    }

    public async Task<LocationNodeDto> CreateLocationNodeAsync(
        Guid userId,
        CreateLocationNodeRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        if (string.IsNullOrWhiteSpace(request.Name))
        {
            throw new ArgumentException("Location name is required.", nameof(request));
        }

        var allNodesList = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var allNodes = allNodesList.ToDictionary(n => n.Id);

        if (request.ParentId.HasValue)
        {
            if (!allNodes.TryGetValue(request.ParentId.Value, out var parentNode))
            {
                throw new NotFoundException("Parent location not found.");
            }

            if (!IsAccessible(parentNode, userId, allNodes))
            {
                throw new ForbiddenException();
            }
        }

        string shortCode;
        if (!string.IsNullOrWhiteSpace(request.ShortCode))
        {
            shortCode = LocationShortCodeGenerator.NormalizeShortCode(request.ShortCode);
            var exists = allNodesList.Any(n =>
                string.Equals(n.ShortCode, shortCode, StringComparison.OrdinalIgnoreCase)
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
            shortCode = LocationShortCodeGenerator.GenerateNextShortCode(
                request.NodeType,
                allNodesList.Select(n => n.ShortCode)
            );
        }

        var icon = !string.IsNullOrWhiteSpace(request.Icon)
            ? request.Icon.Trim()
            : (
                request.NodeType == LocationNodeType.MovableContainer
                    ? "inventory_2"
                    : "location_on"
            );

        var node = new LocationNode
        {
            Id = Guid.NewGuid(),
            ParentId = request.ParentId,
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description)
                ? null
                : request.Description.Trim(),
            NodeType = request.NodeType,
            ShortCode = shortCode,
            Icon = icon,
            ContainerStyle = string.IsNullOrWhiteSpace(request.ContainerStyle)
                ? null
                : request.ContainerStyle.Trim(),
            PrimaryColor = string.IsNullOrWhiteSpace(request.PrimaryColor)
                ? null
                : request.PrimaryColor.Trim(),
            AccentColor = string.IsNullOrWhiteSpace(request.AccentColor)
                ? null
                : request.AccentColor.Trim(),
            ColorLabel = string.IsNullOrWhiteSpace(request.ColorLabel)
                ? null
                : request.ColorLabel.Trim(),
            IsPrivate = request.IsPrivate,
            OwnerId = userId,
        };

        dbContext.LocationNodes.Add(node);
        await dbContext.SaveChangesAsync(cancellationToken);

        allNodes[node.Id] = node;
        var (fullPath, breadcrumbs) = ResolvePathAndBreadcrumbs(node, allNodes);

        return MapToDto(node, fullPath, breadcrumbs, 0, 0);
    }

    public async Task<LocationNodeDto?> UpdateLocationNodeAsync(
        Guid userId,
        Guid id,
        UpdateLocationNodeRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var allNodesList = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var allNodes = allNodesList.ToDictionary(n => n.Id);

        if (!allNodes.TryGetValue(id, out var existingNode))
        {
            return null;
        }

        if (!IsAccessible(existingNode, userId, allNodes))
        {
            throw new ForbiddenException();
        }

        var trackedNode = await dbContext.LocationNodes.FirstOrDefaultAsync(
            n => n.Id == id,
            cancellationToken
        );
        if (trackedNode is null)
        {
            return null;
        }

        if (request.IsPrivate && trackedNode.OwnerId != userId)
        {
            trackedNode.OwnerId = userId;
        }

        trackedNode.Name = request.Name.Trim();
        trackedNode.NodeType = request.NodeType;
        trackedNode.Description = string.IsNullOrWhiteSpace(request.Description)
            ? null
            : request.Description.Trim();
        trackedNode.Icon = string.IsNullOrWhiteSpace(request.Icon)
            ? (
                request.NodeType == LocationNodeType.MovableContainer
                    ? "inventory_2"
                    : "location_on"
            )
            : request.Icon.Trim();
        trackedNode.ContainerStyle = string.IsNullOrWhiteSpace(request.ContainerStyle)
            ? null
            : request.ContainerStyle.Trim();
        trackedNode.PrimaryColor = string.IsNullOrWhiteSpace(request.PrimaryColor)
            ? null
            : request.PrimaryColor.Trim();
        trackedNode.AccentColor = string.IsNullOrWhiteSpace(request.AccentColor)
            ? null
            : request.AccentColor.Trim();
        trackedNode.ColorLabel = string.IsNullOrWhiteSpace(request.ColorLabel)
            ? null
            : request.ColorLabel.Trim();
        trackedNode.IsPrivate = request.IsPrivate;

        await dbContext.SaveChangesAsync(cancellationToken);

        allNodes[trackedNode.Id] = trackedNode;
        var (fullPath, breadcrumbs) = ResolvePathAndBreadcrumbs(trackedNode, allNodes);
        var childCount = allNodesList.Count(n =>
            n.ParentId == id && IsAccessible(n, userId, allNodes)
        );
        var itemCount = await dbContext.InventoryItems.CountAsync(
            i => i.HomeLocationId == id && (!i.IsPrivate || i.OwnerId == userId),
            cancellationToken
        );

        return MapToDto(trackedNode, fullPath, breadcrumbs, childCount, itemCount);
    }

    public async Task<LocationNodeDto?> MoveLocationNodeAsync(
        Guid userId,
        Guid id,
        MoveLocationNodeRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var allNodesList = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var allNodes = allNodesList.ToDictionary(n => n.Id);

        if (!allNodes.TryGetValue(id, out var nodeToMove))
        {
            return null;
        }

        if (!IsAccessible(nodeToMove, userId, allNodes))
        {
            throw new ForbiddenException();
        }

        if (request.NewParentId.HasValue)
        {
            if (request.NewParentId.Value == id)
            {
                throw new ConflictException(
                    "A location or container cannot be moved into itself.",
                    "Invalid move operation"
                );
            }

            if (!allNodes.TryGetValue(request.NewParentId.Value, out var targetParent))
            {
                throw new NotFoundException("Target parent location not found.");
            }

            if (!IsAccessible(targetParent, userId, allNodes))
            {
                throw new ForbiddenException();
            }

            var current = targetParent;
            while (current.ParentId.HasValue)
            {
                if (current.ParentId.Value == id)
                {
                    throw new ConflictException(
                        "A location or container cannot be moved into one of its own descendants.",
                        "Circular hierarchy detected"
                    );
                }

                if (!allNodes.TryGetValue(current.ParentId.Value, out var ancestor))
                {
                    break;
                }
                current = ancestor;
            }
        }

        var trackedNode = await dbContext.LocationNodes.FirstOrDefaultAsync(
            n => n.Id == id,
            cancellationToken
        );
        if (trackedNode is null)
        {
            return null;
        }

        trackedNode.ParentId = request.NewParentId;
        await dbContext.SaveChangesAsync(cancellationToken);

        allNodes[trackedNode.Id] = trackedNode;
        var (fullPath, breadcrumbs) = ResolvePathAndBreadcrumbs(trackedNode, allNodes);
        var childCount = allNodesList.Count(n =>
            n.ParentId == id && IsAccessible(n, userId, allNodes)
        );
        var itemCount = await dbContext.InventoryItems.CountAsync(
            i => i.HomeLocationId == id && (!i.IsPrivate || i.OwnerId == userId),
            cancellationToken
        );

        return MapToDto(trackedNode, fullPath, breadcrumbs, childCount, itemCount);
    }

    public async Task<bool> DeleteLocationNodeAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        var allNodesList = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var allNodes = allNodesList.ToDictionary(n => n.Id);

        if (!allNodes.TryGetValue(id, out var nodeToDelete))
        {
            return false;
        }

        if (!IsAccessible(nodeToDelete, userId, allNodes))
        {
            throw new ForbiddenException();
        }

        var hasChildren = allNodesList.Any(n => n.ParentId == id);
        if (hasChildren)
        {
            throw new ConflictException(
                "Cannot delete a location or container that still contains nested locations or containers. Move or delete its contents first.",
                "Location not empty"
            );
        }

        var hasItems = await dbContext.InventoryItems.AnyAsync(
            i => i.HomeLocationId == id,
            cancellationToken
        );
        if (hasItems)
        {
            throw new ConflictException(
                "Cannot delete a location or container that still contains cataloged items. Move or delete its items first.",
                "Location contains items"
            );
        }

        var tracked = await dbContext.LocationNodes.FirstOrDefaultAsync(
            n => n.Id == id,
            cancellationToken
        );
        if (tracked is null)
        {
            return false;
        }

        var boundQrCodes = await dbContext
            .QrCodes.Where(q => q.LocationNodeId == id)
            .ToListAsync(cancellationToken);
        foreach (var qr in boundQrCodes)
        {
            qr.TargetType = QrTargetType.Unassigned;
            qr.LocationNodeId = null;
            qr.BoundAt = null;
            qr.BoundByUserId = null;
        }

        dbContext.LocationNodes.Remove(tracked);
        await dbContext.SaveChangesAsync(cancellationToken);

        return true;
    }

    private static bool IsAccessible(
        LocationNode node,
        Guid userId,
        IReadOnlyDictionary<Guid, LocationNode> allNodes
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

            allNodes.TryGetValue(current.ParentId.Value, out current!);
        }

        return true;
    }

    private static (
        string FullPath,
        IReadOnlyList<LocationBreadcrumbDto> Breadcrumbs
    ) ResolvePathAndBreadcrumbs(LocationNode node, IReadOnlyDictionary<Guid, LocationNode> allNodes)
    {
        var breadcrumbs = new List<LocationBreadcrumbDto>();
        var current = node;

        while (current is not null)
        {
            breadcrumbs.Insert(
                0,
                new LocationBreadcrumbDto(
                    current.Id,
                    current.Name,
                    current.ShortCode,
                    current.NodeType
                )
            );

            if (!current.ParentId.HasValue)
            {
                break;
            }

            allNodes.TryGetValue(current.ParentId.Value, out current!);
        }

        var fullPath = string.Join(" > ", breadcrumbs.Select(b => b.Name));
        return (fullPath, breadcrumbs);
    }

    private static HashSet<Guid> GetSubtreeIds(
        Guid rootId,
        IEnumerable<LocationNode> accessibleNodes
    )
    {
        var childrenLookup = accessibleNodes
            .Where(n => n.ParentId.HasValue)
            .GroupBy(n => n.ParentId!.Value)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Id).ToList());

        var result = new HashSet<Guid>();
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

    public async Task<LocationNodeDto?> UploadCoverPhotoAsync(
        Guid userId,
        Guid locationId,
        Stream fileStream,
        string fileName,
        string contentType,
        long fileSizeBytes,
        CancellationToken cancellationToken = default
    )
    {
        var node = await dbContext.LocationNodes.FirstOrDefaultAsync(
            l => l.Id == locationId,
            cancellationToken
        );
        if (node is null)
        {
            return null;
        }

        var allNodes = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(n => n.Id, cancellationToken);
        if (!IsAccessible(node, userId, allNodes))
        {
            throw new ForbiddenException();
        }

        if (!string.IsNullOrWhiteSpace(node.CoverPhotoRelativePath))
        {
            try
            {
                await fileStorageService.DeleteFileAsync(
                    node.CoverPhotoRelativePath,
                    cancellationToken
                );
            }
            catch
            {
                // Ignore cleanup error of previous file
            }
        }

        var stored = await fileStorageService.SaveFileAsync(
            fileStream,
            fileName,
            cancellationToken
        );

        node.CoverAttachmentId = Guid.NewGuid();
        node.CoverPhotoRelativePath = stored.StorageRelativePath;
        node.CoverPhotoContentType = string.IsNullOrWhiteSpace(contentType)
            ? "image/jpeg"
            : contentType;
        node.ModifiedAt = DateTimeOffset.UtcNow;
        node.ModifiedBy = userId.ToString();

        await dbContext.SaveChangesAsync(cancellationToken);

        var (fullPath, breadcrumbs) = ResolvePathAndBreadcrumbs(node, allNodes);
        var childCount = allNodes.Values.Count(c => c.ParentId == node.Id);
        var itemCount = await dbContext.InventoryItems.CountAsync(
            i => i.HomeLocationId == node.Id,
            cancellationToken
        );

        return MapToDto(node, fullPath, breadcrumbs, childCount, itemCount);
    }

    public async Task<(Stream Content, string ContentType, string FileName)?> GetCoverPhotoAsync(
        Guid userId,
        Guid locationId,
        CancellationToken cancellationToken = default
    )
    {
        var node = await dbContext
            .LocationNodes.AsNoTracking()
            .FirstOrDefaultAsync(l => l.Id == locationId, cancellationToken);
        if (node is null || string.IsNullOrWhiteSpace(node.CoverPhotoRelativePath))
        {
            return null;
        }

        var allNodes = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(n => n.Id, cancellationToken);
        if (!IsAccessible(node, userId, allNodes))
        {
            throw new ForbiddenException();
        }

        var stream = await fileStorageService.OpenReadAsync(
            node.CoverPhotoRelativePath,
            cancellationToken
        );
        if (stream is null)
        {
            return null;
        }

        var contentType = node.CoverPhotoContentType ?? "image/jpeg";
        var fileName = Path.GetFileName(node.CoverPhotoRelativePath);
        return (stream, contentType, fileName);
    }

    public async Task<LocationNodeDto?> DeleteCoverPhotoAsync(
        Guid userId,
        Guid locationId,
        CancellationToken cancellationToken = default
    )
    {
        var node = await dbContext.LocationNodes.FirstOrDefaultAsync(
            l => l.Id == locationId,
            cancellationToken
        );
        if (node is null)
        {
            return null;
        }

        var allNodes = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(n => n.Id, cancellationToken);
        if (!IsAccessible(node, userId, allNodes))
        {
            throw new ForbiddenException();
        }

        if (!string.IsNullOrWhiteSpace(node.CoverPhotoRelativePath))
        {
            try
            {
                await fileStorageService.DeleteFileAsync(
                    node.CoverPhotoRelativePath,
                    cancellationToken
                );
            }
            catch
            {
                // Ignore cleanup error
            }
        }

        node.CoverAttachmentId = null;
        node.CoverPhotoRelativePath = null;
        node.CoverPhotoContentType = null;
        node.ModifiedAt = DateTimeOffset.UtcNow;
        node.ModifiedBy = userId.ToString();

        await dbContext.SaveChangesAsync(cancellationToken);

        var (fullPath, breadcrumbs) = ResolvePathAndBreadcrumbs(node, allNodes);
        var childCount = allNodes.Values.Count(c => c.ParentId == node.Id);
        var itemCount = await dbContext.InventoryItems.CountAsync(
            i => i.HomeLocationId == node.Id,
            cancellationToken
        );

        return MapToDto(node, fullPath, breadcrumbs, childCount, itemCount);
    }

    private static LocationNodeDto MapToDto(
        LocationNode node,
        string fullPath,
        IReadOnlyList<LocationBreadcrumbDto> breadcrumbs,
        int childCount,
        int itemCount
    ) =>
        new(
            node.Id,
            node.ParentId,
            node.Name,
            node.Description,
            node.NodeType,
            node.ShortCode,
            node.Icon,
            node.ContainerStyle,
            node.PrimaryColor,
            node.AccentColor,
            node.ColorLabel,
            node.IsPrivate,
            node.OwnerId,
            fullPath,
            breadcrumbs,
            childCount,
            itemCount,
            node.CreatedAt,
            node.ModifiedAt,
            node.CoverAttachmentId?.ToString()
        );
}
