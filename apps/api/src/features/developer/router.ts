import type { RequestHandler } from "express";
import { Router } from "express";
import { parseApiEnv } from "@celeris/shared";
import { badRequest, unauthorized } from "../../lib/http-error";
import { logger } from "../../lib/logger";
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
    developerAppOrigin: env.CELERIS_DEVELOPER_APP_ORIGIN,
    demoFrontendOrigin: env.CELERIS_DEMO_FRONTEND_ORIGIN,
    encryptionKey: env.CELERIS_APP_ENCRYPTION_KEY,
    googleClientId: env.CELERIS_GOOGLE_CLIENT_ID,
    googleClientSecret: env.CELERIS_GOOGLE_CLIENT_SECRET,
    googleRedirectUri: env.CELERIS_GOOGLE_REDIRECT_URI,
    googleIssuer: env.CELERIS_GOOGLE_ISSUER,
    zkLoginSaltSeed: env.CELERIS_ZKLOGIN_SALT_SEED,
    zkLoginProverOrigin: env.CELERIS_ZKLOGIN_PROVER_ORIGIN,
    zkLoginMaxEpochWindow: env.CELERIS_ZKLOGIN_MAX_EPOCH_WINDOW,
    suiRpcOrigin: env.CELERIS_SUI_RPC_ORIGIN
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

function requireQueryParam(value: unknown, label: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw badRequest(`Missing ${label}`);
  }

  return value;
}

function createDeveloperAuthMiddleware(resolveService: () => DeveloperSetupService): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = extractBearerToken(req.header("authorization"));
      const developerProfile = await resolveService().authenticateDeveloper(token);
      res.locals.developerProfile = developerProfile;
      res.locals.authToken = token;
      next();
    } catch (error) {
      next(error);
    }
  };
}

