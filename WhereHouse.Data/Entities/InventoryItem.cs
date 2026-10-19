using WhereHouse.Core.Items;

namespace WhereHouse.Data.Entities;

public sealed class InventoryItem : IAuditable
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public string ShortCode { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string? Description { get; set; }

    public string? Aliases { get; set; }

    public string? Tags { get; set; }

    public ItemType ItemType { get; set; } = ItemType.Unique;

    public ItemStatus Status { get; set; } = ItemStatus.InPlace;

    public ItemCondition Condition { get; set; } = ItemCondition.Good;

    public Guid? HomeLocationId { get; set; }

    public LocationNode? HomeLocation { get; set; }

    public Guid? CategoryId { get; set; }

    public Category? Category { get; set; }

    public Guid? ParentItemId { get; set; }

    public InventoryItem? ParentItem { get; set; }

    public ICollection<InventoryItem> ChildItems { get; set; } = new List<InventoryItem>();

    public string? Brand { get; set; }

    public string? ModelNumber { get; set; }

    public string? SerialNumber { get; set; }

    public string? BarcodeNumber { get; set; }

    public decimal CurrentQuantity { get; set; } = 1m;

    public string? Unit { get; set; }

    public decimal? MinQuantity { get; set; }

    public DateTimeOffset? PurchaseDate { get; set; }

    public string? Retailer { get; set; }

    public decimal? PurchasePrice { get; set; }

    public decimal? EstimatedReplacementValue { get; set; }

    public DateTimeOffset? ReturnWindowEndDate { get; set; }

    public DateTimeOffset? WarrantyExpirationDate { get; set; }

    public string? WarrantyNotes { get; set; }

    public bool IsPrivate { get; set; }

    public Guid OwnerId { get; set; }

    public User Owner { get; set; } = null!;

    public ICollection<ItemAttributeValue> AttributeValues { get; set; } =
        new List<ItemAttributeValue>();

    public ICollection<ItemAttachment> Attachments { get; set; } = new List<ItemAttachment>();

    public ICollection<QrCode> BoundQrCodes { get; set; } = new List<QrCode>();

    public Guid? CheckedOutByUserId { get; set; }

    public string? CheckedOutByUsername { get; set; }

    public string? CheckedOutToBorrower { get; set; }

    public string? CheckedOutBorrowerContact { get; set; }

    public string? CheckoutNote { get; set; }

    public DateTimeOffset? CheckedOutAt { get; set; }

    public DateTimeOffset? CheckoutDueAt { get; set; }

    public Guid? ActiveLoadoutId { get; set; }

    public string? ActiveLoadoutName { get; set; }

    public ICollection<CheckoutLog> CheckoutLogs { get; set; } = new List<CheckoutLog>();

    public ICollection<LoadoutItem> LoadoutMemberships { get; set; } = new List<LoadoutItem>();

    public DateTimeOffset LastTouchedAt { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public string CreatedBy { get; set; } = "System";

    public DateTimeOffset ModifiedAt { get; set; }

    public string ModifiedBy { get; set; } = "System";
}
