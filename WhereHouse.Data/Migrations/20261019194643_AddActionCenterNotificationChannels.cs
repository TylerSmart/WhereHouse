using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhereHouse.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddActionCenterNotificationChannels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "NotificationChannels",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(
                        type: "nvarchar(150)",
                        maxLength: 150,
                        nullable: false
                    ),
                    ChannelType = table.Column<int>(type: "int", nullable: false),
                    IsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    IsSharedHouseholdChannel = table.Column<bool>(type: "bit", nullable: false),
                    EndpointUrl = table.Column<string>(
                        type: "nvarchar(1000)",
                        maxLength: 1000,
                        nullable: true
                    ),
                    AccessTokenOrKey = table.Column<string>(
                        type: "nvarchar(500)",
                        maxLength: 500,
                        nullable: true
                    ),
                    RecipientOrUserKey = table.Column<string>(
                        type: "nvarchar(320)",
                        maxLength: 320,
                        nullable: true
                    ),
                    SmtpHost = table.Column<string>(
                        type: "nvarchar(255)",
                        maxLength: 255,
                        nullable: true
                    ),
                    SmtpPort = table.Column<int>(type: "int", nullable: true),
                    SmtpUsername = table.Column<string>(
                        type: "nvarchar(255)",
                        maxLength: 255,
                        nullable: true
                    ),
                    SmtpFromAddress = table.Column<string>(
                        type: "nvarchar(320)",
                        maxLength: 320,
                        nullable: true
                    ),
                    SmtpUseSsl = table.Column<bool>(type: "bit", nullable: false),
                    NotifyOnOverdueLoans = table.Column<bool>(type: "bit", nullable: false),
                    NotifyOnMaintenanceDue = table.Column<bool>(type: "bit", nullable: false),
                    NotifyOnExpiringWarranties = table.Column<bool>(type: "bit", nullable: false),
                    NotifyOnLowStock = table.Column<bool>(type: "bit", nullable: false),
                    EnableWeeklyDigest = table.Column<bool>(type: "bit", nullable: false),
                    DigestDayOfWeek = table.Column<int>(type: "int", nullable: false),
                    DigestHourUtc = table.Column<int>(type: "int", nullable: false),
                    LastTriggeredAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    LastDeliveryStatus = table.Column<string>(
                        type: "nvarchar(500)",
                        maxLength: 500,
                        nullable: true
                    ),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    ModifiedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    ModifiedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationChannels", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NotificationChannels_Users_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "NotificationDeliveryLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChannelId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ChannelName = table.Column<string>(
                        type: "nvarchar(150)",
                        maxLength: 150,
                        nullable: false
                    ),
                    ChannelType = table.Column<int>(type: "int", nullable: false),
                    EventType = table.Column<int>(type: "int", nullable: false),
                    Subject = table.Column<string>(
                        type: "nvarchar(300)",
                        maxLength: 300,
                        nullable: false
                    ),
                    MessageBody = table.Column<string>(
                        type: "nvarchar(4000)",
                        maxLength: 4000,
                        nullable: false
                    ),
                    Success = table.Column<bool>(type: "bit", nullable: false),
                    ResponseSummary = table.Column<string>(
                        type: "nvarchar(1000)",
                        maxLength: 1000,
                        nullable: true
                    ),
                    DeliveredAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                    ModifiedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    ModifiedBy = table.Column<string>(
                        type: "nvarchar(100)",
                        maxLength: 100,
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationDeliveryLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_NotificationDeliveryLogs_NotificationChannels_ChannelId",
                        column: x => x.ChannelId,
                        principalTable: "NotificationChannels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_NotificationChannels_IsEnabled",
                table: "NotificationChannels",
                column: "IsEnabled"
            );

            migrationBuilder.CreateIndex(
                name: "IX_NotificationChannels_IsSharedHouseholdChannel",
                table: "NotificationChannels",
                column: "IsSharedHouseholdChannel"
            );

            migrationBuilder.CreateIndex(
                name: "IX_NotificationChannels_OwnerId",
                table: "NotificationChannels",
                column: "OwnerId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_NotificationDeliveryLogs_ChannelId",
                table: "NotificationDeliveryLogs",
                column: "ChannelId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_NotificationDeliveryLogs_DeliveredAt",
                table: "NotificationDeliveryLogs",
                column: "DeliveredAt"
            );

            migrationBuilder.CreateIndex(
                name: "IX_NotificationDeliveryLogs_OwnerId",
                table: "NotificationDeliveryLogs",
                column: "OwnerId"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "NotificationDeliveryLogs");

            migrationBuilder.DropTable(name: "NotificationChannels");
        }
    }
}
