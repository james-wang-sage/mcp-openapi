export interface LogContext {
  [key: string]: any;
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  debug(context: LogContext, message: string): void;
  info(message: string, context?: LogContext): void;
  info(context: LogContext, message: string): void;
  warn(message: string, context?: LogContext): void;
  warn(context: LogContext, message: string): void;
  error(message: string, context?: LogContext): void;
  error(context: LogContext, message: string): void;
}

export class ConsoleLogger implements Logger {
  private isEnabled: boolean;

  constructor() {
    // Check for LOG_ENABLED environment variable
    this.isEnabled = process.env.LOG_ENABLED === 'true';
  }

  private log(level: string, messageOrContext: string | LogContext, contextOrMessage?: LogContext | string) {
    // If logging is not enabled, return early
    if (!this.isEnabled) {
      return;
    }

    const timestamp = new Date().toISOString();
    let message: string;
    let context: LogContext | undefined;

    if (typeof messageOrContext === 'string') {
      message = messageOrContext;
      context = contextOrMessage as LogContext;
    } else {
      message = contextOrMessage as string;
      context = messageOrContext;
    }

    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    console.log(`${timestamp} [${level}] ${message}${contextStr}`);
  }

  debug(messageOrContext: string | LogContext, contextOrMessage?: LogContext | string) {
    this.log('DEBUG', messageOrContext, contextOrMessage);
  }

  info(messageOrContext: string | LogContext, contextOrMessage?: LogContext | string) {
    this.log('INFO', messageOrContext, contextOrMessage);
  }

  warn(messageOrContext: string | LogContext, contextOrMessage?: LogContext | string) {
    this.log('WARN', messageOrContext, contextOrMessage);
  }

  error(messageOrContext: string | LogContext, contextOrMessage?: LogContext | string) {
    this.log('ERROR', messageOrContext, contextOrMessage);
  }
} 