using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Configurations;

public sealed class LoadoutItemConfiguration : IEntityTypeConfiguration<LoadoutItem>
{
    public void Configure(EntityTypeBuilder<LoadoutItem> builder)
    {
        builder.ToTable("LoadoutItems");

        builder.HasKey(li => li.Id);

        builder.Property(li => li.RequiredQuantity).HasPrecision(18, 2);

        builder.Property(li => li.QuantityCheckedOut).HasPrecision(18, 2);

        builder.Property(li => li.QuantityUsed).HasPrecision(18, 2);

        builder.Property(li => li.QuantityReturned).HasPrecision(18, 2);

        builder.Property(li => li.CreatedBy).IsRequired().HasMaxLength(256);

        builder.Property(li => li.ModifiedBy).IsRequired().HasMaxLength(256);

        builder.HasIndex(li => li.LoadoutId);
        builder.HasIndex(li => li.ItemId);
        builder.HasIndex(li => new { li.LoadoutId, li.ItemId });

        builder
            .HasOne(li => li.Loadout)
            .WithMany(l => l.Items)
            .HasForeignKey(li => li.LoadoutId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(li => li.Item)
            .WithMany(i => i.LoadoutMemberships)
            .HasForeignKey(li => li.ItemId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
