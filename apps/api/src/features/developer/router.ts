import type { RequestHandler } from "express";
import { Router } from "express";
import { parseApiEnv } from "@celeris/shared";
import { badRequest, unauthorized } from "../../lib/http-error";
import { DeveloperSetupService, getRuntimeDeveloperSetupService } from "./service";

export interface DeveloperRouterOptions {
  service?: DeveloperSetupService;
}

function getService(options?: DeveloperRouterOptions) {
  if (options?.service) {
    return options.service;
  }

  const env = parseApiEnv(process.env);
  return getRuntimeDeveloperSetupService({
    apiOrigin: env.API_ORIGIN,
    hostedAuthOrigin: env.CELERIS_HOSTED_AUTH_ORIGIN,
    encryptionKey: env.CELERIS_APP_ENCRYPTION_KEY
  });
}

function extractBearerToken(authorizationHeader: string | undefined) {
  if (!authorizationHeader) {
    throw unauthorized();
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw unauthorized();
  }

  return token;
}

function requireRouteParam(value: string | string[] | undefined, label: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw badRequest(`Missing ${label}`);
  }

  return value;
}

function createDeveloperAuthMiddleware(resolveService: () => DeveloperSetupService): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = extractBearerToken(req.header("authorization"));
      const developer = await resolveService().authenticateDeveloper(token);
      res.locals.developer = developer;
      res.locals.developerToken = token;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function createDeveloperRouter(options?: DeveloperRouterOptions) {
  const router = Router();
  const resolveService = () => getService(options);
  const developerAuth = createDeveloperAuthMiddleware(resolveService);

  router.post("/v1/developer/sign-up", async (req, res) => {
    const session = await resolveService().signUp(req.body);
    res.status(201).json(session);
  });

  router.post("/v1/developer/sign-in", async (req, res) => {
    const session = await resolveService().signIn(req.body);
    res.status(200).json(session);
  });

  router.post("/v1/developer/sign-out", developerAuth, async (_req, res) => {
    const token = res.locals.developerToken as string;
    await resolveService().signOut(token);
    res.status(204).end();
  });

  router.get("/v1/developer/apps", developerAuth, async (_req, res) => {
    const developer = res.locals.developer as { id: string };
    const apps = await resolveService().listApps(developer.id);
    res.status(200).json({ apps });
  });

  router.post("/v1/developer/apps", developerAuth, async (req, res) => {
    const developer = res.locals.developer as { id: string };
    const app = await resolveService().createApp(developer.id, req.body);
    res.status(201).json({ app });
  });

  router.get("/v1/developer/apps/:appId", developerAuth, async (req, res) => {
    const developer = res.locals.developer as { id: string };
    const app = await resolveService().getApp(developer.id, requireRouteParam(req.params.appId, "appId"));
    res.status(200).json({ app });
  });

  router.post("/v1/developer/apps/:appId/sponsor-wallet", developerAuth, async (req, res) => {
    const developer = res.locals.developer as { id: string };
    const sponsorWallet = await resolveService().provisionSponsorWallet(
      developer.id,
      requireRouteParam(req.params.appId, "appId")
    );
    res.status(201).json({ sponsorWallet });
  });

  router.get("/v1/developer/apps/:appId/sponsor-wallet", developerAuth, async (req, res) => {
    const developer = res.locals.developer as { id: string };
    const sponsorWallet = await resolveService().getSponsorWallet(
      developer.id,
      requireRouteParam(req.params.appId, "appId")
    );
    res.status(200).json({ sponsorWallet });
  });

  router.put("/v1/developer/apps/:appId/program", developerAuth, async (req, res) => {
    const developer = res.locals.developer as { id: string };
    const registeredProgram = await resolveService().registerProgram(
      developer.id,
      requireRouteParam(req.params.appId, "appId"),
      req.body
    );
    res.status(200).json({ registeredProgram });
  });

  router.get("/v1/developer/apps/:appId/program", developerAuth, async (req, res) => {
    const developer = res.locals.developer as { id: string };
    const registeredProgram = await resolveService().getRegisteredProgram(
      developer.id,
      requireRouteParam(req.params.appId, "appId")
    );
    res.status(200).json({ registeredProgram });
  });

  router.put("/v1/developer/apps/:appId/actions/say_hello", developerAuth, async (req, res) => {
    const developer = res.locals.developer as { id: string };
    const sayHelloAction = await resolveService().configureSayHello(
      developer.id,
      requireRouteParam(req.params.appId, "appId"),
      req.body
    );
    res.status(200).json({ sayHelloAction });
  });

  return router;
}
