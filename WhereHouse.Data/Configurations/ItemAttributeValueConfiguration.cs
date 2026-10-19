using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Configurations;

public sealed class ItemAttributeValueConfiguration : IEntityTypeConfiguration<ItemAttributeValue>
{
    public void Configure(EntityTypeBuilder<ItemAttributeValue> builder)
    {
        builder.ToTable("ItemAttributeValues");

        builder.HasKey(v => v.Id);

        builder.Property(v => v.AttributeName).IsRequired().HasMaxLength(100);

        builder.Property(v => v.Unit).HasMaxLength(32);

        builder.Property(v => v.Value).IsRequired().HasMaxLength(1000);

        builder.HasIndex(v => v.ItemId);

        builder.HasIndex(v => v.AttributeTemplateId);

        builder
            .HasOne(v => v.Item)
            .WithMany(i => i.AttributeValues)
            .HasForeignKey(v => v.ItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
