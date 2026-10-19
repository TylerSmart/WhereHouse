using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Attachments;
using WhereHouse.Core.Exceptions;
using WhereHouse.Core.Insurance;
using WhereHouse.Core.Items;
using WhereHouse.Core.Storage;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class InsuranceExportService(
    WhereHouseDbContext dbContext,
    IFileStorageService fileStorageService
) : IInsuranceExportService
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public async Task<InsuranceClaimPreviewDto> GetClaimPreviewAsync(
        Guid userId,
        InsuranceClaimFilterQuery query,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var locationMap = allLocations.ToDictionary(l => l.Id);
        var accessibleLocationIds = ComputeAccessibleLocationIds(allLocations, userId);

        LocationNode? targetLocation = null;
        HashSet<Guid>? subtreeIds = null;

        if (query.LocationId.HasValue)
        {
            if (!locationMap.TryGetValue(query.LocationId.Value, out targetLocation))
            {
                throw new ArgumentException("Selected location does not exist.");
            }

            if (!accessibleLocationIds.Contains(query.LocationId.Value))
            {
                throw new ForbiddenException(
                    "You do not have permission to export this private location."
                );
            }

            subtreeIds = query.IncludeSubtree
                ? ComputeSubtreeLocationIds(allLocations, query.LocationId.Value)
                : [query.LocationId.Value];
            subtreeIds.IntersectWith(accessibleLocationIds);
        }

        var scopeDescription =
            targetLocation != null
                ? $"Location: {BuildFullPath(targetLocation, locationMap)}{(query.IncludeSubtree ? " (including sub-locations)" : "")}"
                : "All Accessible Locations";

        if (query.CategoryId.HasValue)
        {
            var cat = await dbContext
                .Categories.AsNoTracking()
                .SingleOrDefaultAsync(c => c.Id == query.CategoryId.Value, cancellationToken);
            if (cat != null)
            {
                scopeDescription += $" | Category: {cat.Name}";
            }
        }

        if (query.MinValue.HasValue)
        {
            scopeDescription += $" | Min Value: ${query.MinValue.Value:N2}";
        }

        var itemsQuery = dbContext
            .InventoryItems.AsNoTracking()
            .Include(i => i.Category)
            .Include(i => i.Attachments)
            .AsQueryable();

        var allCandidateItems = await itemsQuery.ToListAsync(cancellationToken);

        var filteredItems = allCandidateItems.Where(i =>
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

            if (!query.IncludeArchived && i.Status == ItemStatus.Archived)
            {
                return false;
            }

            if (
                subtreeIds != null
                && (!i.HomeLocationId.HasValue || !subtreeIds.Contains(i.HomeLocationId.Value))
            )
            {
                return false;
            }

            if (query.CategoryId.HasValue && i.CategoryId != query.CategoryId.Value)
            {
                return false;
            }

            return true;
        });

        var claimItems = new List<InsuranceClaimItemDto>();

        foreach (var item in filteredItems)
        {
            var unitValue = item.EstimatedReplacementValue ?? item.PurchasePrice ?? 0m;
            var multiplier =
                item.ItemType == ItemType.Quantity ? Math.Max(0m, item.CurrentQuantity) : 1m;
            var effectiveClaimValue = Math.Round(unitValue * multiplier, 2);

            if (query.MinValue.HasValue && effectiveClaimValue < query.MinValue.Value)
            {
                continue;
            }

            var locationFullPath =
                item.HomeLocationId.HasValue
                && locationMap.TryGetValue(item.HomeLocationId.Value, out var itemLoc)
                    ? BuildFullPath(itemLoc, locationMap)
                    : "Unassigned";

            var quantity = item.ItemType == ItemType.Quantity ? item.CurrentQuantity : 1m;

            var photosCount = item.Attachments.Count(a => a.AttachmentType == AttachmentType.Photo);
            var docsCount = item.Attachments.Count(a => a.AttachmentType != AttachmentType.Photo);

            claimItems.Add(
                new InsuranceClaimItemDto(
                    item.Id,
                    item.ShortCode,
                    item.Name,
                    item.Category?.Name,
                    item.Brand,
                    item.ModelNumber,
                    item.SerialNumber,
                    locationFullPath,
                    item.Status,
                    item.Condition,
                    quantity,
                    item.Unit,
                    item.PurchaseDate,
                    item.Retailer,
                    item.PurchasePrice,
                    item.EstimatedReplacementValue,
                    effectiveClaimValue,
                    item.WarrantyExpirationDate,
                    photosCount,
                    docsCount
                )
            );
        }

        var sortedItems = claimItems
            .OrderBy(i => i.LocationFullPath, StringComparer.OrdinalIgnoreCase)
            .ThenBy(i => i.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var totalQuantity = sortedItems.Sum(i => i.Quantity);
        var totalPurchaseValue = sortedItems.Sum(i =>
            (i.PurchasePrice ?? 0m) * (i.Quantity > 0 ? i.Quantity : 1m)
        );
        var totalReplacementValue = sortedItems.Sum(i =>
            (i.EstimatedReplacementValue ?? 0m) * (i.Quantity > 0 ? i.Quantity : 1m)
        );
        var totalEffectiveValue = sortedItems.Sum(i => i.EffectiveClaimValue);
        var totalPhotos = sortedItems.Sum(i => i.PhotoCount);
        var totalDocs = sortedItems.Sum(i => i.ReceiptAndDocCount);

        return new InsuranceClaimPreviewDto(
            DateTimeOffset.UtcNow,
            scopeDescription,
            sortedItems.Count,
            totalQuantity,
            Math.Round(totalPurchaseValue, 2),
            Math.Round(totalReplacementValue, 2),
            Math.Round(totalEffectiveValue, 2),
            totalPhotos,
            totalDocs,
            sortedItems
        );
    }

    public async Task<InsuranceExportArchiveResult> GenerateClaimZipAsync(
        Guid userId,
        InsuranceClaimFilterQuery query,
        CancellationToken cancellationToken = default
    )
    {
        var preview = await GetClaimPreviewAsync(userId, query, cancellationToken);

        using var zipStream = new MemoryStream();
        using (var archive = new ZipArchive(zipStream, ZipArchiveMode.Create, leaveOpen: true))
        {
            // 1. Insurance_Claim_Schedule.csv
            var csvBytes = BuildCsvBytes(preview);
            var csvEntry = archive.CreateEntry(
                "Insurance_Claim_Schedule.csv",
                CompressionLevel.Optimal
            );
            using (var entryStream = csvEntry.Open())
            {
                await entryStream.WriteAsync(csvBytes, cancellationToken);
            }

            // 2. Insurance_Claim_Schedule.pdf
            var pdfBytes = BuildClaimSchedulePdfBytes(preview);
            var pdfEntry = archive.CreateEntry(
                "Insurance_Claim_Schedule.pdf",
                CompressionLevel.Optimal
            );
            using (var entryStream = pdfEntry.Open())
            {
                await entryStream.WriteAsync(pdfBytes, cancellationToken);
            }

            // 3. Insurance_Claim_Summary.json
            var jsonBytes = JsonSerializer.SerializeToUtf8Bytes(preview, JsonOptions);
            var jsonEntry = archive.CreateEntry(
                "Insurance_Claim_Summary.json",
                CompressionLevel.Optimal
            );
            using (var entryStream = jsonEntry.Open())
            {
                await entryStream.WriteAsync(jsonBytes, cancellationToken);
            }

            // 4. Attachments (Photos/ and Receipts_And_Documents/)
            if (query.IncludeAttachments && preview.Items.Count > 0)
            {
                var itemIds = preview.Items.Select(i => i.Id).ToHashSet();
                var attachments = await dbContext
                    .ItemAttachments.AsNoTracking()
                    .Where(a => itemIds.Contains(a.ItemId))
                    .ToListAsync(cancellationToken);

                var itemMap = preview.Items.ToDictionary(i => i.Id);

                foreach (var att in attachments)
                {
                    if (!itemMap.TryGetValue(att.ItemId, out var itemDto))
                    {
                        continue;
                    }

                    var stream = await fileStorageService.OpenReadAsync(
                        att.StorageRelativePath,
                        cancellationToken
                    );
                    if (stream is null)
                    {
                        continue;
                    }

                    using (stream)
                    {
                        var folderPrefix =
                            att.AttachmentType == AttachmentType.Photo
                                ? "Photos"
                                : "Receipts_And_Documents";
                        var sanitizedItemName = SanitizeFileName(
                            $"{itemDto.ShortCode}_{itemDto.Name}"
                        );
                        var sanitizedAttName = SanitizeFileName(
                            $"{att.Id.ToString()[..8]}_{att.FileName}"
                        );
                        var entryPath = $"{folderPrefix}/{sanitizedItemName}/{sanitizedAttName}";

                        var fileEntry = archive.CreateEntry(entryPath, CompressionLevel.Optimal);
                        using var targetStream = fileEntry.Open();
                        await stream.CopyToAsync(targetStream, cancellationToken);
                    }
                }
            }
        }

        var zipBytes = zipStream.ToArray();
        var fileName = $"WhereHouse_Insurance_Claim_{preview.GeneratedAt:yyyyMMdd_HHmmss}.zip";

        return new InsuranceExportArchiveResult(zipBytes, fileName, preview);
    }

    public static byte[] BuildCsvBytes(InsuranceClaimPreviewDto preview)
    {
        var sb = new StringBuilder();

        sb.AppendLine(
            "Short Code,Name,Category,Brand,Model,Serial Number,Location,Status,Condition,Quantity,Unit,Purchase Date,Retailer,Purchase Price,Estimated Replacement Value,Effective Claim Value,Photos Count,Receipts/Docs Count"
        );

        foreach (var item in preview.Items)
        {
            sb.Append(EscapeCsv(item.ShortCode)).Append(',');
            sb.Append(EscapeCsv(item.Name)).Append(',');
            sb.Append(EscapeCsv(item.CategoryName ?? string.Empty)).Append(',');
            sb.Append(EscapeCsv(item.Brand ?? string.Empty)).Append(',');
            sb.Append(EscapeCsv(item.ModelNumber ?? string.Empty)).Append(',');
            sb.Append(EscapeCsv(item.SerialNumber ?? string.Empty)).Append(',');
            sb.Append(EscapeCsv(item.LocationFullPath)).Append(',');
            sb.Append(EscapeCsv(item.Status.ToString())).Append(',');
            sb.Append(EscapeCsv(item.Condition.ToString())).Append(',');
            sb.Append(item.Quantity.ToString(CultureInfo.InvariantCulture)).Append(',');
            sb.Append(EscapeCsv(item.Unit ?? string.Empty)).Append(',');
            sb.Append(
                    item.PurchaseDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture)
                        ?? string.Empty
                )
                .Append(',');
            sb.Append(EscapeCsv(item.Retailer ?? string.Empty)).Append(',');
            sb.Append(
                    item.PurchasePrice?.ToString("F2", CultureInfo.InvariantCulture) ?? string.Empty
                )
                .Append(',');
            sb.Append(
                    item.EstimatedReplacementValue?.ToString("F2", CultureInfo.InvariantCulture)
                        ?? string.Empty
                )
                .Append(',');
            sb.Append(item.EffectiveClaimValue.ToString("F2", CultureInfo.InvariantCulture))
                .Append(',');
            sb.Append(item.PhotoCount).Append(',');
            sb.Append(item.ReceiptAndDocCount);
            sb.AppendLine();
        }

        // Summary row
        sb.Append("TOTALS,,,,,,,,,");
        sb.Append(preview.TotalQuantitySum.ToString(CultureInfo.InvariantCulture)).Append(",,,,");
        sb.Append(preview.TotalPurchaseValue.ToString("F2", CultureInfo.InvariantCulture))
            .Append(',');
        sb.Append(preview.TotalReplacementValue.ToString("F2", CultureInfo.InvariantCulture))
            .Append(',');
        sb.Append(preview.TotalEffectiveClaimValue.ToString("F2", CultureInfo.InvariantCulture))
            .Append(',');
        sb.Append(preview.TotalPhotoCount).Append(',');
        sb.Append(preview.TotalReceiptAndDocCount);
        sb.AppendLine();

        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    public static byte[] BuildClaimSchedulePdfBytes(InsuranceClaimPreviewDto preview)
    {
        // Simple, deterministic pure-C# PDF 1.4 generator with multi-page support
        var pdf = new SimplePdfBuilder();

        const int itemsPerPage = 20;
        var totalPages = Math.Max(1, (int)Math.Ceiling(preview.Items.Count / (double)itemsPerPage));

        for (var pageIdx = 0; pageIdx < totalPages; pageIdx++)
        {
            var pageContent = new StringBuilder();

            // Page header
            pageContent.AppendLine("BT");
            pageContent.AppendLine("/F2 14 Tf"); // Helvetica-Bold 14
            pageContent.AppendLine("40 750 Td");
            pageContent.AppendLine(
                $"({EscapePdf(Truncate("WhereHouse — Home Insurance & Loss Claim Schedule", 60))}) Tj"
            );
            pageContent.AppendLine("ET");

            pageContent.AppendLine("BT");
            pageContent.AppendLine("/F1 9 Tf"); // Helvetica 9
            pageContent.AppendLine("40 735 Td");
            pageContent.AppendLine(
                $"({EscapePdf(Truncate($"Generated: {preview.GeneratedAt:yyyy-MM-dd HH:mm UTC} | Scope: {preview.ScopeDescription}", 110))}) Tj"
            );
            pageContent.AppendLine("ET");

            // Totals line on first page
            if (pageIdx == 0)
            {
                pageContent.AppendLine("BT");
                pageContent.AppendLine("/F2 9 Tf");
                pageContent.AppendLine("40 715 Td");
                var totalsStr =
                    $"Items: {preview.TotalItemsCount} | Total Claim Value: ${preview.TotalEffectiveClaimValue:N2} | Purchase: ${preview.TotalPurchaseValue:N2} | Replacement: ${preview.TotalReplacementValue:N2} | Photos: {preview.TotalPhotoCount} | Docs: {preview.TotalReceiptAndDocCount}";
                pageContent.AppendLine($"({EscapePdf(Truncate(totalsStr, 110))}) Tj");
                pageContent.AppendLine("ET");
            }

            // Divider rule
            pageContent.AppendLine("40 700 m 572 700 l S");

            // Column Headers
            pageContent.AppendLine("BT");
            pageContent.AppendLine("/F2 8 Tf");
            pageContent.AppendLine("40 688 Td");
            pageContent.AppendLine(
                $"({EscapePdf(PadRight("Code", 8) + PadRight("Item Name", 28) + PadRight("Location", 24) + PadRight("Serial / Brand", 20) + PadRight("Qty", 6) + "Claim Value")}) Tj"
            );
            pageContent.AppendLine("ET");

            pageContent.AppendLine("40 682 m 572 682 l S");

            // Rows
            var yPos = 668;
            var startItem = pageIdx * itemsPerPage;
            var pageItems = preview.Items.Skip(startItem).Take(itemsPerPage).ToList();

            foreach (var item in pageItems)
            {
                var code = PadRight(Truncate(item.ShortCode, 7), 8);
                var name = PadRight(Truncate(item.Name, 26), 28);
                var loc = PadRight(Truncate(item.LocationFullPath, 22), 24);
                var brandSerial = Truncate(
                    string.IsNullOrWhiteSpace(item.SerialNumber)
                        ? item.Brand ?? ""
                        : $"{item.Brand} / {item.SerialNumber}".Trim(' ', '/'),
                    18
                );
                var brandCol = PadRight(brandSerial, 20);
                var qty = PadRight(item.Quantity.ToString(CultureInfo.InvariantCulture), 6);
                var val = $"${item.EffectiveClaimValue:N2}";

                pageContent.AppendLine("BT");
                pageContent.AppendLine("/F1 8 Tf");
                pageContent.AppendLine($"40 {yPos} Td");
                pageContent.AppendLine(
                    $"({EscapePdf(code + name + loc + brandCol + qty + val)}) Tj"
                );
                pageContent.AppendLine("ET");

                yPos -= 14;
            }

            if (preview.Items.Count == 0 && pageIdx == 0)
            {
                pageContent.AppendLine("BT");
                pageContent.AppendLine("/F1 9 Tf");
                pageContent.AppendLine("40 650 Td");
                pageContent.AppendLine(
                    $"({EscapePdf("No items matched the specified export criteria.")}) Tj"
                );
                pageContent.AppendLine("ET");
            }

            // Footer
            pageContent.AppendLine("BT");
            pageContent.AppendLine("/F1 8 Tf");
            pageContent.AppendLine($"260 30 Td");
            pageContent.AppendLine($"({EscapePdf($"Page {pageIdx + 1} of {totalPages}")}) Tj");
            pageContent.AppendLine("ET");

            pdf.AddPage(pageContent.ToString());
        }

        return pdf.Build();
    }

    private static string EscapeCsv(string text)
    {
        if (text.Contains(',') || text.Contains('"') || text.Contains('\n') || text.Contains('\r'))
        {
            return $"\"{text.Replace("\"", "\"\"")}\"";
        }
        return text;
    }

    private static string EscapePdf(string text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return string.Empty;
        }

        var sb = new StringBuilder(text.Length);
        foreach (var ch in text)
        {
            if (ch == '\\' || ch == '(' || ch == ')')
            {
                sb.Append('\\').Append(ch);
            }
            else if (ch >= 32 && ch <= 126)
            {
                sb.Append(ch);
            }
            else
            {
                sb.Append(' ');
            }
        }
        return sb.ToString();
    }

    private static string Truncate(string text, int maxLength)
    {
        if (string.IsNullOrEmpty(text))
        {
            return string.Empty;
        }

        return text.Length <= maxLength ? text : text[..maxLength];
    }

    private static string PadRight(string text, int totalWidth)
    {
        return (text ?? string.Empty).PadRight(totalWidth);
    }

    private static string SanitizeFileName(string name)
    {
        var invalid = Path.GetInvalidFileNameChars();
        var chars = name.Select(c => invalid.Contains(c) ? '_' : c).ToArray();
        var clean = new string(chars).Trim();
        return string.IsNullOrWhiteSpace(clean) ? "unnamed" : clean;
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

    private static HashSet<Guid> ComputeSubtreeLocationIds(
        IReadOnlyList<LocationNode> allLocations,
        Guid rootId
    )
    {
        var result = new HashSet<Guid> { rootId };
        var queue = new Queue<Guid>();
        queue.Enqueue(rootId);

        var lookup = allLocations
            .Where(l => l.ParentId.HasValue)
            .ToLookup(l => l.ParentId!.Value, l => l.Id);

        while (queue.Count > 0)
        {
            var curr = queue.Dequeue();
            foreach (var childId in lookup[curr])
            {
                if (result.Add(childId))
                {
                    queue.Enqueue(childId);
                }
            }
        }

        return result;
    }

    private static string BuildFullPath(
        LocationNode node,
        IReadOnlyDictionary<Guid, LocationNode> locationMap
    )
    {
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

    private sealed class SimplePdfBuilder
    {
        private readonly List<string> _pageStreams = new();

        public void AddPage(string streamContent)
        {
            _pageStreams.Add(streamContent);
        }

        public byte[] Build()
        {
            using var ms = new MemoryStream();
            using var writer = new StreamWriter(ms, new UTF8Encoding(false));

            writer.NewLine = "\n";
            writer.WriteLine("%PDF-1.4");
            writer.WriteLine("%\u00e2\u00e3\u00cf\u00d3");
            writer.Flush();

            var offsets = new List<long>();

            // Object 1: Catalog
            offsets.Add(ms.Position);
            writer.WriteLine("1 0 obj");
            writer.WriteLine("<< /Type /Catalog /Pages 2 0 R >>");
            writer.WriteLine("endobj");
            writer.Flush();

            // Font 1 (Helvetica) obj ID = 3
            // Font 2 (Helvetica-Bold) obj ID = 4
            const int font1Id = 3;
            const int font2Id = 4;

            // Pages start at obj ID = 5, page contents follow
            // Each page takes 2 objects: Page obj and Content Stream obj
            var pageCount = _pageStreams.Count;
            var pageObjIds = new List<int>();
            for (var i = 0; i < pageCount; i++)
            {
                pageObjIds.Add(5 + (i * 2));
            }

            // Object 2: Pages
            offsets.Add(ms.Position);
            writer.WriteLine("2 0 obj");
            writer.Write("<< /Type /Pages /Kids [");
            foreach (var pid in pageObjIds)
            {
                writer.Write($"{pid} 0 R ");
            }
            writer.WriteLine($"] /Count {pageCount} >>");
            writer.WriteLine("endobj");
            writer.Flush();

            // Object 3: Font 1
            offsets.Add(ms.Position);
            writer.WriteLine($"{font1Id} 0 obj");
            writer.WriteLine("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
            writer.WriteLine("endobj");
            writer.Flush();

            // Object 4: Font 2
            offsets.Add(ms.Position);
            writer.WriteLine($"{font2Id} 0 obj");
            writer.WriteLine("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
            writer.WriteLine("endobj");
            writer.Flush();

            // Pages and Content Streams
            for (var i = 0; i < pageCount; i++)
            {
                var pageId = 5 + (i * 2);
                var contentId = pageId + 1;
                var contentBytes = Encoding.UTF8.GetBytes(_pageStreams[i]);

                // Page obj
                offsets.Add(ms.Position);
                writer.WriteLine($"{pageId} 0 obj");
                writer.WriteLine(
                    $"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {contentId} 0 R /Resources << /Font << /F1 {font1Id} 0 R /F2 {font2Id} 0 R >> >> >>"
                );
                writer.WriteLine("endobj");
                writer.Flush();

                // Stream obj
                offsets.Add(ms.Position);
                writer.WriteLine($"{contentId} 0 obj");
                writer.WriteLine($"<< /Length {contentBytes.Length} >>");
                writer.WriteLine("stream");
                writer.Flush();
                ms.Write(contentBytes, 0, contentBytes.Length);
                writer.WriteLine();
                writer.WriteLine("endstream");
                writer.WriteLine("endobj");
                writer.Flush();
            }

            var startXref = ms.Position;
            var totalObjs = 4 + (pageCount * 2);

            writer.WriteLine("xref");
            writer.WriteLine($"0 {totalObjs + 1}");
            writer.WriteLine("0000000000 65535 f ");
            foreach (var off in offsets)
            {
                writer.WriteLine($"{off:D10} 00000 n ");
            }

            writer.WriteLine("trailer");
            writer.WriteLine($"<< /Size {totalObjs + 1} /Root 1 0 R >>");
            writer.WriteLine("startxref");
            writer.WriteLine(startXref);
            writer.WriteLine("%%EOF");
            writer.Flush();

            return ms.ToArray();
        }
    }
}
