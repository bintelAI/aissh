interface AgentSummaryEnvelope {
  summary?: unknown;
  thought?: unknown;
  command?: unknown;
  isDone?: unknown;
}

function parseAgentSummary(candidate: string, prefix: string): string | null {
  const end = candidate.lastIndexOf('}');
  if (end < 0) return null;

  try {
    const parsed = JSON.parse(candidate.slice(0, end + 1)) as AgentSummaryEnvelope;
    if (typeof parsed.summary !== 'string') return null;

    const hasAgentField = ['thought', 'command', 'isDone'].some((field) => field in parsed);
    return prefix === '' || prefix === '任务完成' || hasAgentField
      ? parsed.summary.trim()
      : null;
  } catch {
    return null;
  }
}

export function extractTaskSummary(output: string): string {
  const trimmed = output.trim();
  if (!trimmed) return '';

  const jsonStart = trimmed.indexOf('{');
  if (jsonStart < 0) return trimmed;

  const prefix = trimmed.slice(0, jsonStart).trim();
  const parsedSummary = parseAgentSummary(trimmed.slice(jsonStart), prefix);
  if (parsedSummary !== null) return parsedSummary;

  // Hide an incomplete agent envelope while the streamed JSON is still arriving.
  if (prefix === '' || prefix === '任务完成') return '';
  return trimmed;
}
