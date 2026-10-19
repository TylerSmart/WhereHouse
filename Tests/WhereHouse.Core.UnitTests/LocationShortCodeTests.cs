using WhereHouse.Core.Locations;

namespace WhereHouse.Core.UnitTests;

[TestClass]
public sealed class LocationShortCodeTests
{
    [TestMethod]
    public void GetPrefix_ReturnsExpectedPrefix()
    {
        Assert.AreEqual(
            "LOC",
            LocationShortCodeGenerator.GetPrefix(LocationNodeType.FixedLocation)
        );
        Assert.AreEqual(
            "BIN",
            LocationShortCodeGenerator.GetPrefix(LocationNodeType.MovableContainer)
        );
    }

    [TestMethod]
    public void NormalizeShortCode_TrimsAndConvertsToUppercase()
    {
        var normalized = LocationShortCodeGenerator.NormalizeShortCode("  bin-042  ");
        Assert.AreEqual("BIN-042", normalized);
    }

    [TestMethod]
    public void GenerateNextShortCode_EmptyList_Returns001()
    {
        var locCode = LocationShortCodeGenerator.GenerateNextShortCode(
            LocationNodeType.FixedLocation,
            []
        );
        var binCode = LocationShortCodeGenerator.GenerateNextShortCode(
            LocationNodeType.MovableContainer,
            []
        );

        Assert.AreEqual("LOC-001", locCode);
        Assert.AreEqual("BIN-001", binCode);
    }

    [TestMethod]
    public void GenerateNextShortCode_ExistingCodes_GeneratesNextSequential()
    {
        var existing = new[] { "LOC-001", "LOC-002", "BIN-001", "BIN-005", "CUSTOM-CODE" };

        var nextLoc = LocationShortCodeGenerator.GenerateNextShortCode(
            LocationNodeType.FixedLocation,
            existing
        );
        var nextBin = LocationShortCodeGenerator.GenerateNextShortCode(
            LocationNodeType.MovableContainer,
            existing
        );

        Assert.AreEqual("LOC-003", nextLoc);
        Assert.AreEqual("BIN-006", nextBin);
    }
}
