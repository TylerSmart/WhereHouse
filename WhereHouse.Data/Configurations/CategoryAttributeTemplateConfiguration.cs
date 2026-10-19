using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Configurations;

public sealed class CategoryAttributeTemplateConfiguration
    : IEntityTypeConfiguration<CategoryAttributeTemplate>
{
    public void Configure(EntityTypeBuilder<CategoryAttributeTemplate> builder)
    {
        builder.ToTable("CategoryAttributeTemplates");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Name).IsRequired().HasMaxLength(100);

        builder.Property(t => t.Unit).HasMaxLength(32);

        builder.Property(t => t.OptionsJson).HasMaxLength(2000);

        builder.Property(t => t.CreatedBy).IsRequired().HasMaxLength(256);

        builder.Property(t => t.ModifiedBy).IsRequired().HasMaxLength(256);

        builder.HasIndex(t => t.CategoryId);

        builder
            .HasOne(t => t.Category)
            .WithMany(c => c.AttributeTemplates)
            .HasForeignKey(t => t.CategoryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
