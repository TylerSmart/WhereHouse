using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Configurations;

public sealed class InventoryItemConfiguration : IEntityTypeConfiguration<InventoryItem>
{
    public void Configure(EntityTypeBuilder<InventoryItem> builder)
    {
        builder.ToTable("InventoryItems");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.ShortCode).IsRequired().HasMaxLength(32);

        builder.Property(i => i.Name).IsRequired().HasMaxLength(200);

        builder.Property(i => i.Description).HasMaxLength(2000);

        builder.Property(i => i.Aliases).HasMaxLength(500);

        builder.Property(i => i.Tags).HasMaxLength(500);

        builder.Property(i => i.Brand).HasMaxLength(100);

        builder.Property(i => i.ModelNumber).HasMaxLength(100);

        builder.Property(i => i.SerialNumber).HasMaxLength(100);

        builder.Property(i => i.BarcodeNumber).HasMaxLength(64);

        builder.Property(i => i.Unit).HasMaxLength(32);

        builder.Property(i => i.Retailer).HasMaxLength(150);

        builder.Property(i => i.WarrantyNotes).HasMaxLength(1000);

        builder.Property(i => i.CheckedOutByUsername).HasMaxLength(150);

        builder.Property(i => i.CheckedOutToBorrower).HasMaxLength(150);

        builder.Property(i => i.CheckedOutBorrowerContact).HasMaxLength(200);

        builder.Property(i => i.CheckoutNote).HasMaxLength(500);

        builder.Property(i => i.ActiveLoadoutName).HasMaxLength(150);

        builder.Property(i => i.CreatedBy).IsRequired().HasMaxLength(256);

        builder.Property(i => i.ModifiedBy).IsRequired().HasMaxLength(256);

        builder.Property(i => i.CurrentQuantity).HasPrecision(18, 2);

        builder.Property(i => i.MinQuantity).HasPrecision(18, 2);

        builder.Property(i => i.PurchasePrice).HasPrecision(18, 2);

        builder.Property(i => i.EstimatedReplacementValue).HasPrecision(18, 2);

        builder.Property(i => i.StagingTargetPrice).HasPrecision(18, 2);
        builder.Property(i => i.StagingListingNotes).HasMaxLength(1000);
        builder.Property(i => i.DispositionNote).HasMaxLength(1000);
        builder.Property(i => i.SalePrice).HasPrecision(18, 2);
        builder.Property(i => i.ArchivedByUsername).HasMaxLength(150);

        builder.HasIndex(i => i.ShortCode).IsUnique();

        builder.HasIndex(i => i.HomeLocationId);

        builder.HasIndex(i => i.CategoryId);

        builder.HasIndex(i => i.ParentItemId);

        builder.HasIndex(i => i.OwnerId);

        builder.HasIndex(i => i.ActiveLoadoutId);

        builder.HasIndex(i => i.Status);

        builder.HasIndex(i => i.ItemType);
        builder.HasIndex(i => i.BarcodeNumber);
        builder.HasIndex(i => i.DispositionReason);
        builder.HasIndex(i => i.LastTouchedAt);

        builder
            .HasOne(i => i.HomeLocation)
            .WithMany(l => l.Items)
            .HasForeignKey(i => i.HomeLocationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .HasOne(i => i.Category)
            .WithMany(c => c.Items)
            .HasForeignKey(i => i.CategoryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .HasOne(i => i.ParentItem)
            .WithMany(p => p.ChildItems)
            .HasForeignKey(i => i.ParentItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .HasOne(i => i.Owner)
            .WithMany(u => u.OwnedItems)
            .HasForeignKey(i => i.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
