using System.Text.Json;
using CWM.RoslynNavigator.Responses;
using CWM.RoslynNavigator.Tests.Fixtures;
using CWM.RoslynNavigator.Tools;

namespace CWM.RoslynNavigator.Tests.Tools;

public class FindDeadCodeTests(TestSolutionFixture fixture) : IClassFixture<TestSolutionFixture>
{
    [Fact]
    public async Task FindDeadCode_Solution_FindsUnusedTypes()
    {
        var json = await FindDeadCodeTool.ExecuteAsync(
            fixture.WorkspaceManager, scope: "solution",
            ct: TestContext.Current.CancellationToken);
        var result = JsonSerializer.Deserialize<DeadCodeResult>(json)!;

        // UnusedHelper is intentionally unreferenced
        Assert.True(result.Count > 0, "Expected at least one dead code symbol");
        Assert.Contains(result.Symbols, s => s.Name == "UnusedHelper");
    }

    [Fact]
    public async Task FindDeadCode_ProjectScope_FiltersCorrectly()
    {
        var json = await FindDeadCodeTool.ExecuteAsync(
            fixture.WorkspaceManager, scope: "project", path: "SampleDomain",
            ct: TestContext.Current.CancellationToken);
        var result = JsonSerializer.Deserialize<DeadCodeResult>(json)!;

        // All results should be from SampleDomain
        Assert.All(result.Symbols, s =>
            Assert.Contains("SampleDomain", s.File, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public async Task FindDeadCode_TypeFilter_OnlyReturnsTypes()
    {
        var json = await FindDeadCodeTool.ExecuteAsync(
            fixture.WorkspaceManager, scope: "solution", kind: "type",
            ct: TestContext.Current.CancellationToken);
        var result = JsonSerializer.Deserialize<DeadCodeResult>(json)!;

        Assert.All(result.Symbols, s =>
            Assert.True(s.Kind is "class" or "struct" or "interface" or "record",
                $"Expected type kind, got {s.Kind}"));
    }

    [Fact]
    public async Task FindDeadCode_MethodFilter_OnlyReturnsMethods()
    {
        var json = await FindDeadCodeTool.ExecuteAsync(
            fixture.WorkspaceManager, scope: "solution", kind: "method",
            ct: TestContext.Current.CancellationToken);
        var result = JsonSerializer.Deserialize<DeadCodeResult>(json)!;

        Assert.All(result.Symbols, s => Assert.Equal("method", s.Kind));
    }

    [Fact]
    public async Task FindDeadCode_MaxResults_LimitsOutput()
    {
        var json = await FindDeadCodeTool.ExecuteAsync(
            fixture.WorkspaceManager, scope: "solution", maxResults: 2,
            ct: TestContext.Current.CancellationToken);
        var result = JsonSerializer.Deserialize<DeadCodeResult>(json)!;

        Assert.True(result.Count <= 2);
        Assert.True(result.TotalFound >= result.Count);
    }

    [Fact]
    public async Task FindDeadCode_SkipsPublicApi()
    {
        var json = await FindDeadCodeTool.ExecuteAsync(
            fixture.WorkspaceManager, scope: "solution",
            ct: TestContext.Current.CancellationToken);
        var result = JsonSerializer.Deserialize<DeadCodeResult>(json)!;

        // Public types should NOT be flagged as dead code
        Assert.DoesNotContain(result.Symbols, s => s.Name == "Order");
        Assert.DoesNotContain(result.Symbols, s => s.Name == "Product");
        Assert.DoesNotContain(result.Symbols, s => s.Name == "IOrderRepository");
    }

    [Fact]
    public async Task FindDeadCode_SkipsInterfaceImplementations()
    {
        var json = await FindDeadCodeTool.ExecuteAsync(
            fixture.WorkspaceManager, scope: "solution", kind: "method",
            ct: TestContext.Current.CancellationToken);
        var result = JsonSerializer.Deserialize<DeadCodeResult>(json)!;

        // Interface implementation methods should not be flagged
        Assert.DoesNotContain(result.Symbols, s =>
            s.Name == "GetByIdAsync" && s.ContainingType == "InMemoryOrderRepository");
    }
}
