using WhereHouse.Core.Categories;

namespace WhereHouse.Data.Entities;

public sealed class CategoryAttributeTemplate : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid CategoryId { get; set; }

    public Category Category { get; set; } = null!;

    public string Name { get; set; } = string.Empty;

    public AttributeFieldType FieldType { get; set; } = AttributeFieldType.Text;

    public string? Unit { get; set; }

    public string? OptionsJson { get; set; }

    public bool IsRequired { get; set; }

    public int SortOrder { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
