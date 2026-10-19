using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhereHouse.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddLocationCoverPhoto : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "CoverAttachmentId",
                table: "LocationNodes",
                type: "uniqueidentifier",
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "CoverPhotoContentType",
                table: "LocationNodes",
                type: "nvarchar(128)",
                maxLength: 128,
                nullable: true
            );

            migrationBuilder.AddColumn<string>(
                name: "CoverPhotoRelativePath",
                table: "LocationNodes",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true
            );
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "CoverAttachmentId", table: "LocationNodes");

            migrationBuilder.DropColumn(name: "CoverPhotoContentType", table: "LocationNodes");

            migrationBuilder.DropColumn(name: "CoverPhotoRelativePath", table: "LocationNodes");
        }
    }
}
