using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Hosting;

namespace WhereHouse.Client.E2ETests;

public class WhereHouseE2EServerFixture : WebApplicationFactory<Program>
{
    private readonly string _databaseName = "TestDb_E2E_" + Guid.NewGuid();
    private readonly string _storageRoot = Path.Combine(
        Path.GetTempPath(),
        "WhereHouse_E2E_" + Guid.NewGuid().ToString("N")
    );
    private WebApplication? _kestrelApp;

    public string RootUri { get; private set; } = string.Empty;

    public static string FindSolutionDirectory()
    {
        var current = new DirectoryInfo(AppContext.BaseDirectory);
        while (current != null)
        {
            if (
                File.Exists(Path.Combine(current.FullName, "WhereHouse.slnx"))
                || File.Exists(Path.Combine(current.FullName, "WhereHouse.sln"))
            )
            {
                return current.FullName;
            }
            current = current.Parent;
        }
        throw new InvalidOperationException(
            "Could not locate WhereHouse.slnx from " + AppContext.BaseDirectory
        );
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        Directory.CreateDirectory(_storageRoot);

        var solutionDir = FindSolutionDirectory();
        var clientDist = Path.Combine(
            solutionDir,
            "WhereHouse.Client",
            "dist",
            "WhereHouse.Client",
            "browser"
        );

        builder.UseEnvironment("Testing");
        if (Directory.Exists(clientDist))
        {
            builder.UseWebRoot(clientDist);
        }

        builder.UseSetting("UseInMemoryDatabase", "true");
        builder.UseSetting("InMemoryDatabaseName", _databaseName);
        builder.UseSetting(
            "Authentication:Jwt:Secret",
            "Test_Secret_Key_For_WhereHouse_Integration_Tests_12345!"
        );
        builder.UseSetting("Authentication:Jwt:Issuer", "WhereHouse");
        builder.UseSetting("Authentication:Jwt:Audience", "WhereHouse");
        builder.UseSetting("Authentication:Oidc:Enabled", "false");
        builder.UseSetting("FileStorage:RootPath", _storageRoot);
    }

    protected override IHost CreateHost(IHostBuilder builder)
    {
        var testHost = builder.Build();
        testHost.Start();

        var client = testHost.GetTestServer().CreateClient();

        var kestrelBuilder = WebApplication.CreateBuilder();
        kestrelBuilder.WebHost.UseKestrel(o => o.Listen(IPAddress.Loopback, 0));
        _kestrelApp = kestrelBuilder.Build();

        _kestrelApp.Run(async ctx =>
        {
            var targetUri = new Uri(
                client.BaseAddress!,
                ctx.Request.Path + ctx.Request.QueryString
            );
            using var req = new HttpRequestMessage(new HttpMethod(ctx.Request.Method), targetUri);

            foreach (var h in ctx.Request.Headers)
            {
                if (h.Key.StartsWith(':'))
                    continue;
                if (h.Key.Equals("Host", StringComparison.OrdinalIgnoreCase))
                    continue;
                req.Headers.TryAddWithoutValidation(h.Key, h.Value.ToArray());
            }

            if (ctx.Request.ContentLength > 0 || !string.IsNullOrEmpty(ctx.Request.ContentType))
            {
                req.Content = new StreamContent(ctx.Request.Body);
                if (!string.IsNullOrEmpty(ctx.Request.ContentType))
                {
                    req.Content.Headers.TryAddWithoutValidation(
                        "Content-Type",
                        ctx.Request.ContentType
                    );
                }
            }

            using var resp = await client.SendAsync(req, HttpCompletionOption.ResponseHeadersRead);
            ctx.Response.StatusCode = (int)resp.StatusCode;

            foreach (var h in resp.Headers)
            {
                ctx.Response.Headers[h.Key] = h.Value.ToArray();
            }
            foreach (var h in resp.Content.Headers)
            {
                ctx.Response.Headers[h.Key] = h.Value.ToArray();
            }

            await resp.Content.CopyToAsync(ctx.Response.Body);
        });

        _kestrelApp.Start();
        RootUri = _kestrelApp.Urls.First();

        return testHost;
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (disposing)
        {
            _kestrelApp?.DisposeAsync().AsTask().GetAwaiter().GetResult();
            if (Directory.Exists(_storageRoot))
            {
                try
                {
                    Directory.Delete(_storageRoot, true);
                }
                catch
                {
                    // Ignore temp directory cleanup errors
                }
            }
        }
    }
}
