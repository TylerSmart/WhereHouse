using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Configurations;

public sealed class LocationNodeConfiguration : IEntityTypeConfiguration<LocationNode>
{
    public void Configure(EntityTypeBuilder<LocationNode> builder)
    {
        builder.ToTable("LocationNodes");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.Name).IsRequired().HasMaxLength(150);

        builder.Property(l => l.Description).HasMaxLength(1000);

        builder.Property(l => l.ShortCode).IsRequired().HasMaxLength(32);

        builder.Property(l => l.Icon).HasMaxLength(64);

        builder.Property(l => l.ContainerStyle).HasMaxLength(100);

        builder.Property(l => l.PrimaryColor).HasMaxLength(32);

        builder.Property(l => l.AccentColor).HasMaxLength(32);

        builder.Property(l => l.ColorLabel).HasMaxLength(100);

        builder.Property(l => l.CreatedBy).IsRequired().HasMaxLength(256);

        builder.Property(l => l.ModifiedBy).IsRequired().HasMaxLength(256);

        builder.HasIndex(l => l.ShortCode).IsUnique();

        builder.HasIndex(l => l.ParentId);

        builder.HasIndex(l => l.OwnerId);

        builder
            .HasOne(l => l.Parent)
            .WithMany(p => p.Children)
            .HasForeignKey(l => l.ParentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .HasOne(l => l.Owner)
            .WithMany(u => u.OwnedLocations)
            .HasForeignKey(l => l.OwnerId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
