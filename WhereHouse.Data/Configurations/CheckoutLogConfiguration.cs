using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Configurations;

public sealed class CheckoutLogConfiguration : IEntityTypeConfiguration<CheckoutLog>
{
    public void Configure(EntityTypeBuilder<CheckoutLog> builder)
    {
        builder.ToTable("CheckoutLogs");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.PerformedByUsername).IsRequired().HasMaxLength(150);

        builder.Property(c => c.BorrowerName).HasMaxLength(150);

        builder.Property(c => c.BorrowerContact).HasMaxLength(200);

        builder.Property(c => c.ProjectOrNote).HasMaxLength(500);

        builder.Property(c => c.LoadoutName).HasMaxLength(150);

        builder.Property(c => c.QuantityAffected).HasPrecision(18, 2);

        builder.Property(c => c.QuantityConsumed).HasPrecision(18, 2);

        builder.Property(c => c.CreatedBy).IsRequired().HasMaxLength(256);

        builder.Property(c => c.ModifiedBy).IsRequired().HasMaxLength(256);

        builder.HasIndex(c => c.ItemId);
        builder.HasIndex(c => c.PerformedByUserId);
        builder.HasIndex(c => c.LoadoutId);
        builder.HasIndex(c => c.OccurredAt);

        builder
            .HasOne(c => c.Item)
            .WithMany(i => i.CheckoutLogs)
            .HasForeignKey(c => c.ItemId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
