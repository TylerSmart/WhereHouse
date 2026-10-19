using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.QrCodes;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class ScanService(
    WhereHouseDbContext dbContext,
    ILocationService locationService,
    IItemService itemService
) : IScanService
{
    public async Task<ScanResolutionDto> ResolveScanAsync(
        Guid userId,
        string rawCodeOrUrl,
        CancellationToken cancellationToken = default
    )
    {
        var code = QrCodeTokenHelper.ExtractCodeFromScanInput(rawCodeOrUrl);

        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToDictionaryAsync(l => l.Id, cancellationToken);

        var qr = await dbContext
            .QrCodes.Include(q => q.LocationNode)
            .Include(q => q.Item)
            .FirstOrDefaultAsync(q => q.Token == code, cancellationToken);

        QrCodeDto? qrDto = null;
        Guid? targetLocationId = null;
        Guid? targetItemId = null;

        if (qr is not null)
        {
            qr.LastScannedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);
            qrDto = MapToDto(qr, allLocations);

            if (qr.TargetType == QrTargetType.Unassigned)
            {
                return new ScanResolutionDto(
                    code,
                    ScanResolutionType.UnassignedQr,
                    "Unassigned QR code scanned. Bind this sticker to a container, location, or item.",
                    QrCode: qrDto
                );
            }

            if (qr.TargetType == QrTargetType.LocationNode && qr.LocationNodeId.HasValue)
            {
                targetLocationId = qr.LocationNodeId.Value;
            }
            else if (qr.TargetType == QrTargetType.Item && qr.ItemId.HasValue)
            {
                targetItemId = qr.ItemId.Value;
            }
        }

        // Step 2: Check LocationNodes (by bound ID or ShortCode)
        LocationNode? location = null;
        if (targetLocationId.HasValue)
        {
            allLocations.TryGetValue(targetLocationId.Value, out location);
        }
        else
        {
            location = allLocations.Values.FirstOrDefault(l =>
                string.Equals(l.ShortCode, code, StringComparison.OrdinalIgnoreCase)
            );
        }

        if (location is not null)
        {
            if (!IsLocationAccessible(location, userId, allLocations))
            {
                return new ScanResolutionDto(
                    code,
                    ScanResolutionType.PrivateRestricted,
                    "Restricted: This location or container is marked Private by its owner."
                );
            }

            var locDto = await locationService.GetLocationNodeByIdAsync(
                userId,
                location.Id,
                cancellationToken
            );

            var childLocations = new List<LocationNodeDto>();
            var childIds = allLocations
                .Values.Where(l =>
                    l.ParentId == location.Id && IsLocationAccessible(l, userId, allLocations)
                )
                .Select(l => l.Id)
                .ToList();

            foreach (var childId in childIds)
            {
                var childDto = await locationService.GetLocationNodeByIdAsync(
                    userId,
                    childId,
                    cancellationToken
                );
                if (childDto is not null)
                {
                    childLocations.Add(childDto);
                }
            }

            var locationItems = await itemService.GetItemsAsync(
                userId,
                locationId: location.Id,
                includeSubtreeLocations: false,
                cancellationToken: cancellationToken
            );

            return new ScanResolutionDto(
                code,
                ScanResolutionType.LocationNode,
                $"Loaded X-Ray view for {locDto!.Name} ({locDto.ShortCode}).",
                QrCode: qrDto,
                Location: locDto,
                ChildLocations: childLocations,
                LocationItems: locationItems,
                Item: null
            );
        }

        // Step 3: Check InventoryItems (by bound ID or ShortCode)
        InventoryItem? item = null;
        if (targetItemId.HasValue)
        {
            item = await dbContext.InventoryItems.FirstOrDefaultAsync(
                i => i.Id == targetItemId.Value,
                cancellationToken
            );
        }
        else
        {
            item = await dbContext.InventoryItems.FirstOrDefaultAsync(
                i => i.ShortCode == code,
                cancellationToken
            );
        }

        if (item is not null)
        {
            if (!IsItemAccessible(item, userId, allLocations))
            {
                return new ScanResolutionDto(
                    code,
                    ScanResolutionType.PrivateRestricted,
                    "Restricted: This item is marked Private by its owner."
                );
            }

            ItemDto? itemDto = null;
            try
            {
                itemDto = await itemService.GetItemByIdAsync(userId, item.Id, cancellationToken);
            }
            catch (ForbiddenException)
            {
                return new ScanResolutionDto(
                    code,
                    ScanResolutionType.PrivateRestricted,
                    "Restricted: This item is marked Private by its owner."
                );
            }

            if (itemDto is null)
            {
                return new ScanResolutionDto(
                    code,
                    ScanResolutionType.PrivateRestricted,
                    "Restricted: This item is marked Private by its owner."
                );
            }

            LocationNodeDto? homeLocDto = null;
            if (itemDto.HomeLocationId.HasValue)
            {
                homeLocDto = await locationService.GetLocationNodeByIdAsync(
                    userId,
                    itemDto.HomeLocationId.Value,
                    cancellationToken
                );
            }

            item.LastTouchedAt = DateTimeOffset.UtcNow;
            await dbContext.SaveChangesAsync(cancellationToken);

            return new ScanResolutionDto(
                code,
                ScanResolutionType.Item,
                $"Loaded item {itemDto.Name} ({itemDto.ShortCode}).",
                QrCode: qrDto,
                Location: homeLocDto,
                ChildLocations: null,
                LocationItems: null,
                Item: itemDto
            );
        }

        // Step 4: Auto-Recognize QR-xxxx as unassigned blank sticker
        if (code.StartsWith("QR-", StringComparison.OrdinalIgnoreCase))
        {
            var newQr = new QrCode
            {
                Token = code,
                TargetType = QrTargetType.Unassigned,
                CreatedByUserId = userId,
                LastScannedAt = DateTimeOffset.UtcNow,
            };
            dbContext.QrCodes.Add(newQr);
            await dbContext.SaveChangesAsync(cancellationToken);

            var newQrDto = MapToDto(newQr, allLocations);
            return new ScanResolutionDto(
                code,
                ScanResolutionType.UnassignedQr,
                "Unassigned QR code scanned. Bind this sticker to a container, location, or item.",
                QrCode: newQrDto
            );
        }

        // Step 5: Not found
        return new ScanResolutionDto(
            code,
            ScanResolutionType.NotFound,
            $"No location, container, item, or QR sticker matched '{code}'."
        );
    }

    public async Task<BulkScanAuditResponseDto> ExecuteBulkMoveAuditAsync(
        Guid userId,
        BulkScanAuditRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        var destLocation = await locationService.GetLocationNodeByIdAsync(
            userId,
            request.DestinationLocationId,
            cancellationToken
        );

        if (destLocation is null)
        {
            throw new NotFoundException(
                $"Destination location '{request.DestinationLocationId}' not found."
            );
        }

        var allLocationsList = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var allLocations = allLocationsList.ToDictionary(l => l.Id);

        var movedCount = 0;
        var auditedPresentCount = 0;
        var errorOrSkippedCount = 0;
        var results = new List<BulkScanAuditItemResultDto>();

        foreach (var rawCode in request.ScannedCodes)
        {
            if (string.IsNullOrWhiteSpace(rawCode))
            {
                continue;
            }

            var code = QrCodeTokenHelper.ExtractCodeFromScanInput(rawCode);

            var qr = await dbContext.QrCodes.FirstOrDefaultAsync(
                q => q.Token == code,
                cancellationToken
            );

            Guid? targetLocId = null;
            Guid? targetItemId = null;
            var isUnassignedQr = false;

            if (qr is not null)
            {
                qr.LastScannedAt = DateTimeOffset.UtcNow;
                if (qr.TargetType == QrTargetType.LocationNode)
                {
                    targetLocId = qr.LocationNodeId;
                }
                else if (qr.TargetType == QrTargetType.Item)
                {
                    targetItemId = qr.ItemId;
                }
                else if (qr.TargetType == QrTargetType.Unassigned)
                {
                    isUnassignedQr = true;
                }
            }

            if (isUnassignedQr)
            {
                errorOrSkippedCount++;
                results.Add(
                    new BulkScanAuditItemResultDto(
                        code,
                        BulkAuditOutcomeType.UnassignedQr,
                        "QR code is unassigned."
                    )
                );
                continue;
            }

            LocationNode? loc = null;
            if (targetLocId.HasValue)
            {
                allLocations.TryGetValue(targetLocId.Value, out loc);
            }
            else
            {
                loc = allLocations.Values.FirstOrDefault(l =>
                    string.Equals(l.ShortCode, code, StringComparison.OrdinalIgnoreCase)
                );
            }

            if (loc is not null)
            {
                if (!IsLocationAccessible(loc, userId, allLocations))
                {
                    errorOrSkippedCount++;
                    results.Add(
                        new BulkScanAuditItemResultDto(
                            code,
                            BulkAuditOutcomeType.SkippedPrivate,
                            "Skipped: Private location.",
                            loc.Id,
                            loc.Name,
                            loc.ShortCode
                        )
                    );
                    continue;
                }

                if (loc.Id == request.DestinationLocationId)
                {
                    auditedPresentCount++;
                    results.Add(
                        new BulkScanAuditItemResultDto(
                            code,
                            BulkAuditOutcomeType.AuditedPresent,
                            "Destination location verified.",
                            loc.Id,
                            loc.Name,
                            loc.ShortCode
                        )
                    );
                    continue;
                }

                if (loc.ParentId == request.DestinationLocationId)
                {
                    auditedPresentCount++;
                    results.Add(
                        new BulkScanAuditItemResultDto(
                            code,
                            BulkAuditOutcomeType.AuditedPresent,
                            $"Container '{loc.Name}' confirmed in {destLocation.Name}.",
                            loc.Id,
                            loc.Name,
                            loc.ShortCode
                        )
                    );
                    continue;
                }

                try
                {
                    await locationService.MoveLocationNodeAsync(
                        userId,
                        loc.Id,
                        new MoveLocationNodeRequest(request.DestinationLocationId),
                        cancellationToken
                    );

                    loc.ParentId = request.DestinationLocationId;
                    movedCount++;
                    results.Add(
                        new BulkScanAuditItemResultDto(
                            code,
                            BulkAuditOutcomeType.MovedContainer,
                            $"Moved container '{loc.Name}' into {destLocation.Name}.",
                            loc.Id,
                            loc.Name,
                            loc.ShortCode
                        )
                    );
                }
                catch (ConflictException)
                {
                    errorOrSkippedCount++;
                    results.Add(
                        new BulkScanAuditItemResultDto(
                            code,
                            BulkAuditOutcomeType.SkippedInvalidCycle,
                            "Skipped: Moving this container would create a circular hierarchy loop.",
                            loc.Id,
                            loc.Name,
                            loc.ShortCode
                        )
                    );
                }

                continue;
            }

            InventoryItem? item = null;
            if (targetItemId.HasValue)
            {
                item = await dbContext.InventoryItems.FirstOrDefaultAsync(
                    i => i.Id == targetItemId.Value,
                    cancellationToken
                );
            }
            else
            {
                item = await dbContext.InventoryItems.FirstOrDefaultAsync(
                    i => i.ShortCode == code,
                    cancellationToken
                );
            }

            if (item is not null)
            {
                if (!IsItemAccessible(item, userId, allLocations))
                {
                    errorOrSkippedCount++;
                    results.Add(
                        new BulkScanAuditItemResultDto(
                            code,
                            BulkAuditOutcomeType.SkippedPrivate,
                            "Skipped: Private item.",
                            item.Id,
                            item.Name,
                            item.ShortCode
                        )
                    );
                    continue;
                }

                if (item.HomeLocationId == request.DestinationLocationId)
                {
                    item.LastTouchedAt = DateTimeOffset.UtcNow;
                    auditedPresentCount++;
                    results.Add(
                        new BulkScanAuditItemResultDto(
                            code,
                            BulkAuditOutcomeType.AuditedPresent,
                            $"Item '{item.Name}' confirmed present in {destLocation.Name}.",
                            item.Id,
                            item.Name,
                            item.ShortCode
                        )
                    );
                }
                else
                {
                    item.HomeLocationId = request.DestinationLocationId;
                    item.LastTouchedAt = DateTimeOffset.UtcNow;
                    movedCount++;
                    results.Add(
                        new BulkScanAuditItemResultDto(
                            code,
                            BulkAuditOutcomeType.MovedItem,
                            $"Moved item '{item.Name}' to {destLocation.Name}.",
                            item.Id,
                            item.Name,
                            item.ShortCode
                        )
                    );
                }

                continue;
            }

            errorOrSkippedCount++;
            results.Add(
                new BulkScanAuditItemResultDto(
                    code,
                    BulkAuditOutcomeType.NotFound,
                    $"No entity matched '{code}'."
                )
            );
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return new BulkScanAuditResponseDto(
            destLocation.Id,
            destLocation.Name,
            destLocation.ShortCode,
            destLocation.FullPath,
            DateTimeOffset.UtcNow,
            movedCount,
            auditedPresentCount,
            errorOrSkippedCount,
            results
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
        IReadOnlyDictionary<Guid, LocationNode> allLocations
    )
    {
        string? locName = null;
        string? locShortCode = null;
        string? locFullPath = null;

        if (
            qr.LocationNodeId.HasValue
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
