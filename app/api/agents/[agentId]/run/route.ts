import { runAgent, type AgentId } from "../../../../../lib/agent-runtime";

const validAgents = new Set(["orchestrator", "product-white-bg", "hollow-look", "virtual-try-on", "snap-change-video"]);

export async function POST(request: Request, context: { params: Promise<{ agentId: string }> }) {
  const { agentId } = await context.params;
  if (!validAgents.has(agentId)) return Response.json({ error: "未知智能体" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (!body || body.input === undefined) return Response.json({ error: "缺少 input 字段" }, { status: 400 });

  const result = await runAgent(agentId as AgentId, body, Number(body.retryLimit ?? 2));
  return Response.json(result, { status: result.status === "failed" ? 502 : 200 });
}
