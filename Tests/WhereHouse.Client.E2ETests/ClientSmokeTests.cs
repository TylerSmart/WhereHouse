using Microsoft.Playwright.MSTest;

namespace WhereHouse.Client.E2ETests;

[TestClass]
public sealed class ClientSmokeTests : PageTest
{
    private static WhereHouseE2EServerFixture? _fixture;

    [ClassInitialize]
    public static void ClassInit(TestContext context)
    {
        _fixture = new WhereHouseE2EServerFixture();
        // Force server creation
        _ = _fixture.CreateClient();
    }

    [ClassCleanup]
    public static void ClassCleanup()
    {
        _fixture?.Dispose();
    }

    [TestMethod]
    public async Task CanLoadIndexHtml()
    {
        Assert.IsNotNull(_fixture);
        Assert.IsFalse(string.IsNullOrEmpty(_fixture.RootUri));

        await Page.GotoAsync(_fixture.RootUri);
        var title = await Page.TitleAsync();
        Assert.IsNotNull(title);
    }
}
