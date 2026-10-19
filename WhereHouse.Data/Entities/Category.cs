namespace WhereHouse.Data.Entities;

public sealed class Category : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? ParentId { get; set; }

    public Category? Parent { get; set; }

    public ICollection<Category> Children { get; set; } = new List<Category>();

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? Icon { get; set; }

    public string? Color { get; set; }

    public ICollection<CategoryAttributeTemplate> AttributeTemplates { get; set; } =
        new List<CategoryAttributeTemplate>();

    public ICollection<InventoryItem> Items { get; set; } = new List<InventoryItem>();

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
