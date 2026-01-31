namespace WhereHouse.Domain.Entities;

public class Tag
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Color { get; set; }
    public DateTime CreatedAt { get; set; }
    
    public ICollection<ItemTag> ItemTags { get; set; } = new List<ItemTag>();
}
