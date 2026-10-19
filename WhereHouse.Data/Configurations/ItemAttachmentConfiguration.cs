using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Configurations;

public sealed class ItemAttachmentConfiguration : IEntityTypeConfiguration<ItemAttachment>
{
    public void Configure(EntityTypeBuilder<ItemAttachment> builder)
    {
        builder.ToTable("ItemAttachments");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.FileName).IsRequired().HasMaxLength(255);

        builder.Property(x => x.ContentType).IsRequired().HasMaxLength(128);

        builder.Property(x => x.StorageRelativePath).IsRequired().HasMaxLength(500);

        builder.Property(x => x.Notes).HasMaxLength(500);

        builder.Property(x => x.CreatedBy).IsRequired().HasMaxLength(256);

        builder.Property(x => x.ModifiedBy).IsRequired().HasMaxLength(256);

        builder.HasIndex(x => x.ItemId);
        builder.HasIndex(x => x.UploadedByUserId);

        builder
            .HasOne(x => x.Item)
            .WithMany(i => i.Attachments)
            .HasForeignKey(x => x.ItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne(x => x.UploadedByUser)
            .WithMany(u => u.UploadedAttachments)
            .HasForeignKey(x => x.UploadedByUserId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
