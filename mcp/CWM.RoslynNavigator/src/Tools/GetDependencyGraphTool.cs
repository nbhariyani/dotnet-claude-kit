using System.ComponentModel;
using System.Text.Json;
using CWM.RoslynNavigator.Responses;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using ModelContextProtocol.Server;

namespace CWM.RoslynNavigator.Tools;

[McpServerToolType]
public static class GetDependencyGraphTool
{
    [McpServerTool(Name = "get_dependency_graph"), Description("Get the call dependency graph for a method, showing all methods it calls recursively up to a specified depth. Useful for impact analysis and understanding code flow.")]
    public static async Task<string> ExecuteAsync(
        WorkspaceManager workspace,
        [Description("The method name to analyze")] string symbolName,
        [Description("Optional: file path to disambiguate")] string? file = null,
        [Description("Optional: line number to disambiguate")] int? line = null,
        [Description("Maximum recursion depth (1-5)")] int depth = 3,
        CancellationToken ct = default)
    {
        if (workspace.State != WorkspaceState.Ready)
            return JsonSerializer.Serialize(new StatusResponse(workspace.State.ToString(), workspace.GetStatusMessage()));

        var solution = workspace.GetSolution();
        if (solution is null)
            return JsonSerializer.Serialize(new DependencyGraphResult("unknown", [], 0));

        var symbol = await SymbolResolver.ResolveSymbolAsync(workspace, symbolName, file, line, ct);
        if (symbol is not IMethodSymbol rootMethod)
            return JsonSerializer.Serialize(new DependencyGraphResult(symbolName, [], 0));

        depth = Math.Clamp(depth, 1, 5);

        var visited = new HashSet<string>();
        var dependencies = new List<DependencyNode>();

        await WalkDependenciesAsync(workspace, solution, rootMethod, 1, depth, visited, dependencies, ct);

        return JsonSerializer.Serialize(new DependencyGraphResult(
            RootSymbol: rootMethod.ToDisplayString(SymbolDisplayFormat.MinimallyQualifiedFormat),
            Dependencies: dependencies,
            TotalNodes: dependencies.Count));
    }

    private static async Task WalkDependenciesAsync(
        WorkspaceManager workspace,
        Solution solution,
        IMethodSymbol method,
        int currentDepth,
        int maxDepth,
        HashSet<string> visited,
        List<DependencyNode> dependencies,
        CancellationToken ct)
    {
        if (currentDepth > maxDepth) return;

        ct.ThrowIfCancellationRequested();

        var syntaxRef = method.DeclaringSyntaxReferences.FirstOrDefault();
        if (syntaxRef is null) return;

        var syntax = await syntaxRef.GetSyntaxAsync(ct);
        var tree = syntaxRef.SyntaxTree;

        // Find the project containing this syntax tree
        var project = solution.Projects.FirstOrDefault(p =>
            p.Documents.Any(d => d.FilePath == tree.FilePath));
        if (project is null) return;

        var compilation = await workspace.GetCompilationAsync(project.Id, ct);
        if (compilation is null) return;

        var semanticModel = compilation.GetSemanticModel(tree);

        // Find all invocation expressions in the method body
        var invocations = syntax.DescendantNodes().OfType<InvocationExpressionSyntax>();

        foreach (var invocation in invocations)
        {
            ct.ThrowIfCancellationRequested();

            var symbolInfo = semanticModel.GetSymbolInfo(invocation, ct);
            if (symbolInfo.Symbol is not IMethodSymbol calledMethod) continue;

            // Skip system/framework methods
            var ns = calledMethod.ContainingNamespace?.ToDisplayString() ?? "";
            if (ns.StartsWith("System") || ns.StartsWith("Microsoft")) continue;

            var displayString = calledMethod.ToDisplayString();
            if (visited.Contains(displayString)) continue;
            visited.Add(displayString);

            var location = SymbolResolver.GetLocation(calledMethod);
            dependencies.Add(new DependencyNode(
                Symbol: calledMethod.Name,
                ContainingType: calledMethod.ContainingType?.Name ?? "unknown",
                File: location.HasValue ? MakeRelativePath(location.Value.File) : "external",
                Line: location?.Line ?? 0,
                Depth: currentDepth));

            // Recurse if the method has source
            if (calledMethod.DeclaringSyntaxReferences.Length > 0)
            {
                await WalkDependenciesAsync(workspace, solution, calledMethod,
                    currentDepth + 1, maxDepth, visited, dependencies, ct);
            }
        }
    }

    private static string MakeRelativePath(string filePath)
    {
        var parts = filePath.Replace('\\', '/').Split('/');
        return parts.Length >= 2 ? $"{parts[^2]}/{parts[^1]}" : parts[^1];
    }
}
