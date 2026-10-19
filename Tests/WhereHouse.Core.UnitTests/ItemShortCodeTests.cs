using WhereHouse.Core.Items;

namespace WhereHouse.Core.UnitTests;

[TestClass]
public sealed class ItemShortCodeTests
{
    [TestMethod]
    public void NormalizeShortCode_TrimsAndConvertsToUppercase()
    {
        var normalized = ItemShortCodeGenerator.NormalizeShortCode("  itm-1049  ");
        Assert.AreEqual("ITM-1049", normalized);
    }

    [TestMethod]
    public void GenerateNextShortCode_EmptyList_Returns001()
    {
        var code = ItemShortCodeGenerator.GenerateNextShortCode([]);
        Assert.AreEqual("ITM-001", code);
    }

    [TestMethod]
    public void GenerateNextShortCode_ExistingCodes_GeneratesNextSequential()
    {
        var existing = new[] { "ITM-001", "ITM-002", "ITM-042", "OTHER-CODE" };
        var nextCode = ItemShortCodeGenerator.GenerateNextShortCode(existing);
        Assert.AreEqual("ITM-043", nextCode);
    }
}
