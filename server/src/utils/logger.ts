export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

function formatLog(level: LogLevel, message: string, context?: Record<string, any>): string {
  const payload: LogPayload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? { context } : {}),
  };
  return JSON.stringify(payload);
}

export const logger = {
  info(message: string, context?: Record<string, any>) {
    console.log(formatLog('info', message, context));
  },
  warn(message: string, context?: Record<string, any>) {
    console.warn(formatLog('warn', message, context));
  },
  error(message: string, context?: Record<string, any>) {
    console.error(formatLog('error', message, context));
  },
  debug(message: string, context?: Record<string, any>) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatLog('debug', message, context));
    }
  },
};
