import { runAgent, type AgentRunResult } from "../../../../lib/agent-runtime";

type LookInput = { id?: string; productImages: unknown[]; notes?: string };

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as null | {
    looks?: LookInput[];
    identityReference?: unknown;
    motionReference?: unknown;
    prompts?: Record<string, string>;
    parameters?: Record<string, Record<string, unknown>>;
    connections?: Record<string, { url?: string; token?: string }>;
    retryLimit?: number;
  };

  if (!body?.looks?.length) return Response.json({ error: "至少需要一套 looks，且每套包含 productImages" }, { status: 400 });

  const parentTaskId = `fashion_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const children: AgentRunResult[] = [];

  const retryLimit = Math.max(0, Math.min(3, Number(body.retryLimit ?? 2)));
  const planResult = await runAgent("orchestrator", {
    taskId: parentTaskId,
    input: { phase: "plan", looks: body.looks, identityReference: body.identityReference, motionReference: body.motionReference },
    prompt: body.prompts?.orchestrator,
    connection: body.connections?.orchestrator,
    metadata: { role: "parent", phase: "plan" },
  }, retryLimit);
  children.push(planResult);
  if (planResult.status !== "succeeded") return Response.json({ parentTaskId, status: "failed", stage: 0, children }, { status: 502 });

  const whiteResults = await Promise.all(body.looks.flatMap((look, lookIndex) =>
    (look.productImages || []).map((image, productIndex) => runAgent("product-white-bg", {
      parentTaskId,
      input: { image, lookId: look.id || `look-${lookIndex + 1}`, productIndex },
      prompt: body.prompts?.["product-white-bg"],
      parameters: body.parameters?.["product-white-bg"],
      connection: body.connections?.["product-white-bg"],
    }, retryLimit)),
  ));
  children.push(...whiteResults);
  if (whiteResults.some((item) => item.status !== "succeeded")) return Response.json({ parentTaskId, status: "failed", stage: 1, children }, { status: 502 });

  let cursor = 0;
  const hollowResults: AgentRunResult[] = [];
  for (let index = 0; index < body.looks.length; index += 1) {
    const look = body.looks[index];
    const count = look.productImages.length;
    const products = whiteResults.slice(cursor, cursor + count).map((item) => item.output);
    cursor += count;
    const result = await runAgent("hollow-look", {
      parentTaskId,
      input: { lookId: look.id || `look-${index + 1}`, products, notes: look.notes },
      prompt: body.prompts?.["hollow-look"],
      parameters: body.parameters?.["hollow-look"],
      connection: body.connections?.["hollow-look"],
    }, retryLimit);
    hollowResults.push(result);
    children.push(result);
    if (result.status !== "succeeded") return Response.json({ parentTaskId, status: "failed", stage: 2, children }, { status: 502 });
  }

  const videoResult = await runAgent("snap-change-video", {
    parentTaskId,
    input: {
      looks: hollowResults.map((item) => item.output),
      identityReference: body.identityReference,
      motionReference: body.motionReference,
    },
    prompt: body.prompts?.["snap-change-video"],
    parameters: body.parameters?.["snap-change-video"],
    connection: body.connections?.["snap-change-video"],
  }, retryLimit);
  children.push(videoResult);

  if (videoResult.status === "succeeded") {
    const reviewResult = await runAgent("orchestrator", {
      parentTaskId,
      input: { phase: "final-review", plan: planResult.output, video: videoResult.output, taskTree: children },
      prompt: body.prompts?.orchestrator,
      connection: body.connections?.orchestrator,
      metadata: { role: "parent", phase: "final-review" },
    }, retryLimit);
    children.push(reviewResult);
    if (reviewResult.status !== "succeeded") return Response.json({ parentTaskId, status: "failed", stage: 4, output: videoResult.output, children }, { status: 502 });
  }

  return Response.json({
    parentTaskId,
    status: videoResult.status,
    stage: 3,
    output: videoResult.output,
    children,
  }, { status: videoResult.status === "failed" ? 502 : 200 });
}
