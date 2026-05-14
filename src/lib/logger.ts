/**
 * src/lib/logger.ts
 * ==================
 * Logger centralizado com cores ANSI para o terminal.
 * Sem dependências externas — usa apenas Node.js nativo.
 *
 * Uso:
 *   import { logger } from '../lib/logger';
 *   const log = logger('AuthController');
 *   log.info('Usuário autenticado', { userId: 1 });
 *   log.error('Falha ao criar item', err);
 */

// ---------------------------------------------------------------------------
// Cores ANSI
// ---------------------------------------------------------------------------
const RESET  = '\x1b[0m';
const BOLD   = '\x1b[1m';
const DIM    = '\x1b[2m';

const CYAN   = '\x1b[36m';
const GREEN  = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED    = '\x1b[31m';
const MAGENTA = '\x1b[35m';
const BLUE   = '\x1b[34m';
const WHITE  = '\x1b[37m';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function timestamp(): string {
  return new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function formatExtra(extra?: unknown): string {
  if (extra === undefined || extra === null) return '';
  if (extra instanceof Error) {
    return `\n  ${RED}${extra.message}${RESET}${extra.stack ? `\n  ${DIM}${extra.stack.split('\n').slice(1, 4).join('\n  ')}${RESET}` : ''}`;
  }
  if (typeof extra === 'object') {
    try {
      return ` ${DIM}${JSON.stringify(extra)}${RESET}`;
    } catch {
      return '';
    }
  }
  return ` ${DIM}${String(extra)}${RESET}`;
}

// ---------------------------------------------------------------------------
// Nível de log (controlado por NODE_ENV ou LOG_LEVEL)
// ---------------------------------------------------------------------------
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info:  1,
  warn:  2,
  error: 3,
};

function currentLevel(): LogLevel {
  const env = (process.env.LOG_LEVEL ?? '').toLowerCase();
  if (['debug', 'info', 'warn', 'error'].includes(env)) return env as LogLevel;
  return process.env.NODE_ENV === 'production' ? 'info' : 'debug';
}

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel()];
}

// ---------------------------------------------------------------------------
// Fábrica de logger por módulo
// ---------------------------------------------------------------------------
export interface Logger {
  debug: (msg: string, extra?: unknown) => void;
  info:  (msg: string, extra?: unknown) => void;
  warn:  (msg: string, extra?: unknown) => void;
  error: (msg: string, extra?: unknown) => void;
}

export function logger(module: string): Logger {
  const prefix = `${BOLD}${MAGENTA}[${module}]${RESET}`;

  return {
    debug(msg, extra) {
      if (!shouldLog('debug')) return;
      console.debug(
        `${DIM}${timestamp()}${RESET} ${BLUE}DBG${RESET} ${prefix} ${WHITE}${msg}${RESET}${formatExtra(extra)}`
      );
    },

    info(msg, extra) {
      if (!shouldLog('info')) return;
      console.info(
        `${DIM}${timestamp()}${RESET} ${GREEN}INF${RESET} ${prefix} ${msg}${formatExtra(extra)}`
      );
    },

    warn(msg, extra) {
      if (!shouldLog('warn')) return;
      console.warn(
        `${DIM}${timestamp()}${RESET} ${YELLOW}WRN${RESET} ${prefix} ${YELLOW}${msg}${RESET}${formatExtra(extra)}`
      );
    },

    error(msg, extra) {
      if (!shouldLog('error')) return;
      console.error(
        `${DIM}${timestamp()}${RESET} ${RED}${BOLD}ERR${RESET} ${prefix} ${RED}${msg}${RESET}${formatExtra(extra)}`
      );
    },
  };
}

// ---------------------------------------------------------------------------
// Logger raiz (sem módulo específico)
// ---------------------------------------------------------------------------
export const rootLogger = logger('App');
