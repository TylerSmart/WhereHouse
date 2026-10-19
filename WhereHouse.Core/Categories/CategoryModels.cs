using System.ComponentModel.DataAnnotations;

namespace WhereHouse.Core.Categories;

public enum AttributeFieldType
{
    Text = 0,
    Number = 1,
    Enum = 2,
    Boolean = 3,
}

public sealed record CategoryAttributeTemplateDto(
    Guid Id,
    Guid CategoryId,
    string Name,
    AttributeFieldType FieldType,
    string? Unit,
    IReadOnlyList<string> Options,
    bool IsRequired,
    int SortOrder
);

public sealed record CategoryDto(
    Guid Id,
    Guid? ParentId,
    string Name,
    string? Description,
    string? Icon,
    string? Color,
    IReadOnlyList<CategoryAttributeTemplateDto> AttributeTemplates,
    int ItemCount,
    DateTimeOffset CreatedAt,
    DateTimeOffset ModifiedAt
);

public sealed record UpsertCategoryAttributeTemplateRequest(
    Guid? Id,
    [Required, MaxLength(100)] string Name,
    AttributeFieldType FieldType = AttributeFieldType.Text,
    [MaxLength(32)] string? Unit = null,
    IReadOnlyList<string>? Options = null,
    bool IsRequired = false,
    int SortOrder = 0
);

public sealed record CreateCategoryRequest(
    [Required, MaxLength(100)] string Name,
    Guid? ParentId = null,
    [MaxLength(500)] string? Description = null,
    [MaxLength(64)] string? Icon = null,
    [MaxLength(32)] string? Color = null,
    IReadOnlyList<UpsertCategoryAttributeTemplateRequest>? AttributeTemplates = null
);

public sealed record UpdateCategoryRequest(
    [Required, MaxLength(100)] string Name,
    Guid? ParentId = null,
    [MaxLength(500)] string? Description = null,
    [MaxLength(64)] string? Icon = null,
    [MaxLength(32)] string? Color = null,
    IReadOnlyList<UpsertCategoryAttributeTemplateRequest>? AttributeTemplates = null
);
