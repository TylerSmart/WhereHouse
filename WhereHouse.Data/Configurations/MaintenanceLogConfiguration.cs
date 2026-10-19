using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Configurations;

public sealed class MaintenanceLogConfiguration : IEntityTypeConfiguration<MaintenanceLog>
{
    public void Configure(EntityTypeBuilder<MaintenanceLog> builder)
    {
        builder.ToTable("MaintenanceLogs");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.CompletedByUsername).IsRequired().HasMaxLength(150);

        builder.Property(l => l.Notes).HasMaxLength(1000);

        builder.Property(l => l.Cost).HasPrecision(18, 2);

        builder.Property(l => l.CreatedBy).IsRequired().HasMaxLength(256);

        builder.Property(l => l.ModifiedBy).IsRequired().HasMaxLength(256);

        builder.HasIndex(l => l.ScheduleId);
        builder.HasIndex(l => l.ItemId);
        builder.HasIndex(l => l.CompletedByUserId);
        builder.HasIndex(l => l.CompletedAt);

        builder
            .HasOne(l => l.Schedule)
            .WithMany(s => s.Logs)
            .HasForeignKey(l => l.ScheduleId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
