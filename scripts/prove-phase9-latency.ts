import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';

const origin = process.env.APP_ORIGIN;
if (origin !== 'http://127.0.0.1:3400') throw Error('Isolated localhost app required');
// Each plan turn performs several MCP calls; keep this probe below the
// per-user MCP request budget rather than bypassing the production guard.
const count = 12;
const percentile = (samples: number[], p: number) => {
  const sorted = [...samples].sort((a, b) => a - b);
  return Math.round(sorted[Math.ceil(sorted.length * p) - 1]);
};
const request = async (path: string, cookie: string, method: 'GET' | 'POST', body?: unknown) => {
  const start = performance.now();
  const response = await fetch(origin + path, {
    method,
    headers: { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID() },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json();
  assert.equal(response.status, 200, `${path}: ${JSON.stringify(payload).slice(0, 120)}`);
  return { payload, elapsed: performance.now() - start, response };
};

const created = await request('/api/demo', '', 'POST', { fixture: 'cat_dog_new_cat', retention_acknowledged: true });
const cookies = created.response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
assert.ok(cookies.includes('denlumi_session='));
const householdId = created.payload.householdId as string;
const ordinaryReads: number[] = [];
const currentPlanMcp: number[] = [];
for (let i = 0; i < count; i++) {
  const graph = await request(`/api/households/${householdId}/graph`, cookies, 'GET');
  assert.equal(graph.payload.household.fictional, true);
  ordinaryReads.push(graph.elapsed);
  const turn = await request('/api/assistant/turn', cookies, 'POST', {
    household_id: householdId,
    intent: 'current_plan',
    message: 'Retrieve the fictional current state.',
    use_model: false,
  });
  assert.equal(turn.payload.brief.protocol_status, 'demo_only');
  assert.equal(turn.payload.provider.status, 'not_requested');
  assert.ok(turn.payload.trace.some((row: { method: string; tool_name?: string; http_status: number }) => row.method === 'tools/call' && row.tool_name === 'get_household_brief' && row.http_status === 200));
  currentPlanMcp.push(turn.elapsed);
}
const output = {
  checked_at: new Date().toISOString(),
  environment: 'localhost production Next.js server, local Supabase, serial requests, fictional demo household, model disabled',
  sample_size_each: count,
  ordinary_graph_http_ms: { median: percentile(ordinaryReads, 0.5), p95: percentile(ordinaryReads, 0.95), max: Math.round(Math.max(...ordinaryReads)), target_p95_ms: 800 },
  current_plan_mcp_http_ms: { median: percentile(currentPlanMcp, 0.5), p95: percentile(currentPlanMcp, 0.95), max: Math.round(Math.max(...currentPlanMcp)) },
  limits: 'No live provider, audio, first-response UI feedback, local Stop p95, supported-device or network latency measured. These localhost measurements are not a production SLA.',
};
await mkdir('evidence/phase9', { recursive: true });
await writeFile('evidence/phase9/latency.json', JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output));
