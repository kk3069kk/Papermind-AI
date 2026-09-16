export function extractSection(text: string, tag: string): string {
  const pattern = new RegExp(`${tag}[:\\s]*([\\s\\S]*?)(?=\\n\\d+\\.|$)`, "i");
  const match = text.match(pattern);
  return match?.[1]?.trim() || "";
}

export function parseSummaryResponse(paper: { id: number; title: string }, text: string) {
  const summary = extractSection(text, "SUMMARY") || text.slice(0, 500);
  const methodology = extractSection(text, "METHODOLOGY");
  const results = extractSection(text, "RESULTS");
  const limitations = extractSection(text, "LIMITATIONS");
  const contributionsBlock = extractSection(text, "KEY_CONTRIBUTIONS");
  const contributions = contributionsBlock
    .split("\n")
    .map((l) => l.replace(/^[•\-]\s*/, "").trim())
    .filter(Boolean);
  return {
    paper_id: paper.id,
    title: paper.title,
    summary,
    key_contributions: contributions.length ? contributions : [contributionsBlock],
    methodology,
    results,
    limitations,
  };
}
