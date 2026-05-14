/**
 * src/middlewares/httpLogger.ts
 * ==============================
 * Middleware de log de requisições HTTP.
 * Loga: método, rota, status, tempo de resposta e userId (se autenticado).
 *
 * Formato visual:
 *   21:03:47 HTTP POST /auth/login            → 200  12ms
 *   21:03:48 HTTP GET  /inventory/            → 200   5ms  [uid:3]
 *   21:03:49 HTTP POST /inventory/            → 400   2ms  [uid:3]
 */

import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Cores ANSI
// ---------------------------------------------------------------------------
const RESET   = '\x1b[0m';
const BOLD    = '\x1b[1m';
const DIM     = '\x1b[2m';
const GREEN   = '\x1b[32m';
const YELLOW  = '\x1b[33m';
const RED     = '\x1b[31m';
const CYAN    = '\x1b[36m';
const MAGENTA = '\x1b[35m';
const BLUE    = '\x1b[34m';
const WHITE   = '\x1b[37m';

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

function colorMethod(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':    return `${GREEN}${BOLD}GET   ${RESET}`;
    case 'POST':   return `${CYAN}${BOLD}POST  ${RESET}`;
    case 'PUT':    return `${BLUE}${BOLD}PUT   ${RESET}`;
    case 'PATCH':  return `${MAGENTA}${BOLD}PATCH ${RESET}`;
    case 'DELETE': return `${RED}${BOLD}DEL   ${RESET}`;
    default:       return `${WHITE}${BOLD}${method.padEnd(6)}${RESET}`;
  }
}

function colorStatus(status: number): string {
  const s = String(status);
  if (status < 300) return `${GREEN}${BOLD}${s}${RESET}`;
  if (status < 400) return `${CYAN}${BOLD}${s}${RESET}`;
  if (status < 500) return `${YELLOW}${BOLD}${s}${RESET}`;
  return `${RED}${BOLD}${s}${RESET}`;
}

function colorDuration(ms: number): string {
  const label = `${ms}ms`.padStart(6);
  if (ms < 100)  return `${GREEN}${label}${RESET}`;
  if (ms < 500)  return `${YELLOW}${label}${RESET}`;
  return `${RED}${label}${RESET}`;
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
export function httpLogger(req: Request & { userId?: number }, res: Response, next: NextFunction): void {
  const startAt = Date.now();

  // Dispara no final da resposta
  res.on('finish', () => {
    const durationMs = Date.now() - startAt;

    const method   = colorMethod(req.method);
    const path     = (req.originalUrl || req.url).padEnd(32);
    const status   = colorStatus(res.statusCode);
    const duration = colorDuration(durationMs);
    const userTag  = req.userId ? ` ${DIM}[uid:${req.userId}]${RESET}` : '';

    // Ignora health-checks para não poluir o log
    if (req.path === '/health') return;

    console.log(
      `${DIM}${timestamp()}${RESET} ${BOLD}HTTP${RESET} ${method} ${DIM}${path}${RESET} → ${status} ${duration}${userTag}`
    );
  });

  next();
}
