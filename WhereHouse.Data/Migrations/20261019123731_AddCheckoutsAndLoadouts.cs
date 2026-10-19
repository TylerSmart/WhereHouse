using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhereHouse.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddCheckoutsAndLoadouts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "ActiveLoadoutId",
                table: "InventoryItems",
                type: "uniqueidentifier",
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "ActiveLoadoutName",
                table: "InventoryItems",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true
            );

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CheckedOutAt",
                table: "InventoryItems",
                type: "datetimeoffset",
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "CheckedOutBorrowerContact",
                table: "InventoryItems",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true
            );

            migrationBuilder.AddColumn<Guid>(
                name: "CheckedOutByUserId",
                table: "InventoryItems",
                type: "uniqueidentifier",
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "CheckedOutByUsername",
                table: "InventoryItems",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "CheckedOutToBorrower",
                table: "InventoryItems",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true
            );

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CheckoutDueAt",
                table: "InventoryItems",
                type: "datetimeoffset",
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "CheckoutNote",
                table: "InventoryItems",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true
            );

            migrationBuilder.CreateTable(
                name: "CheckoutLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ActionType = table.Column<int>(type: "int", nullable: false),
                    PerformedByUserId = table.Column<Guid>(
                        type: "uniqueidentifier",
                        nullable: false
                    ),
                    PerformedByUsername = table.Column<string>(
                        type: "nvarchar(150)",
                        maxLength: 150,
                        nullable: false
                    ),
                    BorrowerName = table.Column<string>(
                        type: "nvarchar(150)",
                        maxLength: 150,
                        nullable: true
                    ),
                    BorrowerContact = table.Column<string>(
                        type: "nvarchar(200)",
                        maxLength: 200,
                        nullable: true
                    ),
                    ProjectOrNote = table.Column<string>(
                        type: "nvarchar(500)",
                        maxLength: 500,
                        nullable: true
                    ),
                    LoadoutId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    LoadoutName = table.Column<string>(
                        type: "nvarchar(150)",
                        maxLength: 150,
                        nullable: true
                    ),
                    QuantityAffected = table.Column<decimal>(
                        type: "decimal(18,2)",
                        precision: 18,
                        scale: 2,
                        nullable: false
                    ),
                    QuantityConsumed = table.Column<decimal>(
                        type: "decimal(18,2)",
                        precision: 18,
                        scale: 2,
                        nullable: true
                    ),
                    OccurredAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    ExpectedReturnAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    ReturnedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(256)",
                        maxLength: 256,
                        nullable: false
                    ),
                    ModifiedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    ModifiedBy = table.Column<string>(
                        type: "nvarchar(256)",
                        maxLength: 256,
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CheckoutLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CheckoutLogs_InventoryItems_ItemId",
                        column: x => x.ItemId,
                        principalTable: "InventoryItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "Loadouts",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(
                        type: "nvarchar(150)",
                        maxLength: 150,
                        nullable: false
                    ),
                    Description = table.Column<string>(
                        type: "nvarchar(1000)",
                        maxLength: 1000,
                        nullable: true
                    ),
                    Icon = table.Column<string>(
                        type: "nvarchar(64)",
                        maxLength: 64,
                        nullable: true
                    ),
                    Status = table.Column<int>(type: "int", nullable: false),
                    LastCheckedOutAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    LastReturnedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    ActiveCheckoutNote = table.Column<string>(
                        type: "nvarchar(500)",
                        maxLength: 500,
                        nullable: true
                    ),
                    IsPrivate = table.Column<bool>(type: "bit", nullable: false),
                    OwnerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(256)",
                        maxLength: 256,
                        nullable: false
                    ),
                    ModifiedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    ModifiedBy = table.Column<string>(
                        type: "nvarchar(256)",
                        maxLength: 256,
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Loadouts", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Loadouts_Users_OwnerId",
                        column: x => x.OwnerId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict
                    );
                }
            );

            migrationBuilder.CreateTable(
                name: "LoadoutItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    LoadoutId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RequiredQuantity = table.Column<decimal>(
                        type: "decimal(18,2)",
                        precision: 18,
                        scale: 2,
                        nullable: false
                    ),
                    IsConsumable = table.Column<bool>(type: "bit", nullable: false),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsCurrentlyCheckedOut = table.Column<bool>(type: "bit", nullable: false),
                    QuantityCheckedOut = table.Column<decimal>(
                        type: "decimal(18,2)",
                        precision: 18,
                        scale: 2,
                        nullable: false
                    ),
                    QuantityUsed = table.Column<decimal>(
                        type: "decimal(18,2)",
                        precision: 18,
                        scale: 2,
                        nullable: false
                    ),
                    QuantityReturned = table.Column<decimal>(
                        type: "decimal(18,2)",
                        precision: 18,
                        scale: 2,
                        nullable: false
                    ),
                    CheckedOutAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    ReturnedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: true
                    ),
                    CreatedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    CreatedBy = table.Column<string>(
                        type: "nvarchar(256)",
                        maxLength: 256,
                        nullable: false
                    ),
                    ModifiedAt = table.Column<DateTimeOffset>(
                        type: "datetimeoffset",
                        nullable: false
                    ),
                    ModifiedBy = table.Column<string>(
                        type: "nvarchar(256)",
                        maxLength: 256,
                        nullable: false
                    ),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LoadoutItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_LoadoutItems_InventoryItems_ItemId",
                        column: x => x.ItemId,
                        principalTable: "InventoryItems",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict
                    );
                    table.ForeignKey(
                        name: "FK_LoadoutItems_Loadouts_LoadoutId",
                        column: x => x.LoadoutId,
                        principalTable: "Loadouts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade
                    );
                }
            );

            migrationBuilder.CreateIndex(
                name: "IX_InventoryItems_ActiveLoadoutId",
                table: "InventoryItems",
                column: "ActiveLoadoutId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_CheckoutLogs_ItemId",
                table: "CheckoutLogs",
                column: "ItemId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_CheckoutLogs_LoadoutId",
                table: "CheckoutLogs",
                column: "LoadoutId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_CheckoutLogs_OccurredAt",
                table: "CheckoutLogs",
                column: "OccurredAt"
            );

            migrationBuilder.CreateIndex(
                name: "IX_CheckoutLogs_PerformedByUserId",
                table: "CheckoutLogs",
                column: "PerformedByUserId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_LoadoutItems_ItemId",
                table: "LoadoutItems",
                column: "ItemId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_LoadoutItems_LoadoutId",
                table: "LoadoutItems",
                column: "LoadoutId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_LoadoutItems_LoadoutId_ItemId",
                table: "LoadoutItems",
                columns: new[] { "LoadoutId", "ItemId" }
            );

            migrationBuilder.CreateIndex(
                name: "IX_Loadouts_OwnerId",
                table: "Loadouts",
                column: "OwnerId"
            );

            migrationBuilder.CreateIndex(
                name: "IX_Loadouts_Status",
                table: "Loadouts",
                column: "Status"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "CheckoutLogs");

            migrationBuilder.DropTable(name: "LoadoutItems");

            migrationBuilder.DropTable(name: "Loadouts");

            migrationBuilder.DropIndex(
                name: "IX_InventoryItems_ActiveLoadoutId",
                table: "InventoryItems"
            );

            migrationBuilder.DropColumn(name: "ActiveLoadoutId", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "ActiveLoadoutName", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "CheckedOutAt", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "CheckedOutBorrowerContact", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "CheckedOutByUserId", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "CheckedOutByUsername", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "CheckedOutToBorrower", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "CheckoutDueAt", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "CheckoutNote", table: "InventoryItems");
        }
    }
}
