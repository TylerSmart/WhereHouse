using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Configurations;

public sealed class LoadoutConfiguration : IEntityTypeConfiguration<Loadout>
{
    public void Configure(EntityTypeBuilder<Loadout> builder)
    {
        builder.ToTable("Loadouts");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Name).IsRequired().HasMaxLength(150);

        builder.Property(l => l.Description).HasMaxLength(1000);

        builder.Property(l => l.Icon).HasMaxLength(64);

        builder.Property(l => l.ActiveCheckoutNote).HasMaxLength(500);

        builder.Property(l => l.CreatedBy).IsRequired().HasMaxLength(256);

        builder.Property(l => l.ModifiedBy).IsRequired().HasMaxLength(256);

        builder.HasIndex(l => l.OwnerId);
        builder.HasIndex(l => l.Status);

        builder
            .HasOne(l => l.Owner)
            .WithMany(u => u.OwnedLoadouts)
            .HasForeignKey(l => l.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
