import { parseWebEnv } from "@celeris/shared";

export function getWebRuntimeConfig() {
  return parseWebEnv(process.env);
}
