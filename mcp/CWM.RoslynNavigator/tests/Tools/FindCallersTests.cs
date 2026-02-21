using System.Text.Json;
using CWM.RoslynNavigator.Responses;
using CWM.RoslynNavigator.Tests.Fixtures;
using CWM.RoslynNavigator.Tools;

namespace CWM.RoslynNavigator.Tests.Tools;

public class FindCallersTests(TestSolutionFixture fixture) : IClassFixture<TestSolutionFixture>
{
    [Fact]
    public async Task FindCallers_MethodCalledFromService_ReturnsCallers()
    {
        var json = await FindCallersTool.ExecuteAsync(
            fixture.WorkspaceManager, "GetByIdAsync", ct: TestContext.Current.CancellationToken);
        var result = JsonSerializer.Deserialize<CallersResult>(json)!;

        // GetByIdAsync is called from OrderService and CachedOrderRepository
        Assert.True(result.Count > 0, "Expected callers of GetByIdAsync");
    }

    [Fact]
    public async Task FindCallers_WithClassName_DisambiguatesCorrectly()
    {
        var json = await FindCallersTool.ExecuteAsync(
            fixture.WorkspaceManager, "Cancel", className: "Order",
            ct: TestContext.Current.CancellationToken);
        var result = JsonSerializer.Deserialize<CallersResult>(json)!;

        // Order.Cancel() is called from OrderService.CancelOrderAsync
        Assert.True(result.Count > 0, "Expected callers of Order.Cancel");
        Assert.Contains(result.Callers, c => c.ContainingType == "OrderService");
    }

    [Fact]
    public async Task FindCallers_NonexistentMethod_ReturnsEmpty()
    {
        var json = await FindCallersTool.ExecuteAsync(
            fixture.WorkspaceManager, "MethodThatDoesNotExist12345",
            ct: TestContext.Current.CancellationToken);
        var result = JsonSerializer.Deserialize<CallersResult>(json)!;

        Assert.Equal(0, result.Count);
    }

    [Fact]
    public async Task FindCallers_FactoryMethod_ReturnsCallers()
    {
        var json = await FindCallersTool.ExecuteAsync(
            fixture.WorkspaceManager, "Create", className: "Order",
            ct: TestContext.Current.CancellationToken);
        var result = JsonSerializer.Deserialize<CallersResult>(json)!;

        // Order.Create is called from OrderService.CreateOrderAsync
        Assert.True(result.Count > 0, "Expected callers of Order.Create");
    }
}
