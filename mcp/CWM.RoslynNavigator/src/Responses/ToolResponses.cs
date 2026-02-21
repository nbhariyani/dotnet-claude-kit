namespace CWM.RoslynNavigator.Responses;

/// <summary>
/// Token-optimized response records for MCP tools.
/// All responses use minimal property names and avoid unnecessary nesting.
/// </summary>

public record SymbolLocation(string Name, string Kind, string File, int Line, string Namespace);

public record SymbolSearchResult(List<SymbolLocation> Symbols);

public record ReferenceLocation(string File, int Line, string Snippet, string Kind);

public record ReferencesResult(List<ReferenceLocation> References, int Count);

public record ImplementationInfo(string Type, string File, int Line);

public record ImplementationsResult(List<ImplementationInfo> Implementations);

public record TypeHierarchyResult(
    List<string> BaseTypes,
    List<string> Interfaces,
    List<string> DerivedTypes);

public record ProjectInfo(
    string Name,
    string Path,
    string TargetFramework,
    List<string> References);

public record ProjectGraphResult(string Solution, List<ProjectInfo> Projects);

public record MemberInfo(string Kind, string Signature, string Accessibility);

public record PublicApiResult(string Type, List<MemberInfo> Members);

public record DiagnosticInfo(string Id, string Severity, string Message, string File, int Line);

public record DiagnosticsResult(List<DiagnosticInfo> Diagnostics, int Count);

public record StatusResponse(string State, string Message);

public record CallerInfo(string Method, string ContainingType, string File, int Line);

public record CallersResult(List<CallerInfo> Callers, int Count);

public record OverrideInfo(string Method, string ContainingType, string File, int Line);

public record OverridesResult(List<OverrideInfo> Overrides, int Count);

public record ParameterDetail(string Name, string Type, string? DefaultValue);

public record SymbolDetail(
    string Name,
    string Kind,
    string Signature,
    string? ReturnType,
    string Accessibility,
    string? Namespace,
    List<ParameterDetail>? Parameters,
    string? XmlDoc,
    string File,
    int Line);

public record AntiPatternInfo(
    string Id,
    string Severity,
    string Message,
    string File,
    int Line,
    string Snippet,
    string Suggestion);

public record AntiPatternsResult(List<AntiPatternInfo> Violations, int Count, int TotalFound);