function createUserSessionMiddleware(resolveService: () => DeveloperSetupService): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = extractBearerToken(req.header("authorization"));
      const session = await resolveService().getSession(token);
      res.locals.userSession = session;
      res.locals.authToken = token;
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
  const userSession = createUserSessionMiddleware(resolveService);

  router.post("/v1/auth/login-requests", async (req, res) => {
    const loginRequest = await resolveService().createLoginRequest(req.body);
    res.status(201).json({ loginRequest });
  });

  router.get("/v1/auth/login-requests/:loginRequestId", async (req, res) => {
    const loginRequest = await resolveService().getLoginRequest(requireRouteParam(req.params.loginRequestId, "loginRequestId"));
    res.status(200).json({ loginRequest });
  });

  router.get("/v1/auth/google/start", async (req, res) => {
    const loginRequestId = requireQueryParam(req.query.loginRequestId, "loginRequestId");
    const result = await resolveService().startGoogleOAuth(loginRequestId);
    res.redirect(302, result.redirectTo);
  });

  router.get("/v1/auth/google/callback", async (req, res) => {
    const result = await resolveService().completeGoogleOAuth({
      code: requireQueryParam(req.query.code, "code"),
      state: requireQueryParam(req.query.state, "state")
    });
    res.redirect(302, result.redirectTo);
  });

  router.post("/v1/auth/login-requests/:loginRequestId/complete", async (req, res) => {
    const result = await resolveService().completeLoginRequest(requireRouteParam(req.params.loginRequestId, "loginRequestId"), req.body);
    res.status(200).json(result);
  });

  router.post("/v1/auth/token", async (req, res) => {
    const session = await resolveService().exchangeToken(req.body);
    logger.info("audit.auth.token_exchanged", {
      requestId: res.locals.requestId,
      clientKind: session.clientKind,
      clientId: session.clientId,
      appId: session.appId,
      userId: session.user.id,
      walletAddress: session.user.walletAddress
    });
    res.status(200).json({ session });
  });

  router.post("/v1/auth/logout", userSession, async (_req, res) => {
    const token = res.locals.authToken as string;
    await resolveService().signOut(token);
    res.status(204).end();
  });

  router.get("/v1/me", userSession, async (_req, res) => {
    res.status(200).json({ session: res.locals.userSession });
  });

  router.get("/v1/developer/me", developerAuth, async (_req, res) => {
    res.status(200).json({
      developerProfile: {
        id: res.locals.developerProfile.id,
        email: res.locals.developerProfile.email,
        displayName: res.locals.developerProfile.displayName
      }
    });
  });

  router.post("/v1/developer/profile", developerAuth, async (_req, res) => {
    const token = res.locals.authToken as string;
    const developerProfile = await resolveService().ensureDeveloperProfile(token);
    res.status(200).json({ developerProfile });
  });

  router.get("/v1/developer/apps", developerAuth, async (_req, res) => {
    const developerProfile = res.locals.developerProfile as { id: string };
    const apps = await resolveService().listApps(developerProfile.id);
    res.status(200).json({ apps });
  });

  router.post("/v1/developer/apps", developerAuth, async (req, res) => {
    const developerProfile = res.locals.developerProfile as { id: string };
    const app = await resolveService().createApp(developerProfile.id, req.body);
    res.status(201).json({ app });
  });

  router.get("/v1/developer/apps/:appId", developerAuth, async (req, res) => {
    const developerProfile = res.locals.developerProfile as { id: string };
    const app = await resolveService().getApp(developerProfile.id, requireRouteParam(req.params.appId, "appId"));
    res.status(200).json({ app });
  });

  router.post("/v1/developer/apps/:appId/sponsor-wallet", developerAuth, async (req, res) => {
    const developerProfile = res.locals.developerProfile as { id: string };
    const sponsorWallet = await resolveService().provisionSponsorWallet(
      developerProfile.id,
      requireRouteParam(req.params.appId, "appId")
    );
    logger.info("audit.sponsor_wallet.provisioned", {
      requestId: res.locals.requestId,
      developerProfileId: developerProfile.id,
      appId: req.params.appId,
      sponsorAddress: sponsorWallet.address
    });
    res.status(201).json({ sponsorWallet });
  });

  router.get("/v1/developer/apps/:appId/sponsor-wallet", developerAuth, async (req, res) => {
    const developerProfile = res.locals.developerProfile as { id: string };
    const sponsorWallet = await resolveService().getSponsorWallet(
      developerProfile.id,
      requireRouteParam(req.params.appId, "appId")
    );
    res.status(200).json({ sponsorWallet });
  });

  router.put("/v1/developer/apps/:appId/program", developerAuth, async (req, res) => {
    const developerProfile = res.locals.developerProfile as { id: string };
    const registeredProgram = await resolveService().registerProgram(
      developerProfile.id,
      requireRouteParam(req.params.appId, "appId"),
      req.body
    );
    logger.info("audit.program.registered", {
      requestId: res.locals.requestId,
      developerProfileId: developerProfile.id,
      appId: req.params.appId,
      packageId: registeredProgram.packageId
    });
    res.status(200).json({ registeredProgram });
  });

  router.get("/v1/developer/apps/:appId/program", developerAuth, async (req, res) => {
    const developerProfile = res.locals.developerProfile as { id: string };
    const registeredProgram = await resolveService().getRegisteredProgram(
      developerProfile.id,
      requireRouteParam(req.params.appId, "appId")
    );
    res.status(200).json({ registeredProgram });
  });

  router.get("/v1/developer/apps/:appId/actions", developerAuth, async (req, res) => {
    const developerProfile = res.locals.developerProfile as { id: string };
    const actions = await resolveService().listActions(
      developerProfile.id,
      requireRouteParam(req.params.appId, "appId")
    );
    res.status(200).json({ actions });
  });

  router.put("/v1/developer/apps/:appId/actions/:actionType", developerAuth, async (req, res) => {
    const developerProfile = res.locals.developerProfile as { id: string };
    const action = await resolveService().configureAction(
      developerProfile.id,
      requireRouteParam(req.params.appId, "appId"),
      requireRouteParam(req.params.actionType, "actionType"),
      req.body
    );
    res.status(200).json({
      action,
      ...(action.actionType === "say_hello" ? { sayHelloAction: action } : {})
    });
  });

  router.put("/v1/developer/apps/:appId/credits-pricing", developerAuth, async (req, res) => {
    const developerProfile = res.locals.developerProfile as { id: string };
    const creditsPricing = await resolveService().configureCreditsPricing(
      developerProfile.id,
      requireRouteParam(req.params.appId, "appId"),
      req.body
    );
    res.status(200).json({ creditsPricing });
  });

  router.get("/v1/apps/:appId/catalog", async (req, res) => {
    const catalog = await resolveService().getCatalog(requireRouteParam(req.params.appId, "appId"));
    res.status(200).json({ catalog });
  });

  router.get("/v1/apps/:appId/balance", userSession, async (req, res) => {
    const balance = await resolveService().getBalance(
      res.locals.userSession,
      requireRouteParam(req.params.appId, "appId")
    );
    res.status(200).json({ balance });
  });

  router.post("/v1/apps/:appId/checkout-sessions", userSession, async (req, res) => {
    const checkoutSession = await resolveService().createCheckoutSession(
      res.locals.userSession,
      requireRouteParam(req.params.appId, "appId"),
      req.body
    );
    res.status(201).json({ checkoutSession });
  });

  router.post("/v1/apps/:appId/checkout-sessions/:checkoutSessionId/complete", userSession, async (req, res) => {
    const result = await resolveService().completeCheckoutSession(
      res.locals.userSession,
      requireRouteParam(req.params.appId, "appId"),
      requireRouteParam(req.params.checkoutSessionId, "checkoutSessionId")
    );
    logger.info("audit.checkout.completed", {
      requestId: res.locals.requestId,
      appId: req.params.appId,
      checkoutSessionId: req.params.checkoutSessionId,
      walletAddress: result.checkoutSession.walletAddress,
      credits: result.checkoutSession.credits,
      status: result.checkoutSession.status
    });
    res.status(200).json(result);
  });

  router.post("/v1/apps/:appId/actions/:actionType/execute", userSession, async (req, res) => {
    const result = await resolveService().executeAction(
      res.locals.userSession,
      requireRouteParam(req.params.appId, "appId"),
      requireRouteParam(req.params.actionType, "actionType"),
      req.body
    );
    logger.info("audit.action.executed", {
      requestId: res.locals.requestId,
      appId: req.params.appId,
      actionType: req.params.actionType,
      reservationId: result.sponsorship.reservationId,
      walletAddress: result.balance.walletAddress,
      sponsorAddress: result.sponsorship.sponsorAddress
    });
    res.status(201).json(result);
  });

  router.post("/v1/apps/:appId/actions/:actionType/complete", userSession, async (req, res) => {
    const result = await resolveService().completeAction(
      res.locals.userSession,
      requireRouteParam(req.params.appId, "appId"),
      requireRouteParam(req.params.actionType, "actionType"),
      req.body
    );
    logger.info("audit.action.completed", {
      requestId: res.locals.requestId,
      appId: req.params.appId,
      actionType: req.params.actionType,
      reservationId: result.reservationId,
      status: result.status,
      digest: result.transaction?.digest,
      walletAddress: result.balance.walletAddress
    });
    res.status(200).json(result);
  });

  router.get("/v1/apps/:appId/transactions", async (req, res) => {
    const transactions = await resolveService().listTransactions(requireRouteParam(req.params.appId, "appId"));
    res.status(200).json({ transactions });
  });

  return router;
}
