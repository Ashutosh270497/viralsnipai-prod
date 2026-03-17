/**
 * Structured logging utility for ViralSnipAI
 *
 * Provides consistent logging with different levels and optional context.
 * In production, can be easily extended to send logs to external services.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: LogContext;
  timestamp: string;
  error?: Error;
}

class Logger {
  private isDevelopment: boolean;
  private minLevel: LogLevel;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.minLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';
  }

  /**
   * Determines if a log level should be output based on minimum level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(level);
    const minIndex = levels.indexOf(this.minLevel);
    return currentIndex >= minIndex;
  }

  /**
   * Formats a log entry for output
   */
  private formatEntry(entry: LogEntry): string {
    if (this.isDevelopment) {
      // Pretty format for development
      const contextStr = entry.context
        ? ` ${JSON.stringify(entry.context, null, 2)}`
        : '';
      const errorStr = entry.error
        ? `\n  Error: ${entry.error.message}\n  Stack: ${entry.error.stack}`
        : '';
      return `[${entry.level.toUpperCase()}] ${entry.message}${contextStr}${errorStr}`;
    } else {
      // JSON format for production (easier to parse by log aggregators)
      return JSON.stringify(entry);
    }
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, context?: LogContext, error?: Error): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date().toISOString(),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } as any : undefined
    };

    const formatted = this.formatEntry(entry);

    switch (level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
        console.error(formatted);
        break;
    }
  }

  /**
   * Log debug information (only shown in development or when LOG_LEVEL=debug)
   */
  debug(message: string, context?: LogContext): void {
    this.log('debug', message, context);
  }

  /**
   * Log informational messages
   */
  info(message: string, context?: LogContext): void {
    this.log('info', message, context);
  }

  /**
   * Log warning messages
   */
  warn(message: string, context?: LogContext): void {
    this.log('warn', message, context);
  }

  /**
   * Log error messages
   */
  error(message: string, contextOrError?: LogContext | Error, error?: Error): void {
    if (contextOrError instanceof Error) {
      this.log('error', message, undefined, contextOrError);
    } else {
      this.log('error', message, contextOrError, error);
    }
  }

  /**
   * Create a child logger with default context that's included in all logs
   */
  child(defaultContext: LogContext): ChildLogger {
    return new ChildLogger(this, defaultContext);
  }
}

/**
 * Child logger that includes default context in all log calls
 */
class ChildLogger {
  constructor(
    private parent: Logger,
    private defaultContext: LogContext
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.defaultContext, ...context };
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, contextOrError?: LogContext | Error, error?: Error): void {
    if (contextOrError instanceof Error) {
      this.parent.error(message, contextOrError);
    } else {
      this.parent.error(message, this.mergeContext(contextOrError), error);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Export types for use in other files
export type { LogContext, LogLevel };
