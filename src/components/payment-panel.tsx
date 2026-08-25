'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { WorldSnapshot } from '../contracts/game';
import type { PaymentSnapshot } from '../contracts/payments';
import { productText, type AppLocale } from '../i18n/messages';

const copy = {
  es: {
    title: 'Refuerzos de beta',
    subtitle: 'Stripe Sandbox · demostración; las tarjetas reales no se cobran en este entorno.',
    cap: 'La potencia comprada queda limitada al 20% de la potencia efectiva de cada bando por tick.',
    nature: 'Contenido digital no transferible: no se puede transferir ni canjear por dinero; no hay premios, loot boxes ni propiedad territorial.',
    age: 'Confirmo que soy mayor de 18 años para esta beta de pago.',
    consentPrefix: 'He leído y acepto ',
    consentLinks: 'Condiciones, Reembolsos y Reglas del juego',
    open: 'Abrir pago sandbox',
    notConfigured: 'El checkout de demostración espera las claves test-mode del operador. El juego gratuito sigue disponible.',
    joinFirst: 'Elige una provincia antes de abrir el checkout.',
    paused: 'Tus compras están pausadas.',
    loading: 'Cargando controles de pago…',
    unavailable: 'No se pudieron cargar los controles privados de pago.',
    checkoutFailed: 'El pago sandbox no pudo iniciarse de forma segura.',
    controls: 'Controles de gasto',
    daily: 'Límite diario (€)',
    season: 'Límite de temporada (€)',
    pause: 'Pausar nuevas compras',
    save: 'Guardar límites',
    saved: 'Controles de gasto guardados.',
    dailyOverSeason: 'El límite diario no puede ser superior al límite de temporada.',
    invalidLimit: 'Introduce límites de gasto válidos y no negativos.',
    limitIncrease: 'En la beta solo puedes mantener o reducir tus límites actuales.',
    lowerOnly: 'En la beta los límites solo pueden reducirse. Una revisión de pago nunca reescribe batallas históricas.',
    history: 'Historial de compras',
    empty: 'Aún no hay compras sandbox.',
    granted: 'otorgado',
    revoked: 'revocado',
    legal: 'Privacidad y políticas',
    purchasedUnits: 'APOYO ADQUIRIDO',
    fairCapLabel: 'LÍMITE DE JUEGO LIMPIO 20%',
  },
  en: {
    title: 'Beta reinforcements',
    subtitle: 'Stripe Sandbox · demonstration; real cards are not charged in this environment.',
    cap: 'Purchased power is capped at 20% of each side’s effective power per tick.',
    nature: 'Non-transferable digital content: it cannot be transferred or redeemed for money; there are no prizes, loot boxes, or territorial ownership.',
    age: 'I confirm that I am at least 18 for this paid beta.',
    consentPrefix: 'I have read and accept the ',
    consentLinks: 'Terms, Refund Policy, and Game Rules',
    open: 'Open sandbox checkout',
    notConfigured: 'The demo checkout is waiting for the operator’s test-mode keys. Free play remains available.',
    joinFirst: 'Choose a province before opening checkout.',
    paused: 'Your purchases are paused.',
    loading: 'Loading payment controls…',
    unavailable: 'Private payment controls could not be loaded.',
    checkoutFailed: 'Sandbox checkout could not be started safely.',
    controls: 'Spending controls',
    daily: 'Daily limit (€)',
    season: 'Season limit (€)',
    pause: 'Pause new purchases',
    save: 'Save limits',
    saved: 'Spending controls saved.',
    dailyOverSeason: 'Daily limit cannot be higher than the season limit.',
    invalidLimit: 'Enter valid, non-negative spending limits.',
    limitIncrease: 'During beta you may only keep or reduce your current limits.',
    lowerOnly: 'Beta limits can only be reduced. A payment review never rewrites historical battles.',
    history: 'Purchase history',
    empty: 'There are no sandbox purchases yet.',
    granted: 'granted',
    revoked: 'revoked',
    legal: 'Privacy and policies',
    purchasedUnits: 'PURCHASED SUPPORT',
    fairCapLabel: '20% FAIR-PLAY CAP',
  },
} as const;

