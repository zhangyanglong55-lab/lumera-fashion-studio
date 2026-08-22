import { agentConnectionStatus } from "../../../../lib/agent-runtime";

export async function GET() {
  return Response.json({ agents: agentConnectionStatus() });
}
