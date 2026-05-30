import { parseApiEnv } from "@celeris/shared";
import { createApp } from "./app";
import { logger } from "./lib/logger";

const env = parseApiEnv(process.env);
const app = createApp();

app.listen(env.PORT, () => {
  logger.info("api.started", {
    port: env.PORT,
    apiOrigin: env.API_ORIGIN
  });
});
