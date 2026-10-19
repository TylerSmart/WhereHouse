using System.ComponentModel.DataAnnotations;
using WhereHouse.Core.Categories;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.Core.Portability;

public enum PortabilityEntityType
{
    Items = 0,
    Locations = 1,
    Categories = 2,
}

public enum ImportRowAction
{
    Create = 0,
    Update = 1,
    Skip = 2,
    Error = 3,
}

public sealed record CategoryAttributeTemplateExportRecord(
    string Name,
    AttributeFieldType FieldType,
    string? Unit,
    IReadOnlyList<string> Options,
    bool IsRequired,
    int SortOrder
);

public sealed record CategoryExportRecord(
    string Name,
    string? Description,
    string? Icon,
    IReadOnlyList<CategoryAttributeTemplateExportRecord> AttributeTemplates
);

public sealed record LocationExportRecord(
    string ShortCode,
    string Name,
    string? ParentShortCode,
    LocationNodeType NodeType,
    string? Description,
    string? Icon,
    string? ContainerStyle,
    string? PrimaryColor,
    string? AccentColor,
    string? ColorLabel,
    bool IsPrivate
);

public sealed record ItemAttributeExportRecord(
    string AttributeName,
    AttributeFieldType FieldType,
    string? Unit,
    string Value
);

public sealed record ItemExportRecord(
    string ShortCode,
    string Name,
    ItemType ItemType,
    ItemStatus Status,
    ItemCondition Condition,
    string? HomeLocationShortCode,
    string? CategoryName,
    string? ParentItemShortCode,
    string? Description,
    IReadOnlyList<string> Aliases,
    IReadOnlyList<string> Tags,
    string? Brand,
    string? ModelNumber,
    string? SerialNumber,
    string? BarcodeNumber,
    decimal CurrentQuantity,
    string? Unit,
    decimal? MinQuantity,
    DateTimeOffset? PurchaseDate,
    string? Retailer,
    decimal? PurchasePrice,
    decimal? EstimatedReplacementValue,
    DateTimeOffset? ReturnWindowEndDate,
    DateTimeOffset? WarrantyExpirationDate,
    string? WarrantyNotes,
    bool IsPrivate,
    IReadOnlyList<ItemAttributeExportRecord> AttributeValues
);

public sealed record WhereHouseExportBundleDto(
    string FormatVersion,
    DateTimeOffset ExportedAt,
    IReadOnlyList<CategoryExportRecord> Categories,
    IReadOnlyList<LocationExportRecord> Locations,
    IReadOnlyList<ItemExportRecord> Items
);

public sealed record CsvImportRequest(
    PortabilityEntityType EntityType,
    [Required] string CsvContent,
    bool DryRun = true,
    bool UpdateExisting = true,
    IReadOnlyDictionary<string, string>? ColumnMapping = null
);

public sealed record JsonImportRequest(
    [Required] string JsonContent,
    bool DryRun = true,
    bool UpdateExisting = true
);

public sealed record ImportRowPreviewDto(
    int RowNumber,
    string EntityType,
    string Identifier,
    string Name,
    ImportRowAction Action,
    string Message
);

public sealed record ImportResultDto(
    bool DryRun,
    int TotalRowsProcessed,
    int CreatedCount,
    int UpdatedCount,
    int SkippedCount,
    int ErrorCount,
    IReadOnlyList<ImportRowPreviewDto> Rows
);
