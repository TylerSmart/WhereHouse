using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WhereHouse.Data.Entities;

namespace WhereHouse.Data.Configurations;

public sealed class NotificationDeliveryLogConfiguration
    : IEntityTypeConfiguration<NotificationDeliveryLog>
{
    public void Configure(EntityTypeBuilder<NotificationDeliveryLog> builder)
    {
        builder.ToTable("NotificationDeliveryLogs");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.ChannelName).IsRequired().HasMaxLength(150);

        builder.Property(l => l.Subject).IsRequired().HasMaxLength(300);

        builder.Property(l => l.MessageBody).IsRequired().HasMaxLength(4000);

        builder.Property(l => l.ResponseSummary).HasMaxLength(1000);

        builder.Property(l => l.CreatedBy).IsRequired().HasMaxLength(100);

        builder.Property(l => l.ModifiedBy).IsRequired().HasMaxLength(100);

        builder.HasIndex(l => l.ChannelId);
        builder.HasIndex(l => l.OwnerId);
        builder.HasIndex(l => l.DeliveredAt);

        builder
            .HasOne(l => l.Channel)
            .WithMany(c => c.DeliveryLogs)
            .HasForeignKey(l => l.ChannelId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
