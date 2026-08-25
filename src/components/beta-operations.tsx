'use client';

import Link from 'next/link';
import { useState } from 'react';
import { BETA_OPERATIONS } from '../beta/config';
import type { BetaConsent } from '../contracts/beta';
import type { AppLocale } from '../i18n/messages';

type RequestCategory = 'support' | 'security' | 'moderation-appeal' | 'privacy-access' | 'privacy-delete';

const requestIssue: Record<RequestCategory, string> = {
  support: 'cannot-play',
  security: 'urgent-threat',
  'moderation-appeal': 'appeal-decision',
  'privacy-access': 'export-my-data',
  'privacy-delete': 'leave-beta',
};

const copy = {
  es: {
    badge: 'BETA CERRADA · 18+ · SIN DINERO REAL',
    summary: 'Territorios es una prueba privada de estrategia. La Corona y las provincias son símbolos del juego: no conceden propiedad, inversión, premio material ni autoridad política.',
    controller: 'Responsable de la beta: Davut Emre. Finalidad: operar y evaluar el juego con el grupo invitado.',
    flow: 'Ciclo de 28 días: el consejo elige objetivo → movilización → batalla → reorganización → Corona simbólica.',
    privacy: 'Privacidad',
    rules: 'Reglas',
    community: 'Comunidad',
    contact: 'Contacto y derechos',
    participant: 'ID de participante: {id}',
    signIn: 'Inicia sesión para registrar solicitudes de soporte, seguridad, acceso o eliminación.',
    consentFirst: 'Acepta la participación de beta antes de registrar una solicitud.',
    category: 'Tipo de solicitud',
    categories: {
      support: 'Soporte técnico',
      security: 'Seguridad urgente',
      'moderation-appeal': 'Apelación de moderación',
      'privacy-access': 'Acceso a mis datos',
      'privacy-delete': 'Salir y eliminar mis datos',
    },
    fixed: 'No escribas datos personales: esta beta usa categorías predefinidas y tu cuenta autenticada.',
    submit: 'Registrar solicitud',
    pending: 'Registrando…',
    success: 'Solicitud {id} registrada · revisión en un máximo de {hours} horas.',
    failure: 'No se pudo registrar la solicitud.',
  },
  en: {
    badge: 'CLOSED BETA · 18+ · NO REAL MONEY',
    summary: 'Territorios is a private strategy test. The Crown and provinces are game symbols: they grant no property, investment, material prize, or political authority.',
    controller: 'Beta controller: Davut Emre. Purpose: operate and evaluate the game with the invited group.',
    flow: '28-day cycle: council target → mobilization → battle → regrouping → symbolic Crown.',
    privacy: 'Privacy',
    rules: 'Rules',
    community: 'Community',
    contact: 'Contact and rights',
    participant: 'Participant ID: {id}',
    signIn: 'Sign in to submit support, security, access, or deletion requests.',
    consentFirst: 'Accept beta participation before submitting a request.',
    category: 'Request type',
    categories: {
      support: 'Technical support',
      security: 'Urgent security',
      'moderation-appeal': 'Moderation appeal',
      'privacy-access': 'Access my data',
      'privacy-delete': 'Leave and delete my data',
    },
    fixed: 'Do not enter personal data: this beta uses fixed categories and your authenticated account.',
    submit: 'Submit request',
    pending: 'Submitting…',
    success: 'Request {id} recorded · review within {hours} hours.',
    failure: 'The request could not be recorded.',
  },
} as const;

export function BetaOperations({
  authenticated,
  consent,
  locale,
}: {
  authenticated: boolean;
  consent: BetaConsent | null;
  locale: AppLocale;
}) {
  const labels = copy[locale];
  const [category, setCategory] = useState<RequestCategory>('support');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async () => {
    if (!authenticated || !consent || pending) return;
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(BETA_OPERATIONS.supportRoute, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `beta-request-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ category, issueCode: requestIssue[category] }),
      });
      const result = await response.json() as { requestId?: string; reviewWithinHours?: number; error?: string };
      if (!response.ok || !result.requestId || !result.reviewWithinHours) throw new Error(result.error || labels.failure);
      setMessage(labels.success.replace('{id}', result.requestId).replace('{hours}', String(result.reviewWithinHours)));
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : labels.failure);
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="beta-operations" aria-labelledby="beta-operations-title">
      <div>
        <strong id="beta-operations-title">{labels.badge}</strong>
        <p>{labels.summary}</p>
        <p>{labels.controller}</p>
        <p>{labels.flow}</p>
        <nav aria-label={labels.contact}>
          <Link href={`/legal/privacy?lang=${locale}`}>{labels.privacy}</Link>
          <Link href={`/legal/game-rules?lang=${locale}`}>{labels.rules}</Link>
          <Link href={`/legal/community?lang=${locale}`}>{labels.community}</Link>
        </nav>
      </div>
      <details>
        <summary>{labels.contact}</summary>
        {consent ? <p>{labels.participant.replace('{id}', consent.participantId)}</p> : null}
        {!authenticated ? <p>{labels.signIn}</p> : !consent ? <p>{labels.consentFirst}</p> : (
          <div className="beta-request-controls">
            <label htmlFor="beta-request-category">{labels.category}</label>
            <select
              id="beta-request-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as RequestCategory)}
            >
              {(Object.keys(labels.categories) as RequestCategory[]).map((value) => (
                <option key={value} value={value}>{labels.categories[value]}</option>
              ))}
            </select>
            <small>{labels.fixed}</small>
            <button type="button" disabled={pending} onClick={() => void submit()}>{pending ? labels.pending : labels.submit}</button>
          </div>
        )}
        {message ? <p role="status">{message}</p> : null}
      </details>
    </section>
  );
}
