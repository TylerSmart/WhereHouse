namespace WhereHouse.Core.Storage;

public sealed class FileStorageOptions
{
    public const string SectionName = "FileStorage";

    public string RootPath { get; set; } = "App_Data/uploads";

    public long MaxFileSizeBytes { get; set; } = 50L * 1024L * 1024L; // 50 MB
}

public sealed record StoredFileResult(
    string StorageRelativePath,
    string SanitizedFileName,
    long FileSizeBytes
);

public static class FileNameSanitizer
{
    private static readonly char[] InvalidChars = Path.GetInvalidFileNameChars();

    public static string Sanitize(string? rawFileName)
    {
        if (string.IsNullOrWhiteSpace(rawFileName))
        {
            return "attachment.bin";
        }

        var fileNameOnly = Path.GetFileName(rawFileName.Trim());
        var sanitized = new string(
            fileNameOnly.Select(ch => InvalidChars.Contains(ch) ? '_' : ch).ToArray()
        ).Trim();

        if (string.IsNullOrWhiteSpace(sanitized) || sanitized.All(ch => ch is '.' or '_'))
        {
            return "attachment.bin";
        }

        if (sanitized.Length > 200)
        {
            var ext = Path.GetExtension(sanitized);
            if (ext.Length > 0 && ext.Length < 20)
            {
                var baseName = sanitized[..^ext.Length];
                var maxBaseLen = 200 - ext.Length;
                sanitized =
                    (baseName.Length > maxBaseLen ? baseName[..maxBaseLen] : baseName) + ext;
            }
            else
            {
                sanitized = sanitized[..200];
            }
        }

        return sanitized;
    }
}
