import { Observable, tap } from 'rxjs';

const allLogLevels = ['trace', 'debug', 'warn', 'error'] as const;
type LogLevel = (typeof allLogLevels)[number];

let currentLogLevel = localStorage.getItem('pictureOverlayLogLevel');
if (currentLogLevel === null) {
    localStorage.setItem('pictureOverlayLogLevel', 'warn');
    currentLogLevel = 'warn';
}
currentLogLevel = allLogLevels.includes(currentLogLevel as LogLevel) ? currentLogLevel : 'warn';
const currentLogLevelIndex = allLogLevels.findIndex((x) => x === currentLogLevel);

function isLogLevelEnabled(logLevel: LogLevel) {
    const index = allLogLevels.findIndex((x) => x === logLevel);
    if (index === -1) return false;
    return index >= currentLogLevelIndex;
}

const logPrefix = 'OVERLAY_LOG:';
function getConsoleLog(level: LogLevel) {
    switch (level) {
        case 'trace':
            return (...data: unknown[]) => {
                console.debug(logPrefix, '[TRACE]', ...data);
            };
        case 'debug':
            return (...data: unknown[]) => {
                console.debug(logPrefix, '[DEBUG]', ...data);
            };
        case 'warn':
            return (...data: unknown[]) => {
                console.warn(logPrefix, '[WARN]', ...data);
            };
        case 'error':
            return (...data: unknown[]) => {
                console.error(logPrefix, '[ERROR]', ...data);
            };
        default:
            return (...data: unknown[]) => {
                console.log(logPrefix, '[UNKNOWN]', ...data);
            };
            break;
    }
}

export function log$<T>(level: LogLevel, ...data: unknown[]) {
    if (!isLogLevelEnabled(level)) return (source: Observable<T>) => source;
    return (source: Observable<T>) =>
        source.pipe(
            tap((val) => {
                getConsoleLog(level)(...data, val);
            })
        );
}

export function traceLog$<T>(prefix: string) {
    return log$<T>('trace', prefix);
}

export function debugLog$<T>(prefix: string) {
    return log$<T>('debug', prefix);
}

export function warnLog$<T>(prefix: string) {
    return log$<T>('warn', prefix);
}

export function errorLog$<T>(prefix: string) {
    return log$<T>('error', prefix);
}
