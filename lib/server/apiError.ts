import { randomUUID } from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

export type ApiErrorOptions = {
  route: string
  requestId: string
  req: NextRequest
  err: unknown
  extra?: Record<string, unknown>
}

export function getRequestId(req: NextRequest): string {
  return req.headers.get('x-request-id') ?? randomUUID()
}

export function logApiError({ route, requestId, req, err, extra }: ApiErrorOptions) {
  const error = err instanceof Error ? err : new Error(String(err))
  console.error(`[API_ERROR] ${route}`, {
    requestId,
    method: req.method,
    path: req.nextUrl.pathname,
    query: req.nextUrl.search,
    message: error.message,
    stack: error.stack,
    ...(extra ?? {}),
  })
}

export function apiErrorResponse(message: string, status: number, requestId: string) {
  return NextResponse.json(
    { error: message, requestId },
    { status, headers: { 'x-request-id': requestId } },
  )
}
