namespace SampleDomain;

/// <summary>
/// Intentionally unused type for testing find_dead_code tool.
/// DO NOT reference this type — it is a test fixture.
/// </summary>
internal class UnusedHelper
{
    internal void DoNothing()
    {
        // This method is intentionally unused
    }

    internal static string FormatUnused(string input) => input.Trim();
}
