type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

class Logger {
    private level: LogLevel;
    private name: string;

    constructor(name: string, level: LogLevel = 'info') {
        this.name = name;
        this.level = level;
    }

    setLevel(level: LogLevel) {
        this.level = level;
    }

    private shouldLog(level: LogLevel): boolean {
        const levels: LogLevel[] = ['debug', 'info', 'warn', 'error', 'none'];
        return levels.indexOf(level) >= levels.indexOf(this.level);
    }

    private formatMessage(level: LogLevel, message: string): string {
        const timestamp = new Date().toISOString();
        return `[${timestamp}] [${this.name}] [${level.toUpperCase()}] ${message}`;
    }

    debug(message: string, ...optionalParams: unknown[]) {
        if (this.shouldLog('debug')) {
            // biome-ignore lint/suspicious/noConsole: This is a logger
            console.debug(this.formatMessage('debug', message), ...optionalParams);
        }
    }

    dir(obj: unknown, ...optionalParams: unknown[]) {
        if (this.shouldLog('debug')) {
            // biome-ignore lint/suspicious/noConsole: This is a logger
            console.log(this.formatMessage('debug', 'See object below'), ...optionalParams);
            // biome-ignore lint/suspicious/noConsole: This is a logger
            console.dir(obj);
        }
    }

    info(message: string, ...optionalParams: unknown[]) {
        if (this.shouldLog('info')) {
            // biome-ignore lint/suspicious/noConsole: This is a logger
            console.info(this.formatMessage('info', message), ...optionalParams);
        }
    }

    warn(message: string, ...optionalParams: unknown[]) {
        if (this.shouldLog('warn')) {
            // biome-ignore lint/suspicious/noConsole: This is a logger
            console.warn(this.formatMessage('warn', message), ...optionalParams);
        }
    }

    error(message: string, ...optionalParams: unknown[]) {
        if (this.shouldLog('error')) {
            // biome-ignore lint/suspicious/noConsole: This is a logger
            console.error(this.formatMessage('error', message), ...optionalParams);
        }
    }
}

export const logger = new Logger('default');