export function PaymentPanel({
  catalog,
  hasMembership,
  locale,
  onCheckoutUrl = (url) => window.location.assign(url),
}: {
  catalog: WorldSnapshot['catalog'];
  hasMembership: boolean;
  locale: AppLocale;
  onCheckoutUrl?: (url: string) => void;
}) {
  const labels = copy[locale];
  const [snapshot, setSnapshot] = useState<PaymentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [seasonLimit, setSeasonLimit] = useState(150);

  useEffect(() => {
    let current = true;
    fetch('/api/payments', { headers: { accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('payment snapshot unavailable');
        return response.json() as Promise<PaymentSnapshot>;
      })
      .then((result) => {
        if (!current) return;
        setSnapshot(result);
        setPaused(result.controls.purchasesPaused);
        setDailyLimit(result.controls.dailySpendLimitCents / 100);
        setSeasonLimit(result.controls.seasonSpendLimitCents / 100);
      })
      .catch(() => {
        if (current) setMessage(labels.unavailable);
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [labels.unavailable]);

  const checkout = async (productId: string) => {
    if (!snapshot) return;
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `payment-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          ageConfirmed,
          consentAccepted,
          consentVersion: snapshot.legalVersion,
          productId,
        }),
      });
      const result = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !result.checkoutUrl) {
        throw new Error(locale === 'es' && result.error ? result.error : labels.checkoutFailed);
      }
      onCheckoutUrl(trustedCheckoutUrl(result.checkoutUrl));
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : labels.checkoutFailed);
    } finally {
      setPending(false);
    }
  };

  const saveControls = async () => {
    if (!snapshot) return;
    if (!Number.isFinite(dailyLimit) || !Number.isFinite(seasonLimit) || dailyLimit < 0 || seasonLimit < 0) {
      setMessage(labels.invalidLimit);
      return;
    }
    if (dailyLimit > seasonLimit) {
      setMessage(labels.dailyOverSeason);
      return;
    }
    if (
      dailyLimit * 100 > snapshot.controls.dailySpendLimitCents
      || seasonLimit * 100 > snapshot.controls.seasonSpendLimitCents
    ) {
      setMessage(labels.limitIncrease);
      return;
    }
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/payments/controls', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `payment-controls-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          purchasesPaused: paused,
          dailySpendLimitCents: Math.round(dailyLimit * 100),
          seasonSpendLimitCents: Math.round(seasonLimit * 100),
        }),
      });
      const result = await response.json() as PaymentSnapshot | { error?: string };
      if (!response.ok || !('mode' in result)) {
        throw new Error('error' in result && result.error && locale === 'es' ? result.error : labels.unavailable);
      }
      setSnapshot(result);
      setMessage(labels.saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : labels.unavailable);
    } finally {
      setPending(false);
    }
  };

  if (loading) return <p className="empty-state">{labels.loading}</p>;

  return (
    <div className="payment-layout">
      <section className="storefront" aria-labelledby="payment-store-heading">
        <div className="sandbox-heading">
          <div>
            <span className="sandbox-badge">SANDBOX</span>
            <h3 id="payment-store-heading">{labels.title}</h3>
          </div>
          <strong>Stripe Sandbox</strong>
        </div>
        <p className="payment-subtitle">{labels.subtitle}</p>
        <div className="payment-safety-note">
          <strong>{labels.fairCapLabel}</strong>
          <span>{labels.cap}</span>
          <span>{labels.nature}</span>
        </div>
        {!snapshot?.configured ? <p className="command-alert">{labels.notConfigured}</p> : null}
        {!hasMembership ? <p className="command-alert">{labels.joinFirst}</p> : null}
        {snapshot?.controls.purchasesPaused ? <p className="command-alert">{labels.paused}</p> : null}

        <fieldset className="payment-consent">
          <legend>18+ · {snapshot?.legalVersion ?? 'paid beta'}</legend>
          <label>
            <input
              type="checkbox"
              checked={ageConfirmed}
              onChange={(event) => setAgeConfirmed(event.target.checked)}
            />
            {labels.age}
          </label>
          <label>
            <input
              type="checkbox"
              checked={consentAccepted}
              onChange={(event) => setConsentAccepted(event.target.checked)}
            />
            <span>
              {labels.consentPrefix}
              <Link href={`/legal/terms?lang=${locale}`}>{labels.consentLinks}</Link>.
            </span>
          </label>
        </fieldset>

        <ul className="product-grid">
          {catalog.map((product) => (
            <li key={product.id}>
              <span>{product.paidSupport.toLocaleString(locale)} {labels.purchasedUnits}</span>
              <h4>{productText(locale, product.name)}</h4>
              <p>{productText(locale, product.description)}</p>
              <strong>{formatPrice(product.priceCents, product.currency, locale)}</strong>
              <button
                type="button"
                disabled={
                  pending ||
                  !snapshot?.configured ||
                  snapshot.controls.purchasesPaused ||
                  !hasMembership ||
                  !ageConfirmed ||
                  !consentAccepted
                }
                onClick={() => checkout(product.id)}
              >{labels.open}</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="payment-controls" aria-labelledby="payment-controls-heading">
        <h3 id="payment-controls-heading">{labels.controls}</h3>
        <div className="field-group">
          <label htmlFor="payment-daily-limit">{labels.daily}</label>
          <input
            id="payment-daily-limit"
            type="number"
            min="0"
            max={(snapshot?.controls.dailySpendLimitCents ?? 5_000) / 100}
            step="1"
            value={dailyLimit}
            onChange={(event) => setDailyLimit(Number(event.target.value))}
          />
          <label htmlFor="payment-season-limit">{labels.season}</label>
          <input
            id="payment-season-limit"
            type="number"
            min="0"
            max={(snapshot?.controls.seasonSpendLimitCents ?? 15_000) / 100}
            step="1"
            value={seasonLimit}
            onChange={(event) => setSeasonLimit(Number(event.target.value))}
          />
          <label className="check-field">
            <input type="checkbox" checked={paused} onChange={(event) => setPaused(event.target.checked)} />
            {labels.pause}
          </label>
          <button type="button" disabled={pending || !snapshot} onClick={saveControls}>{labels.save}</button>
        </div>
        <p className="privacy-note">{labels.lowerOnly}</p>

        <h3>{labels.history}</h3>
        {snapshot?.purchases.length ? (
          <ol className="purchase-history">
            {snapshot.purchases.map((purchase) => (
              <li key={purchase.id}>
                <span><strong>{purchase.productName}</strong><small>{purchase.status.replaceAll('_', ' ')}</small></span>
                <span>
                  <b>{formatPrice(purchase.amountCents, purchase.currency, locale)}</b>
                  <small>{purchase.paidSupportGranted} {labels.granted} · {purchase.paidSupportRevoked} {labels.revoked}</small>
                </span>
              </li>
            ))}
          </ol>
        ) : <p className="empty-state">{labels.empty}</p>}
        <nav className="legal-links" aria-label={labels.legal}>
          <Link href={`/legal/terms?lang=${locale}`}>Terms</Link>
          <Link href={`/legal/privacy?lang=${locale}`}>Privacy</Link>
          <Link href={`/legal/refunds?lang=${locale}`}>Refunds</Link>
          <Link href={`/legal/game-rules?lang=${locale}`}>Game Rules</Link>
          <Link href={`/legal/community?lang=${locale}`}>Community</Link>
        </nav>
      </section>
      {message ? <p className="hub-status" role="status" aria-live="polite">{message}</p> : null}
    </div>
  );
}

export function trustedCheckoutUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') {
    throw new Error(copy.es.checkoutFailed);
  }
  return url.toString();
}

function formatPrice(cents: number, currency: string, locale: AppLocale): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-ES' : 'en-IE', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}
