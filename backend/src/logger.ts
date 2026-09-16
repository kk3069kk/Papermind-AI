export type LogFields = Record<string, unknown>;

function write(level: string, event: string, fields: LogFields = {}) {
  const payload = {
    level,
    event,
    ts: new Date().toISOString(),
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else console.log(line);
}

export function getLogger(_name = "papermind") {
  return {
    info: (event: string, fields?: LogFields) => write("info", event, fields),
    warn: (event: string, fields?: LogFields) => write("warn", event, fields),
    error: (event: string, fields?: LogFields) => write("error", event, fields),
    debug: (event: string, fields?: LogFields) => write("debug", event, fields),
  };
}
