export interface LogPayload {
  [key: string]: unknown;
}

function log(level: "info" | "error", message: string, payload: LogPayload = {}) {
  const record = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...payload
  };

  const serialized = JSON.stringify(record);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  console.log(serialized);
}

export const logger = {
  info(message: string, payload?: LogPayload) {
    log("info", message, payload);
  },
  error(message: string, payload?: LogPayload) {
    log("error", message, payload);
  }
};
