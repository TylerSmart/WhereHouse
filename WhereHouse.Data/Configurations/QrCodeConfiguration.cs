using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Configurations;

public sealed class QrCodeConfiguration : IEntityTypeConfiguration<QrCode>
{
    public void Configure(EntityTypeBuilder<QrCode> builder)
    {
        builder.ToTable("QrCodes");

        builder.HasKey(q => q.Id);

        builder.Property(q => q.Token).IsRequired().HasMaxLength(64);

        builder.Property(q => q.LabelNote).HasMaxLength(200);

        builder.Property(q => q.CreatedBy).IsRequired().HasMaxLength(256);

        builder.Property(q => q.ModifiedBy).IsRequired().HasMaxLength(256);

        builder.HasIndex(q => q.Token).IsUnique();

        builder.HasIndex(q => q.TargetType);

        builder.HasIndex(q => q.LocationNodeId);

        builder.HasIndex(q => q.ItemId);

        builder
            .HasOne(q => q.LocationNode)
            .WithMany(l => l.BoundQrCodes)
            .HasForeignKey(q => q.LocationNodeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .HasOne(q => q.Item)
            .WithMany(i => i.BoundQrCodes)
            .HasForeignKey(q => q.ItemId)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .HasOne(q => q.CreatedByUser)
            .WithMany(u => u.CreatedQrCodes)
            .HasForeignKey(q => q.CreatedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder
            .HasOne(q => q.BoundByUser)
            .WithMany(u => u.BoundQrCodes)
            .HasForeignKey(q => q.BoundByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
