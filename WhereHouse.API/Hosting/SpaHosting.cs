namespace WhereHouse.API.Hosting;

public static class SpaHosting
{
    public static bool HasIndexHtml(string? webRootPath) =>
        !string.IsNullOrWhiteSpace(webRootPath)
        && File.Exists(Path.Combine(webRootPath, "index.html"));
}
