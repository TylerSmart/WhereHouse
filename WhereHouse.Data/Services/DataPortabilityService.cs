using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using WhereHouse.Core.Categories;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;
using WhereHouse.Core.Portability;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Services;

public sealed class DataPortabilityService(WhereHouseDbContext dbContext) : IDataPortabilityService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
    };

    public async Task<WhereHouseExportBundleDto> ExportJsonBundleAsync(
        Guid userId,
        CancellationToken cancellationToken = default
    )
    {
        var allLocations = await dbContext
            .LocationNodes.AsNoTracking()
            .ToListAsync(cancellationToken);
        var locationDict = allLocations.ToDictionary(l => l.Id);

        var accessibleLocations = allLocations
            .Where(l => IsLocationAccessible(l, userId, locationDict))
            .ToList();

        // Topological ordering for locations: root nodes first, then by depth
        var orderedLocations = OrderLocationsTopologically(accessibleLocations);

        var categories = await dbContext
            .Categories.AsNoTracking()
            .Include(c => c.AttributeTemplates)
            .OrderBy(c => c.Name)
            .ToListAsync(cancellationToken);

        var items = await dbContext
            .InventoryItems.AsNoTracking()
            .Include(i => i.Category)
            .Include(i => i.HomeLocation)
            .Include(i => i.ParentItem)
            .Include(i => i.AttributeValues)
            .OrderBy(i => i.Name)
            .ToListAsync(cancellationToken);

        var accessibleItems = items.Where(i => IsItemAccessible(i, userId, locationDict)).ToList();

        var categoryExports = categories
            .Select(c => new CategoryExportRecord(
                c.Name,
                c.Description,
                c.Icon,
                c.AttributeTemplates.OrderBy(t => t.SortOrder)
                    .Select(t => new CategoryAttributeTemplateExportRecord(
                        t.Name,
                        t.FieldType,
                        t.Unit,
                        ParseOptionsJson(t.OptionsJson),
                        t.IsRequired,
                        t.SortOrder
                    ))
                    .ToList()
            ))
            .ToList();

        var locationExports = orderedLocations
            .Select(l =>
            {
                string? parentCode = null;
                if (l.ParentId.HasValue && locationDict.TryGetValue(l.ParentId.Value, out var p))
                {
                    parentCode = p.ShortCode;
                }
                return new LocationExportRecord(
                    l.ShortCode,
                    l.Name,
                    parentCode,
                    l.NodeType,
                    l.Description,
                    l.Icon,
                    l.ContainerStyle,
                    l.PrimaryColor,
                    l.AccentColor,
                    l.ColorLabel,
                    l.IsPrivate
                );
            })
            .ToList();

        var itemExports = accessibleItems
            .Select(i =>
            {
                var aliases = ParseCommaSeparated(i.Aliases);
                var tags = ParseCommaSeparated(i.Tags);
                var attrExports = i
                    .AttributeValues.Select(v => new ItemAttributeExportRecord(
                        v.AttributeName,
                        v.FieldType,
                        v.Unit,
                        v.Value
                    ))
                    .ToList();

                return new ItemExportRecord(
                    i.ShortCode,
                    i.Name,
                    i.ItemType,
                    i.Status,
                    i.Condition,
                    i.HomeLocation?.ShortCode,
                    i.Category?.Name,
                    i.ParentItem?.ShortCode,
                    i.Description,
                    aliases,
                    tags,
                    i.Brand,
                    i.ModelNumber,
                    i.SerialNumber,
                    i.BarcodeNumber,
                    i.CurrentQuantity,
                    i.Unit,
                    i.MinQuantity,
                    i.PurchaseDate,
                    i.Retailer,
                    i.PurchasePrice,
                    i.EstimatedReplacementValue,
                    i.ReturnWindowEndDate,
                    i.WarrantyExpirationDate,
                    i.WarrantyNotes,
                    i.IsPrivate,
                    attrExports
                );
            })
            .ToList();

        return new WhereHouseExportBundleDto(
            "1.0",
            DateTimeOffset.UtcNow,
            categoryExports,
            locationExports,
            itemExports
        );
    }

    public async Task<string> ExportCsvAsync(
        Guid userId,
        PortabilityEntityType entityType,
        CancellationToken cancellationToken = default
    )
    {
        var sb = new StringBuilder();

        if (entityType == PortabilityEntityType.Items)
        {
            var bundle = await ExportJsonBundleAsync(userId, cancellationToken);
            sb.AppendLine(
                "ShortCode,Name,ItemType,Status,Condition,HomeLocationShortCode,CategoryName,ParentItemShortCode,Brand,ModelNumber,SerialNumber,BarcodeNumber,CurrentQuantity,Unit,MinQuantity,PurchasePrice,EstimatedReplacementValue,Retailer,Description,Aliases,Tags,IsPrivate"
            );

            foreach (var item in bundle.Items)
            {
                sb.AppendLine(
                    string.Join(
                        ",",
                        CsvEscape(item.ShortCode),
                        CsvEscape(item.Name),
                        CsvEscape(item.ItemType.ToString()),
                        CsvEscape(item.Status.ToString()),
                        CsvEscape(item.Condition.ToString()),
                        CsvEscape(item.HomeLocationShortCode),
                        CsvEscape(item.CategoryName),
                        CsvEscape(item.ParentItemShortCode),
                        CsvEscape(item.Brand),
                        CsvEscape(item.ModelNumber),
                        CsvEscape(item.SerialNumber),
                        CsvEscape(item.BarcodeNumber),
                        item.CurrentQuantity.ToString(CultureInfo.InvariantCulture),
                        CsvEscape(item.Unit),
                        item.MinQuantity?.ToString(CultureInfo.InvariantCulture) ?? "",
                        item.PurchasePrice?.ToString(CultureInfo.InvariantCulture) ?? "",
                        item.EstimatedReplacementValue?.ToString(CultureInfo.InvariantCulture)
                            ?? "",
                        CsvEscape(item.Retailer),
                        CsvEscape(item.Description),
                        CsvEscape(string.Join("; ", item.Aliases)),
                        CsvEscape(string.Join("; ", item.Tags)),
                        item.IsPrivate ? "true" : "false"
                    )
                );
            }
        }
        else if (entityType == PortabilityEntityType.Locations)
        {
            var bundle = await ExportJsonBundleAsync(userId, cancellationToken);
            sb.AppendLine(
                "ShortCode,Name,ParentShortCode,NodeType,ContainerStyle,PrimaryColor,AccentColor,ColorLabel,Description,Icon,IsPrivate"
            );

            foreach (var loc in bundle.Locations)
            {
                sb.AppendLine(
                    string.Join(
                        ",",
                        CsvEscape(loc.ShortCode),
                        CsvEscape(loc.Name),
                        CsvEscape(loc.ParentShortCode),
                        CsvEscape(loc.NodeType.ToString()),
                        CsvEscape(loc.ContainerStyle),
                        CsvEscape(loc.PrimaryColor),
                        CsvEscape(loc.AccentColor),
                        CsvEscape(loc.ColorLabel),
                        CsvEscape(loc.Description),
                        CsvEscape(loc.Icon),
                        loc.IsPrivate ? "true" : "false"
                    )
                );
            }
        }
        else if (entityType == PortabilityEntityType.Categories)
        {
            var bundle = await ExportJsonBundleAsync(userId, cancellationToken);
            sb.AppendLine("Name,Description,Icon,AttributeTemplates");

            foreach (var cat in bundle.Categories)
            {
                var templateSummary = string.Join(
                    "; ",
                    cat.AttributeTemplates.Select(t =>
                        $"{t.Name} ({t.FieldType}{(string.IsNullOrEmpty(t.Unit) ? "" : " " + t.Unit)})"
                    )
                );

                sb.AppendLine(
                    string.Join(
                        ",",
                        CsvEscape(cat.Name),
                        CsvEscape(cat.Description),
                        CsvEscape(cat.Icon),
                        CsvEscape(templateSummary)
                    )
                );
            }
        }

        return sb.ToString();
    }

    public async Task<ImportResultDto> ImportJsonBundleAsync(
        Guid userId,
        JsonImportRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        if (string.IsNullOrWhiteSpace(request.JsonContent))
        {
            return new ImportResultDto(
                request.DryRun,
                0,
                0,
                0,
                0,
                1,
                [
                    new ImportRowPreviewDto(
                        1,
                        "Bundle",
                        "",
                        "",
                        ImportRowAction.Error,
                        "JSON content is empty."
                    ),
                ]
            );
        }

        WhereHouseExportBundleDto? bundle;
        try
        {
            bundle = JsonSerializer.Deserialize<WhereHouseExportBundleDto>(
                request.JsonContent,
                JsonOptions
            );
        }
        catch (JsonException ex)
        {
            return new ImportResultDto(
                request.DryRun,
                0,
                0,
                0,
                0,
                1,
                [
                    new ImportRowPreviewDto(
                        1,
                        "Bundle",
                        "",
                        "",
                        ImportRowAction.Error,
                        $"Invalid JSON: {ex.Message}"
                    ),
                ]
            );
        }

        if (bundle is null)
        {
            return new ImportResultDto(
                request.DryRun,
                0,
                0,
                0,
                0,
                1,
                [
                    new ImportRowPreviewDto(
                        1,
                        "Bundle",
                        "",
                        "",
                        ImportRowAction.Error,
                        "Parsed JSON bundle is null."
                    ),
                ]
            );
        }

        var previews = new List<ImportRowPreviewDto>();
        var totalRows = 0;
        var createdCount = 0;
        var updatedCount = 0;
        var skippedCount = 0;
        var errorCount = 0;
        var rowNum = 1;

        // Step 1: Categories
        var existingCategories = await dbContext
            .Categories.Include(c => c.AttributeTemplates)
            .ToListAsync(cancellationToken);
        var categoryMap = existingCategories.ToDictionary(
            c => c.Name.Trim(),
            c => c,
            StringComparer.OrdinalIgnoreCase
        );

        foreach (var cat in bundle.Categories ?? [])
        {
            totalRows++;
            if (string.IsNullOrWhiteSpace(cat.Name))
            {
                errorCount++;
                previews.Add(
                    new ImportRowPreviewDto(
                        rowNum++,
                        "Category",
                        "",
                        "",
                        ImportRowAction.Error,
                        "Category name is required."
                    )
                );
                continue;
            }

            if (categoryMap.TryGetValue(cat.Name.Trim(), out var existingCat))
            {
                if (request.UpdateExisting)
                {
                    updatedCount++;
                    previews.Add(
                        new ImportRowPreviewDto(
                            rowNum++,
                            "Category",
                            existingCat.Id.ToString(),
                            cat.Name,
                            ImportRowAction.Update,
                            "Category already exists; attributes updated."
                        )
                    );

                    if (!request.DryRun)
                    {
                        if (!string.IsNullOrWhiteSpace(cat.Description))
                        {
                            existingCat.Description = cat.Description.Trim();
                        }
                        if (!string.IsNullOrWhiteSpace(cat.Icon))
                        {
                            existingCat.Icon = cat.Icon.Trim();
                        }
                    }
                }
                else
                {
                    skippedCount++;
                    previews.Add(
                        new ImportRowPreviewDto(
                            rowNum++,
                            "Category",
                            existingCat.Id.ToString(),
                            cat.Name,
                            ImportRowAction.Skip,
                            "Category already exists (skipped)."
                        )
                    );
                }
            }
            else
            {
                createdCount++;
                previews.Add(
                    new ImportRowPreviewDto(
                        rowNum++,
                        "Category",
                        cat.Name,
                        cat.Name,
                        ImportRowAction.Create,
                        "Category will be created."
                    )
                );

                if (!request.DryRun)
                {
                    var newCat = new Category
                    {
                        Id = Guid.NewGuid(),
                        Name = cat.Name.Trim(),
                        Description = cat.Description?.Trim(),
                        Icon = cat.Icon?.Trim(),
                    };

                    if (cat.AttributeTemplates is { Count: > 0 })
                    {
                        foreach (var tmpl in cat.AttributeTemplates)
                        {
                            newCat.AttributeTemplates.Add(
                                new CategoryAttributeTemplate
                                {
                                    Id = Guid.NewGuid(),
                                    CategoryId = newCat.Id,
                                    Name = tmpl.Name.Trim(),
                                    FieldType = tmpl.FieldType,
                                    Unit = tmpl.Unit?.Trim(),
                                    OptionsJson = tmpl.Options is { Count: > 0 }
                                        ? JsonSerializer.Serialize(
                                            tmpl.Options.Select(o => o.Trim()).ToList()
                                        )
                                        : null,
                                    IsRequired = tmpl.IsRequired,
                                    SortOrder = tmpl.SortOrder,
                                }
                            );
                        }
                    }

                    dbContext.Categories.Add(newCat);
                    categoryMap[newCat.Name] = newCat;
                }
            }
        }

        if (!request.DryRun)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        // Step 2: Locations
        var allLocations = await dbContext.LocationNodes.ToListAsync(cancellationToken);
        var locationDict = allLocations.ToDictionary(l => l.Id);
        var locationCodeMap = allLocations.ToDictionary(
            l => l.ShortCode.Trim(),
            l => l,
            StringComparer.OrdinalIgnoreCase
        );

        foreach (var loc in bundle.Locations ?? [])
        {
            totalRows++;
            if (string.IsNullOrWhiteSpace(loc.Name))
            {
                errorCount++;
                previews.Add(
                    new ImportRowPreviewDto(
                        rowNum++,
                        "Location",
                        loc.ShortCode,
                        "",
                        ImportRowAction.Error,
                        "Location name is required."
                    )
                );
                continue;
            }

            var code = string.IsNullOrWhiteSpace(loc.ShortCode)
                ? null
                : loc.ShortCode.Trim().ToUpperInvariant();

            LocationNode? existingLoc = null;
            if (code is not null && locationCodeMap.TryGetValue(code, out existingLoc))
            {
                if (!IsLocationAccessible(existingLoc, userId, locationDict))
                {
                    errorCount++;
                    previews.Add(
                        new ImportRowPreviewDto(
                            rowNum++,
                            "Location",
                            code,
                            loc.Name,
                            ImportRowAction.Error,
                            "Cannot overwrite a restricted private location belonging to another user."
                        )
                    );
                    continue;
                }

                if (request.UpdateExisting)
                {
                    updatedCount++;
                    previews.Add(
                        new ImportRowPreviewDto(
                            rowNum++,
                            "Location",
                            code,
                            loc.Name,
                            ImportRowAction.Update,
                            "Location exists and will be updated."
                        )
                    );

                    if (!request.DryRun)
                    {
                        existingLoc.Name = loc.Name.Trim();
                        existingLoc.Description = loc.Description?.Trim();
                        existingLoc.NodeType = loc.NodeType;
                        existingLoc.ContainerStyle = loc.ContainerStyle?.Trim();
                        existingLoc.PrimaryColor = loc.PrimaryColor?.Trim();
                        existingLoc.AccentColor = loc.AccentColor?.Trim();
                        existingLoc.ColorLabel = loc.ColorLabel?.Trim();
                        existingLoc.Icon = loc.Icon?.Trim();
                        existingLoc.IsPrivate = loc.IsPrivate;
                    }
                }
                else
                {
                    skippedCount++;
                    previews.Add(
                        new ImportRowPreviewDto(
                            rowNum++,
                            "Location",
                            code,
                            loc.Name,
                            ImportRowAction.Skip,
                            "Location exists (skipped)."
                        )
                    );
                }
            }
            else
            {
                createdCount++;
                previews.Add(
                    new ImportRowPreviewDto(
                        rowNum++,
                        "Location",
                        code ?? "Auto",
                        loc.Name,
                        ImportRowAction.Create,
                        "Location will be created."
                    )
                );

                if (!request.DryRun)
                {
                    Guid? parentId = null;
                    if (
                        !string.IsNullOrWhiteSpace(loc.ParentShortCode)
                        && locationCodeMap.TryGetValue(
                            loc.ParentShortCode.Trim().ToUpperInvariant(),
                            out var parentLoc
                        )
                    )
                    {
                        parentId = parentLoc.Id;
                    }

                    var newShortCode = code;
                    if (string.IsNullOrWhiteSpace(newShortCode))
                    {
                        newShortCode = LocationShortCodeGenerator.GenerateNextShortCode(
                            loc.NodeType,
                            locationCodeMap.Keys
                        );
                    }

                    var newLoc = new LocationNode
                    {
                        Id = Guid.NewGuid(),
                        Name = loc.Name.Trim(),
                        ShortCode = newShortCode,
                        NodeType = loc.NodeType,
                        ParentId = parentId,
                        Description = loc.Description?.Trim(),
                        ContainerStyle = loc.ContainerStyle?.Trim(),
                        PrimaryColor = loc.PrimaryColor?.Trim(),
                        AccentColor = loc.AccentColor?.Trim(),
                        ColorLabel = loc.ColorLabel?.Trim(),
                        Icon = loc.Icon?.Trim(),
                        IsPrivate = loc.IsPrivate,
                        OwnerId = userId,
                    };

                    dbContext.LocationNodes.Add(newLoc);
                    locationCodeMap[newLoc.ShortCode] = newLoc;
                    locationDict[newLoc.Id] = newLoc;
                }
            }
        }

        if (!request.DryRun)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        // Step 3: Items
        var allItems = await dbContext
            .InventoryItems.Include(i => i.AttributeValues)
            .ToListAsync(cancellationToken);
        var itemCodeMap = allItems.ToDictionary(
            i => i.ShortCode.Trim(),
            i => i,
            StringComparer.OrdinalIgnoreCase
        );

        foreach (var item in bundle.Items ?? [])
        {
            totalRows++;
            if (string.IsNullOrWhiteSpace(item.Name))
            {
                errorCount++;
                previews.Add(
                    new ImportRowPreviewDto(
                        rowNum++,
                        "Item",
                        item.ShortCode,
                        "",
                        ImportRowAction.Error,
                        "Item name is required."
                    )
                );
                continue;
            }

            var itemCode = string.IsNullOrWhiteSpace(item.ShortCode)
                ? null
                : item.ShortCode.Trim().ToUpperInvariant();

            InventoryItem? existingItem = null;
            if (itemCode is not null && itemCodeMap.TryGetValue(itemCode, out existingItem))
            {
                if (!IsItemAccessible(existingItem, userId, locationDict))
                {
                    errorCount++;
                    previews.Add(
                        new ImportRowPreviewDto(
                            rowNum++,
                            "Item",
                            itemCode,
                            item.Name,
                            ImportRowAction.Error,
                            "Cannot overwrite a restricted private item belonging to another user."
                        )
                    );
                    continue;
                }

                if (request.UpdateExisting)
                {
                    updatedCount++;
                    previews.Add(
                        new ImportRowPreviewDto(
                            rowNum++,
                            "Item",
                            itemCode,
                            item.Name,
                            ImportRowAction.Update,
                            "Item exists and will be updated."
                        )
                    );

                    if (!request.DryRun)
                    {
                        existingItem.Name = item.Name.Trim();
                        existingItem.ItemType = item.ItemType;
                        existingItem.Status = item.Status;
                        existingItem.Condition = item.Condition;
                        existingItem.Description = item.Description?.Trim();
                        existingItem.Brand = item.Brand?.Trim();
                        existingItem.ModelNumber = item.ModelNumber?.Trim();
                        existingItem.SerialNumber = item.SerialNumber?.Trim();
                        existingItem.BarcodeNumber = item.BarcodeNumber?.Trim();
                        existingItem.CurrentQuantity = item.CurrentQuantity;
                        existingItem.Unit = item.Unit?.Trim();
                        existingItem.MinQuantity = item.MinQuantity;
                        existingItem.PurchaseDate = item.PurchaseDate;
                        existingItem.Retailer = item.Retailer?.Trim();
                        existingItem.PurchasePrice = item.PurchasePrice;
                        existingItem.EstimatedReplacementValue = item.EstimatedReplacementValue;
                        existingItem.ReturnWindowEndDate = item.ReturnWindowEndDate;
                        existingItem.WarrantyExpirationDate = item.WarrantyExpirationDate;
                        existingItem.WarrantyNotes = item.WarrantyNotes?.Trim();
                        existingItem.IsPrivate = item.IsPrivate;
                        existingItem.LastTouchedAt = DateTimeOffset.UtcNow;

                        if (
                            !string.IsNullOrWhiteSpace(item.HomeLocationShortCode)
                            && locationCodeMap.TryGetValue(
                                item.HomeLocationShortCode.Trim().ToUpperInvariant(),
                                out var homeNode
                            )
                        )
                        {
                            existingItem.HomeLocationId = homeNode.Id;
                        }

                        if (
                            !string.IsNullOrWhiteSpace(item.CategoryName)
                            && categoryMap.TryGetValue(item.CategoryName.Trim(), out var catNode)
                        )
                        {
                            existingItem.CategoryId = catNode.Id;
                        }
                    }
                }
                else
                {
                    skippedCount++;
                    previews.Add(
                        new ImportRowPreviewDto(
                            rowNum++,
                            "Item",
                            itemCode,
                            item.Name,
                            ImportRowAction.Skip,
                            "Item exists (skipped)."
                        )
                    );
                }
            }
            else
            {
                createdCount++;
                previews.Add(
                    new ImportRowPreviewDto(
                        rowNum++,
                        "Item",
                        itemCode ?? "Auto",
                        item.Name,
                        ImportRowAction.Create,
                        "Item will be created."
                    )
                );

                if (!request.DryRun)
                {
                    Guid? homeLocId = null;
                    if (
                        !string.IsNullOrWhiteSpace(item.HomeLocationShortCode)
                        && locationCodeMap.TryGetValue(
                            item.HomeLocationShortCode.Trim().ToUpperInvariant(),
                            out var homeNode
                        )
                    )
                    {
                        homeLocId = homeNode.Id;
                    }

                    Guid? categoryId = null;
                    if (
                        !string.IsNullOrWhiteSpace(item.CategoryName)
                        && categoryMap.TryGetValue(item.CategoryName.Trim(), out var catNode)
                    )
                    {
                        categoryId = catNode.Id;
                    }

                    var newShortCode = itemCode;
                    if (string.IsNullOrWhiteSpace(newShortCode))
                    {
                        newShortCode = ItemShortCodeGenerator.GenerateNextShortCode(
                            itemCodeMap.Keys
                        );
                    }

                    var newItem = new InventoryItem
                    {
                        Id = Guid.NewGuid(),
                        ShortCode = newShortCode,
                        Name = item.Name.Trim(),
                        ItemType = item.ItemType,
                        Status = item.Status,
                        Condition = item.Condition,
                        HomeLocationId = homeLocId,
                        CategoryId = categoryId,
                        Description = item.Description?.Trim(),
                        Brand = item.Brand?.Trim(),
                        ModelNumber = item.ModelNumber?.Trim(),
                        SerialNumber = item.SerialNumber?.Trim(),
                        BarcodeNumber = item.BarcodeNumber?.Trim(),
                        CurrentQuantity = item.CurrentQuantity,
                        Unit = item.Unit?.Trim(),
                        MinQuantity = item.MinQuantity,
                        PurchaseDate = item.PurchaseDate,
                        Retailer = item.Retailer?.Trim(),
                        PurchasePrice = item.PurchasePrice,
                        EstimatedReplacementValue = item.EstimatedReplacementValue,
                        ReturnWindowEndDate = item.ReturnWindowEndDate,
                        WarrantyExpirationDate = item.WarrantyExpirationDate,
                        WarrantyNotes = item.WarrantyNotes?.Trim(),
                        IsPrivate = item.IsPrivate,
                        OwnerId = userId,
                        LastTouchedAt = DateTimeOffset.UtcNow,
                        Aliases = item.Aliases is { Count: > 0 }
                            ? string.Join(", ", item.Aliases)
                            : null,
                        Tags = item.Tags is { Count: > 0 } ? string.Join(", ", item.Tags) : null,
                    };

                    if (item.AttributeValues is { Count: > 0 })
                    {
                        foreach (var attr in item.AttributeValues)
                        {
                            newItem.AttributeValues.Add(
                                new ItemAttributeValue
                                {
                                    Id = Guid.NewGuid(),
                                    ItemId = newItem.Id,
                                    AttributeName = attr.AttributeName.Trim(),
                                    FieldType = attr.FieldType,
                                    Unit = attr.Unit?.Trim(),
                                    Value = attr.Value.Trim(),
                                }
                            );
                        }
                    }

                    dbContext.InventoryItems.Add(newItem);
                    itemCodeMap[newItem.ShortCode] = newItem;
                }
            }
        }

        if (!request.DryRun)
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        return new ImportResultDto(
            request.DryRun,
            totalRows,
            createdCount,
            updatedCount,
            skippedCount,
            errorCount,
            previews
        );
    }

    public async Task<ImportResultDto> ImportCsvAsync(
        Guid userId,
        CsvImportRequest request,
        CancellationToken cancellationToken = default
    )
    {
        ArgumentNullException.ThrowIfNull(request);

        if (string.IsNullOrWhiteSpace(request.CsvContent))
        {
            return new ImportResultDto(
                request.DryRun,
                0,
                0,
                0,
                0,
                1,
                [
                    new ImportRowPreviewDto(
                        1,
                        "CSV",
                        "",
                        "",
                        ImportRowAction.Error,
                        "CSV content is empty."
                    ),
                ]
            );
        }

        var rows = ParseCsvLines(request.CsvContent);
        if (rows.Count < 2)
        {
            return new ImportResultDto(
                request.DryRun,
                0,
                0,
                0,
                0,
                1,
                [
                    new ImportRowPreviewDto(
                        1,
                        "CSV",
                        "",
                        "",
                        ImportRowAction.Error,
                        "CSV has no data rows."
                    ),
                ]
            );
        }

        var header = rows[0];
        var dataRows = rows.Skip(1).ToList();

        // Build header index lookup with optional ColumnMapping
        var headerIndexMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < header.Count; i++)
        {
            var rawH = header[i].Trim();
            var normalizedH = NormalizeHeaderName(rawH);
            headerIndexMap[normalizedH] = i;
            headerIndexMap[rawH] = i;
        }

        // Convert CSV data into WhereHouseExportBundleDto records
        var bundle = new WhereHouseExportBundleDto(
            "1.0",
            DateTimeOffset.UtcNow,
            Categories: new List<CategoryExportRecord>(),
            Locations: new List<LocationExportRecord>(),
            Items: new List<ItemExportRecord>()
        );

        if (request.EntityType == PortabilityEntityType.Items)
        {
            var itemsList = new List<ItemExportRecord>();
            for (var r = 0; r < dataRows.Count; r++)
            {
                var row = dataRows[r];
                var name = GetCsvVal(row, "Name", request.ColumnMapping, headerIndexMap);
                if (string.IsNullOrWhiteSpace(name))
                {
                    continue;
                }

                var shortCode = GetCsvVal(row, "ShortCode", request.ColumnMapping, headerIndexMap);
                var itemTypeStr = GetCsvVal(row, "ItemType", request.ColumnMapping, headerIndexMap);
                Enum.TryParse<ItemType>(itemTypeStr, true, out var itemType);

                var statusStr = GetCsvVal(row, "Status", request.ColumnMapping, headerIndexMap);
                Enum.TryParse<ItemStatus>(statusStr, true, out var status);

                var condStr = GetCsvVal(row, "Condition", request.ColumnMapping, headerIndexMap);
                Enum.TryParse<ItemCondition>(condStr, true, out var condition);

                var homeLocCode =
                    GetCsvVal(row, "HomeLocationShortCode", request.ColumnMapping, headerIndexMap)
                    ?? GetCsvVal(row, "LocationShortCode", request.ColumnMapping, headerIndexMap)
                    ?? GetCsvVal(row, "Location", request.ColumnMapping, headerIndexMap);

                var categoryName =
                    GetCsvVal(row, "CategoryName", request.ColumnMapping, headerIndexMap)
                    ?? GetCsvVal(row, "Category", request.ColumnMapping, headerIndexMap);

                var parentItemCode = GetCsvVal(
                    row,
                    "ParentItemShortCode",
                    request.ColumnMapping,
                    headerIndexMap
                );
                var brand = GetCsvVal(row, "Brand", request.ColumnMapping, headerIndexMap);
                var modelNumber = GetCsvVal(
                    row,
                    "ModelNumber",
                    request.ColumnMapping,
                    headerIndexMap
                );
                var serialNumber = GetCsvVal(
                    row,
                    "SerialNumber",
                    request.ColumnMapping,
                    headerIndexMap
                );
                var barcodeNumber =
                    GetCsvVal(row, "BarcodeNumber", request.ColumnMapping, headerIndexMap)
                    ?? GetCsvVal(row, "Barcode", request.ColumnMapping, headerIndexMap)
                    ?? GetCsvVal(row, "UPC", request.ColumnMapping, headerIndexMap);

                var qtyStr =
                    GetCsvVal(row, "CurrentQuantity", request.ColumnMapping, headerIndexMap)
                    ?? GetCsvVal(row, "Quantity", request.ColumnMapping, headerIndexMap);
                decimal.TryParse(qtyStr, CultureInfo.InvariantCulture, out var currentQty);
                if (currentQty <= 0)
                {
                    currentQty = 1m;
                }

                var unit = GetCsvVal(row, "Unit", request.ColumnMapping, headerIndexMap);

                var minQtyStr = GetCsvVal(
                    row,
                    "MinQuantity",
                    request.ColumnMapping,
                    headerIndexMap
                );
                decimal? minQty = decimal.TryParse(
                    minQtyStr,
                    CultureInfo.InvariantCulture,
                    out var m
                )
                    ? m
                    : null;

                var priceStr = GetCsvVal(
                    row,
                    "PurchasePrice",
                    request.ColumnMapping,
                    headerIndexMap
                );
                decimal? purchasePrice = decimal.TryParse(
                    priceStr,
                    CultureInfo.InvariantCulture,
                    out var p
                )
                    ? p
                    : null;

                var desc = GetCsvVal(row, "Description", request.ColumnMapping, headerIndexMap);
                var aliasesStr = GetCsvVal(row, "Aliases", request.ColumnMapping, headerIndexMap);
                var tagsStr = GetCsvVal(row, "Tags", request.ColumnMapping, headerIndexMap);
                var isPrivateStr = GetCsvVal(
                    row,
                    "IsPrivate",
                    request.ColumnMapping,
                    headerIndexMap
                );
                var isPrivate = string.Equals(
                    isPrivateStr,
                    "true",
                    StringComparison.OrdinalIgnoreCase
                );

                itemsList.Add(
                    new ItemExportRecord(
                        shortCode ?? "",
                        name,
                        itemType,
                        status,
                        condition,
                        homeLocCode,
                        categoryName,
                        parentItemCode,
                        desc,
                        ParseCommaSeparated(aliasesStr),
                        ParseCommaSeparated(tagsStr),
                        brand,
                        modelNumber,
                        serialNumber,
                        barcodeNumber,
                        currentQty,
                        unit,
                        minQty,
                        null,
                        null,
                        purchasePrice,
                        null,
                        null,
                        null,
                        null,
                        isPrivate,
                        []
                    )
                );
            }
            bundle = bundle with { Items = itemsList };
        }
        else if (request.EntityType == PortabilityEntityType.Locations)
        {
            var locList = new List<LocationExportRecord>();
            for (var r = 0; r < dataRows.Count; r++)
            {
                var row = dataRows[r];
                var name = GetCsvVal(row, "Name", request.ColumnMapping, headerIndexMap);
                if (string.IsNullOrWhiteSpace(name))
                {
                    continue;
                }

                var shortCode = GetCsvVal(row, "ShortCode", request.ColumnMapping, headerIndexMap);
                var parentCode =
                    GetCsvVal(row, "ParentShortCode", request.ColumnMapping, headerIndexMap)
                    ?? GetCsvVal(row, "ParentCode", request.ColumnMapping, headerIndexMap);

                var nodeTypeStr = GetCsvVal(row, "NodeType", request.ColumnMapping, headerIndexMap);
                Enum.TryParse<LocationNodeType>(nodeTypeStr, true, out var nodeType);

                var containerStyle = GetCsvVal(
                    row,
                    "ContainerStyle",
                    request.ColumnMapping,
                    headerIndexMap
                );
                var primaryColor = GetCsvVal(
                    row,
                    "PrimaryColor",
                    request.ColumnMapping,
                    headerIndexMap
                );
                var accentColor = GetCsvVal(
                    row,
                    "AccentColor",
                    request.ColumnMapping,
                    headerIndexMap
                );
                var colorLabel = GetCsvVal(
                    row,
                    "ColorLabel",
                    request.ColumnMapping,
                    headerIndexMap
                );
                var desc = GetCsvVal(row, "Description", request.ColumnMapping, headerIndexMap);
                var icon = GetCsvVal(row, "Icon", request.ColumnMapping, headerIndexMap);
                var isPrivateStr = GetCsvVal(
                    row,
                    "IsPrivate",
                    request.ColumnMapping,
                    headerIndexMap
                );
                var isPrivate = string.Equals(
                    isPrivateStr,
                    "true",
                    StringComparison.OrdinalIgnoreCase
                );

                locList.Add(
                    new LocationExportRecord(
                        shortCode ?? "",
                        name,
                        parentCode,
                        nodeType,
                        desc,
                        icon,
                        containerStyle,
                        primaryColor,
                        accentColor,
                        colorLabel,
                        isPrivate
                    )
                );
            }
            bundle = bundle with { Locations = locList };
        }
        else if (request.EntityType == PortabilityEntityType.Categories)
        {
            var catList = new List<CategoryExportRecord>();
            for (var r = 0; r < dataRows.Count; r++)
            {
                var row = dataRows[r];
                var name = GetCsvVal(row, "Name", request.ColumnMapping, headerIndexMap);
                if (string.IsNullOrWhiteSpace(name))
                {
                    continue;
                }

                var desc = GetCsvVal(row, "Description", request.ColumnMapping, headerIndexMap);
                var icon = GetCsvVal(row, "Icon", request.ColumnMapping, headerIndexMap);

                catList.Add(new CategoryExportRecord(name, desc, icon, []));
            }
            bundle = bundle with { Categories = catList };
        }

        var jsonReq = new JsonImportRequest(
            JsonSerializer.Serialize(bundle, JsonOptions),
            DryRun: request.DryRun,
            UpdateExisting: request.UpdateExisting
        );

        return await ImportJsonBundleAsync(userId, jsonReq, cancellationToken);
    }

    private static string? GetCsvVal(
        IReadOnlyList<string> row,
        string canonicalFieldName,
        IReadOnlyDictionary<string, string>? columnMapping,
        Dictionary<string, int> headerIndexMap
    )
    {
        string lookupName = canonicalFieldName;
        if (columnMapping != null && columnMapping.TryGetValue(canonicalFieldName, out var mapped))
        {
            lookupName = mapped;
        }

        if (headerIndexMap.TryGetValue(lookupName, out var idx) && idx < row.Count)
        {
            var val = row[idx].Trim();
            return string.IsNullOrEmpty(val) ? null : val;
        }

        var normalized = NormalizeHeaderName(lookupName);
        if (headerIndexMap.TryGetValue(normalized, out var normIdx) && normIdx < row.Count)
        {
            var val = row[normIdx].Trim();
            return string.IsNullOrEmpty(val) ? null : val;
        }

        return null;
    }

    private static string NormalizeHeaderName(string raw)
    {
        return raw.Replace(" ", "").Replace("_", "").Replace("-", "").ToLowerInvariant();
    }

    private static List<List<string>> ParseCsvLines(string csv)
    {
        var result = new List<List<string>>();
        var currentRow = new List<string>();
        var currentCell = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < csv.Length; i++)
        {
            var c = csv[i];

            if (inQuotes)
            {
                if (c == '"')
                {
                    if (i + 1 < csv.Length && csv[i + 1] == '"')
                    {
                        currentCell.Append('"');
                        i++; // Skip escaped quote
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    currentCell.Append(c);
                }
            }
            else
            {
                if (c == '"')
                {
                    inQuotes = true;
                }
                else if (c == ',')
                {
                    currentRow.Add(currentCell.ToString());
                    currentCell.Clear();
                }
                else if (c == '\r')
                {
                    // Ignore carriage return, handled on \n
                }
                else if (c == '\n')
                {
                    currentRow.Add(currentCell.ToString());
                    currentCell.Clear();
                    result.Add(currentRow);
                    currentRow = new List<string>();
                }
                else
                {
                    currentCell.Append(c);
                }
            }
        }

        if (currentCell.Length > 0 || currentRow.Count > 0)
        {
            currentRow.Add(currentCell.ToString());
            result.Add(currentRow);
        }

        return result;
    }

    private static string CsvEscape(string? input)
    {
        if (string.IsNullOrEmpty(input))
        {
            return "";
        }

        if (
            input.Contains(',')
            || input.Contains('"')
            || input.Contains('\n')
            || input.Contains('\r')
        )
        {
            return $"\"{input.Replace("\"", "\"\"")}\"";
        }

        return input;
    }

    private static List<LocationNode> OrderLocationsTopologically(List<LocationNode> locations)
    {
        var lookup = locations.ToDictionary(l => l.Id);
        int GetDepth(LocationNode loc)
        {
            var depth = 0;
            var cur = loc;
            while (cur.ParentId.HasValue && lookup.TryGetValue(cur.ParentId.Value, out var parent))
            {
                depth++;
                cur = parent;
            }
            return depth;
        }

        return locations.OrderBy(GetDepth).ThenBy(l => l.NodeType).ThenBy(l => l.Name).ToList();
    }

    private static bool IsLocationAccessible(
        LocationNode node,
        Guid userId,
        IReadOnlyDictionary<Guid, LocationNode> allLocations
    )
    {
        var cur = node;
        while (cur != null)
        {
            if (cur.IsPrivate && cur.OwnerId != userId)
            {
                return false;
            }

            if (!cur.ParentId.HasValue)
            {
                break;
            }

            allLocations.TryGetValue(cur.ParentId.Value, out cur!);
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

        if (!item.HomeLocationId.HasValue)
        {
            return true;
        }

        if (allLocations.TryGetValue(item.HomeLocationId.Value, out var homeLoc))
        {
            return IsLocationAccessible(homeLoc, userId, allLocations);
        }

        return true;
    }

    private static List<string> ParseOptionsJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return [];
        }

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch
        {
            return [];
        }
    }

    private static List<string> ParseCommaSeparated(string? val)
    {
        if (string.IsNullOrWhiteSpace(val))
        {
            return [];
        }

        return val.Split(
                ',',
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
            )
            .ToList();
    }
}
