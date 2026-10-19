using WhereHouse.Core.Categories;

namespace WhereHouse.Data.Entities;

public sealed class ItemAttributeValue
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid ItemId { get; set; }

    public InventoryItem Item { get; set; } = null!;

    public Guid? AttributeTemplateId { get; set; }

    public string AttributeName { get; set; } = string.Empty;

    public AttributeFieldType FieldType { get; set; } = AttributeFieldType.Text;

    public string? Unit { get; set; }

    public string Value { get; set; } = string.Empty;
}
