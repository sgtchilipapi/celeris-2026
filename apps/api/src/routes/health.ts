import { healthDiagnosticsResponseSchema, healthResponseSchema, parseApiEnv } from "@celeris/shared";
import { Router } from "express";

export const healthRouter = Router();

async function probeUrl(origin: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);

  try {
    const response = await fetch(origin, {
      ...init,
      signal: controller.signal
    });

    if (!response.ok) {
      return {
        status: "error" as const,
        error: `HTTP ${response.status}`
      };
    }

    return {
      status: "ok" as const
    };
  } catch (error) {
    return {
      status: "error" as const,
      error: error instanceof Error ? error.message : "probe failed"
    };
  } finally {
    clearTimeout(timeout);
  }
}

healthRouter.get("/health", (_req, res) => {
  const response = healthResponseSchema.parse({
    status: "ok",
    service: "api",
    requestId: res.locals.requestId as string
  });

  res.json(response);
});

healthRouter.get("/health/diagnostics", async (_req, res) => {
  const env = parseApiEnv(process.env);
  const [zkLoginProver, suiRpc] = await Promise.all([
    probeUrl(env.CELERIS_ZKLOGIN_PROVER_ORIGIN, {
      method: "GET"
    }),
    probeUrl(env.CELERIS_SUI_RPC_ORIGIN, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "sui_getLatestSuiSystemState",
        params: []
      })
    })
  ]);
  const status = zkLoginProver.status === "ok" && suiRpc.status === "ok" ? "ok" : "error";
  const response = healthDiagnosticsResponseSchema.parse({
    status,
    service: "api",
    requestId: res.locals.requestId as string,
    checks: {
      googleAuthConfiguration: {
        status: "ok",
        issuer: env.CELERIS_GOOGLE_ISSUER,
        redirectUri: env.CELERIS_GOOGLE_REDIRECT_URI
      },
      zkLoginProver: {
        status: zkLoginProver.status,
        origin: env.CELERIS_ZKLOGIN_PROVER_ORIGIN,
        error: zkLoginProver.error
      },
      suiRpc: {
        status: suiRpc.status,
        origin: env.CELERIS_SUI_RPC_ORIGIN,
        error: suiRpc.error
      }
    }
  });

  res.status(status === "ok" ? 200 : 503).json(response);
});
