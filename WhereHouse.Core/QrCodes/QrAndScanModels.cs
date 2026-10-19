using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;
using WhereHouse.Core.Items;
using WhereHouse.Core.Locations;

namespace WhereHouse.Core.QrCodes;

public enum QrTargetType
{
    Unassigned = 0,
    LocationNode = 1,
    Item = 2,
}

public enum ScanResolutionType
{
    NotFound = 0,
    UnassignedQr = 1,
    LocationNode = 2,
    Item = 3,
    PrivateRestricted = 4,
}

public enum BulkAuditOutcomeType
{
    MovedContainer = 0,
    MovedItem = 1,
    AuditedPresent = 2,
    SkippedPrivate = 3,
    SkippedInvalidCycle = 4,
    UnassignedQr = 5,
    NotFound = 6,
}

public static partial class QrCodeTokenHelper
{
    public const string DefaultPrefix = "QR";

    [GeneratedRegex(@"/scan/([^/?#]+)", RegexOptions.IgnoreCase)]
    private static partial Regex ScanUrlPattern();

    public static string ExtractCodeFromScanInput(string? rawInput)
    {
        if (string.IsNullOrWhiteSpace(rawInput))
        {
            throw new ArgumentException("Scan input cannot be empty.", nameof(rawInput));
        }

        var trimmed = rawInput.Trim();
        var unescaped = Uri.UnescapeDataString(trimmed);
        var match = ScanUrlPattern().Match(unescaped);
        if (match.Success)
        {
            var rawSegment = match.Groups[1].Value;
            var decoded = Uri.UnescapeDataString(rawSegment).Trim();
            if (!string.IsNullOrWhiteSpace(decoded))
            {
                return decoded.ToUpperInvariant();
            }
        }

        return unescaped.ToUpperInvariant();
    }

    public static string GenerateNextBlankToken(
        IEnumerable<string> existingTokens,
        string prefix = DefaultPrefix
    )
    {
        var normalizedPrefix = string.IsNullOrWhiteSpace(prefix)
            ? DefaultPrefix
            : prefix.Trim().ToUpperInvariant();

        var pattern = new Regex(
            $@"^{Regex.Escape(normalizedPrefix)}-(\d+)$",
            RegexOptions.IgnoreCase
        );

        var maxNumber = 0;
        foreach (var token in existingTokens)
        {
            if (string.IsNullOrWhiteSpace(token))
            {
                continue;
            }

            var match = pattern.Match(token.Trim());
            if (match.Success && int.TryParse(match.Groups[1].Value, out var num))
            {
                if (num > maxNumber)
                {
                    maxNumber = num;
                }
            }
        }

        return $"{normalizedPrefix}-{(maxNumber + 1):D4}";
    }
}

public sealed record QrCodeDto(
    Guid Id,
    string Token,
    QrTargetType TargetType,
    Guid? LocationNodeId,
    string? LocationNodeName,
    string? LocationNodeShortCode,
    string? LocationNodeFullPath,
    Guid? ItemId,
    string? ItemName,
    string? ItemShortCode,
    string? LabelNote,
    int PrintedCount,
    DateTimeOffset? BoundAt,
    DateTimeOffset? LastScannedAt,
    Guid CreatedByUserId,
    DateTimeOffset CreatedAt,
    DateTimeOffset ModifiedAt
);

public sealed record GenerateQrCodeBatchRequest(
    [Range(1, 200)] int Count = 10,
    [MaxLength(16)] string? Prefix = null,
    [MaxLength(200)] string? LabelNote = null
);

public sealed record BindQrCodeRequest(
    QrTargetType TargetType,
    Guid TargetId,
    [MaxLength(200)] string? LabelNote = null
);

public sealed record ScanResolutionDto(
    string ScannedCode,
    ScanResolutionType ResolutionType,
    string Message,
    QrCodeDto? QrCode = null,
    LocationNodeDto? Location = null,
    IReadOnlyList<LocationNodeDto>? ChildLocations = null,
    IReadOnlyList<ItemDto>? LocationItems = null,
    ItemDto? Item = null
);

public sealed record BulkScanAuditRequest(
    [Required] Guid DestinationLocationId,
    [Required, MinLength(1)] IReadOnlyList<string> ScannedCodes
);

public sealed record BulkScanAuditItemResultDto(
    string ScannedCode,
    BulkAuditOutcomeType Outcome,
    string Message,
    Guid? EntityId = null,
    string? EntityName = null,
    string? EntityShortCode = null
);

public sealed record BulkScanAuditResponseDto(
    Guid DestinationLocationId,
    string DestinationName,
    string DestinationShortCode,
    string DestinationFullPath,
    DateTimeOffset AuditedAt,
    int MovedCount,
    int AuditedPresentCount,
    int ErrorOrSkippedCount,
    IReadOnlyList<BulkScanAuditItemResultDto> Results
);
