namespace WhereHouse.Domain.Entities;

public class Location
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string QrCode { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    
    public int? ParentLocationId { get; set; }
    public Location? ParentLocation { get; set; }
    
    public ICollection<Location> ChildLocations { get; set; } = new List<Location>();
    public ICollection<Item> Items { get; set; } = new List<Item>();
}
