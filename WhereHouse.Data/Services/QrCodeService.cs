using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.QrCodes;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class QrCodeService(WhereHouseDbContext dbContext) : IQrCodeService
{
    public async Task<IReadOnlyList<QrCodeDto>> GetQrCodesAsync(
        Guid userId,
        QrTargetType? targetType = null,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var query = dbContext
            .QrCodes.AsNoTracking()
            .Include(q => q.LocationNode)
            .Include(q => q.Item)
            .AsQueryable();

        if (targetType.HasValue)
        {
            query = query.Where(q => q.TargetType == targetType.Value);
        }

        var list = await query
            .OrderByDescending(q => q.CreatedAt)
            .ThenBy(q => q.Token)
            .ToListAsync(cancellationToken);

        return list.Where(q =>
            {
                if (q.TargetType == QrTargetType.LocationNode && q.LocationNodeId.HasValue)
                {
                    if (
                        allLocations.TryGetValue(q.LocationNodeId.Value, out var loc)
                        && !IsLocationAccessible(loc, userId, allLocations)
                    )
                    {
                        return false;
                    }
                }

                if (q.TargetType == QrTargetType.Item && q.Item is not null)
                {
                    if (!IsItemAccessible(q.Item, userId, allLocations))
                    {
                        return false;
                    }
                }

                return true;
            })
            .Select(q => MapToDto(q, allLocations))
            .ToList();
    }

    public async Task<IReadOnlyList<QrCodeDto>> GenerateBatchAsync(
        Guid userId,
        GenerateQrCodeBatchRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        if (request.Count < 1 || request.Count > 200)
        {
            throw new ArgumentOutOfRangeException(
                nameof(request),
                "Count must be between 1 and 200."
            );
        }

        var existingTokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var qrTokens = await dbContext.QrCodes.Select(q => q.Token).ToListAsync(cancellationToken);
        foreach (var t in qrTokens)
        {
            existingTokens.Add(t);
        }

        var locCodes = await dbContext
            .LocationNodes.Select(l => l.ShortCode)
            .ToListAsync(cancellationToken);
        foreach (var c in locCodes)
        {
            existingTokens.Add(c);
        }

        var itemCodes = await dbContext
            .InventoryItems.Select(i => i.ShortCode)
            .ToListAsync(cancellationToken);
        foreach (var c in itemCodes)
        {
            existingTokens.Add(c);
        }

        var created = new List<QrCode>();
        var prefix = string.IsNullOrWhiteSpace(request.Prefix)
            ? QrCodeTokenHelper.DefaultPrefix
            : request.Prefix.Trim();
        var labelNote = string.IsNullOrWhiteSpace(request.LabelNote)
            ? null
            : request.LabelNote.Trim();

        for (var i = 0; i < request.Count; i++)
        {
            var token = QrCodeTokenHelper.GenerateNextBlankToken(existingTokens, prefix);
            existingTokens.Add(token);

            var entity = new QrCode
            {
                Token = token,
                TargetType = QrTargetType.Unassigned,
                LabelNote = labelNote,
                PrintedCount = 1,
                CreatedByUserId = userId,
            };

            created.Add(entity);
        }

        dbContext.QrCodes.AddRange(created);
        await dbContext.SaveChangesAsync(cancellationToken);

        return created
            .OrderBy(q => q.Token, StringComparer.OrdinalIgnoreCase)
            .Select(q => MapToDto(q, null))
            .ToList();
    }

    public async Task<QrCodeDto> BindQrCodeAsync(
        Guid userId,
        string tokenOrInput,
        BindQrCodeRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var token = QrCodeTokenHelper.ExtractCodeFromScanInput(tokenOrInput);

        if (request.TargetType == QrTargetType.Unassigned)
        {
            throw new ArgumentException(
                "TargetType cannot be Unassigned when binding a QR code.",
                nameof(request)
            );
        }

        var collidesLocation = await dbContext.LocationNodes.AnyAsync(
            l => l.ShortCode == token,
            cancellationToken
        );
        var collidesItem = await dbContext.InventoryItems.AnyAsync(
            i => i.ShortCode == token,
            cancellationToken
        );
        if (collidesLocation || collidesItem)
        {
            throw new ConflictException("Cannot bind a canonical short code as a blank QR token.");
        }

        var qr = await dbContext
            .QrCodes.Include(q => q.LocationNode)
            .Include(q => q.Item)
            .FirstOrDefaultAsync(q => q.Token == token, cancellationToken);

        if (qr is null)
        {
            qr = new QrCode
            {
                Token = token,
                CreatedByUserId = userId,
                TargetType = QrTargetType.Unassigned,
            };
            dbContext.QrCodes.Add(qr);
        }
        else if (qr.TargetType != QrTargetType.Unassigned)
        {
            throw new ConflictException(
                "This QR code is already bound. Unbind it first before reassigning."
            );
        }

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        if (request.TargetType == QrTargetType.LocationNode)
        {
            if (!allLocations.TryGetValue(request.TargetId, out var targetLoc))
            {
                throw new NotFoundException($"Location with ID '{request.TargetId}' not found.");
            }

            if (!IsLocationAccessible(targetLoc, userId, allLocations))
            {
                throw new ForbiddenException();
            }

            qr.TargetType = QrTargetType.LocationNode;
            qr.LocationNodeId = targetLoc.Id;
            qr.LocationNode = null;
            qr.ItemId = null;
            qr.Item = null;
            qr.BoundAt = DateTimeOffset.UtcNow;
            qr.BoundByUserId = userId;
        }
        else if (request.TargetType == QrTargetType.Item)
        {
            var targetItem = await dbContext.InventoryItems.FirstOrDefaultAsync(
                i => i.Id == request.TargetId,
                cancellationToken
            );

            if (targetItem is null)
            {
                throw new NotFoundException($"Item with ID '{request.TargetId}' not found.");
            }

            if (!IsItemAccessible(targetItem, userId, allLocations))
            {
                throw new ForbiddenException();
            }

            qr.TargetType = QrTargetType.Item;
            qr.ItemId = targetItem.Id;
            qr.Item = null;
            qr.LocationNodeId = null;
            qr.LocationNode = null;
            qr.BoundAt = DateTimeOffset.UtcNow;
            qr.BoundByUserId = userId;
        }

        if (request.LabelNote is not null)
        {
            qr.LabelNote = string.IsNullOrWhiteSpace(request.LabelNote)
                ? null
                : request.LabelNote.Trim();
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        var refreshed = await dbContext
            .QrCodes.AsNoTracking()
            .Include(q => q.LocationNode)
            .Include(q => q.Item)
            .FirstOrDefaultAsync(q => q.Id == qr.Id, cancellationToken);

        return MapToDto(refreshed ?? qr, allLocations);
    }

    public async Task<QrCodeDto> UnbindQrCodeAsync(
        Guid userId,
        string tokenOrInput,
        CancellationToken cancellationToken = default
    )
    {
        var token = QrCodeTokenHelper.ExtractCodeFromScanInput(tokenOrInput);

        var qr = await dbContext
            .QrCodes.Include(q => q.LocationNode)
            .Include(q => q.Item)
            .FirstOrDefaultAsync(q => q.Token == token, cancellationToken);

        if (qr is null)
        {
            throw new NotFoundException($"QR code with token '{token}' not found.");
        }

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        if (
            qr.TargetType == QrTargetType.LocationNode
            && qr.LocationNodeId.HasValue
            && allLocations.TryGetValue(qr.LocationNodeId.Value, out var loc)
        )
        {
            if (!IsLocationAccessible(loc, userId, allLocations))
            {
                throw new ForbiddenException();
            }
        }
        else if (qr.TargetType == QrTargetType.Item && qr.Item is not null)
        {
            if (!IsItemAccessible(qr.Item, userId, allLocations))
            {
                throw new ForbiddenException();
            }
        }

        qr.TargetType = QrTargetType.Unassigned;
        qr.LocationNodeId = null;
        qr.LocationNode = null;
        qr.ItemId = null;
        qr.Item = null;
        qr.BoundAt = null;
        qr.BoundByUserId = null;

        await dbContext.SaveChangesAsync(cancellationToken);

        return MapToDto(qr, allLocations);
    }

    public async Task<bool> DeleteQrCodeAsync(
        Guid userId,
        Guid id,
        CancellationToken cancellationToken = default
    )
    {
        var qr = await dbContext
            .QrCodes.Include(q => q.LocationNode)
            .Include(q => q.Item)
            .FirstOrDefaultAsync(q => q.Id == id, cancellationToken);

        if (qr is null)
        {
            return false;
        }

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        if (
            qr.TargetType == QrTargetType.LocationNode
            && qr.LocationNodeId.HasValue
            && allLocations.TryGetValue(qr.LocationNodeId.Value, out var loc)
        )
        {
            if (!IsLocationAccessible(loc, userId, allLocations))
            {
                throw new ForbiddenException();
            }
        }
        else if (qr.TargetType == QrTargetType.Item && qr.Item is not null)
        {
            if (!IsItemAccessible(qr.Item, userId, allLocations))
            {
                throw new ForbiddenException();
            }
        }

        dbContext.QrCodes.Remove(qr);
        await dbContext.SaveChangesAsync(cancellationToken);

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

    private static string ResolveFullPath(
        LocationNode node,
        IReadOnlyDictionary<Guid, LocationNode> allLocations
    )
    {
        var names = new List<string>();
        var current = node;
        while (current is not null)
        {
            names.Insert(0, current.Name);
            if (
                !current.ParentId.HasValue
                || !allLocations.TryGetValue(current.ParentId.Value, out var parent)
            )
            {
                break;
            }
            current = parent;
        }

        return string.Join(" / ", names);
    }

    private static QrCodeDto MapToDto(
        QrCode qr,
        IReadOnlyDictionary<Guid, LocationNode>? allLocations
    )
    {
        string? locName = null;
        string? locShortCode = null;
        string? locFullPath = null;

        if (
            qr.LocationNodeId.HasValue
            && allLocations is not null
            && allLocations.TryGetValue(qr.LocationNodeId.Value, out var loc)
        )
        {
            locName = loc.Name;
            locShortCode = loc.ShortCode;
            locFullPath = ResolveFullPath(loc, allLocations);
        }
        else if (qr.LocationNode is not null)
        {
            locName = qr.LocationNode.Name;
            locShortCode = qr.LocationNode.ShortCode;
        }

        var itemName = qr.Item?.Name;
        var itemShortCode = qr.Item?.ShortCode;

        return new QrCodeDto(
            qr.Id,
            qr.Token,
            qr.TargetType,
            qr.LocationNodeId,
            locName,
            locShortCode,
            locFullPath,
            qr.ItemId,
            itemName,
            itemShortCode,
            qr.LabelNote,
            qr.PrintedCount,
            qr.BoundAt,
            qr.LastScannedAt,
            qr.CreatedByUserId,
            qr.CreatedAt,
            qr.ModifiedAt
        );
    }
}
