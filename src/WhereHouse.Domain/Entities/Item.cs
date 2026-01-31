namespace WhereHouse.Domain.Entities;

public class Item
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Notes { get; set; }
    public decimal? Value { get; set; }
    public string? Manufacturer { get; set; }
    public string? SerialNumber { get; set; }
    public string? ModelNumber { get; set; }
    public DateTime? PurchaseDate { get; set; }
    public string QrCode { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    
    public int? LocationId { get; set; }
    public Location? Location { get; set; }
    
    public ICollection<ItemTag> ItemTags { get; set; } = new List<ItemTag>();
}
