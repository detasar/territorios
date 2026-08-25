export type MutationRequestValidation =
  | { ok: true; idempotencyKey: string }
  | { ok: false; status: 400 | 403 | 415; error: string };

const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{8,128}$/;

export function validateMutationRequest(
  request: Request,
): MutationRequestValidation {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    return { ok: false, status: 415, error: 'Se requiere application/json.' };
  }

  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get('origin');
  const fetchSite = request.headers.get('sec-fetch-site');
  const sameOrigin = origin === requestOrigin || (!origin && fetchSite === 'same-origin');
  if (!sameOrigin) {
    return { ok: false, status: 403, error: 'Origen de solicitud no permitido.' };
  }

  const idempotencyKey = request.headers.get('idempotency-key') ?? '';
  if (!IDEMPOTENCY_KEY.test(idempotencyKey)) {
    return { ok: false, status: 400, error: 'Clave de idempotencia inválida.' };
  }

  return { ok: true, idempotencyKey };
}
