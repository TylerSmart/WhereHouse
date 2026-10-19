using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhereHouse.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddDeclutterAndGraveyardLifecycle : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ArchivedAt",
                table: "InventoryItems",
                type: "datetimeoffset",
                nullable: true
            );

            migrationBuilder.AddColumn<Guid>(
                name: "ArchivedByUserId",
                table: "InventoryItems",
                type: "uniqueidentifier",
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "ArchivedByUsername",
                table: "InventoryItems",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "DispositionNote",
                table: "InventoryItems",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true
            );

            migrationBuilder.AddColumn<int>(
                name: "DispositionReason",
                table: "InventoryItems",
                type: "int",
                nullable: true
            );

            migrationBuilder.AddColumn<decimal>(
                name: "SalePrice",
                table: "InventoryItems",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true
            );

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "StagedAt",
                table: "InventoryItems",
                type: "datetimeoffset",
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "StagingListingNotes",
                table: "InventoryItems",
                type: "nvarchar(1000)",
                maxLength: 1000,
                nullable: true
            );

            migrationBuilder.AddColumn<decimal>(
                name: "StagingTargetPrice",
                table: "InventoryItems",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: true
            );

            migrationBuilder.CreateIndex(
                name: "IX_InventoryItems_DispositionReason",
                table: "InventoryItems",
                column: "DispositionReason"
            );

            migrationBuilder.CreateIndex(
                name: "IX_InventoryItems_LastTouchedAt",
                table: "InventoryItems",
                column: "LastTouchedAt"
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_InventoryItems_DispositionReason",
                table: "InventoryItems"
            );

            migrationBuilder.DropIndex(
                name: "IX_InventoryItems_LastTouchedAt",
                table: "InventoryItems"
            );

            migrationBuilder.DropColumn(name: "ArchivedAt", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "ArchivedByUserId", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "ArchivedByUsername", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "DispositionNote", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "DispositionReason", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "SalePrice", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "StagedAt", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "StagingListingNotes", table: "InventoryItems");

            migrationBuilder.DropColumn(name: "StagingTargetPrice", table: "InventoryItems");
        }
    }
}
