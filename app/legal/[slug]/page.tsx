import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { AppLocale } from '../../../src/i18n/messages';

type LegalDocument = {
  title: string;
  summary: string;
  sections: Array<{ heading: string; paragraphs?: string[]; bullets?: string[] }>;
};

const spanishDocuments: Record<string, LegalDocument> = {
  terms: {
    title: 'Condiciones de la beta de Territorios',
    summary: 'Versión paid-beta-2026-08-25 · Borrador operativo para una demostración sandbox, no asesoramiento jurídico.',
    sections: [
      {
        heading: 'Alcance de esta demostración',
        paragraphs: [
          'Territorios es un juego de estrategia territorial persistente. La publicación actual es una beta técnica. El checkout señalado como Stripe Sandbox no debe cobrar tarjetas reales ni constituye una oferta comercial pública.',
          'La identidad fiscal del operador, domicilio, canal formal de soporte y textos localizados definitivos deben completarse y revisarse por asesoría española antes de activar pagos reales.',
        ],
      },
      {
        heading: 'Cuenta y edad',
        bullets: [
          'El juego gratuito usa la identidad de inicio de sesión de ChatGPT Sites.',
          'La beta de pago está limitada a personas de 18 años o más mediante una declaración expresa; esa declaración no sustituye una verificación de edad cuando la ley o el proveedor la exijan.',
          'Una cuenta no puede usar automatización, suplantación, múltiples identidades coordinadas ni instrumentos de pago ajenos sin autorización.',
        ],
      },
      {
        heading: 'Naturaleza del contenido digital',
        bullets: [
          'Los paquetes son contenido digital no transferible; no son donaciones, propiedad sobre una provincia ni participaciones políticas.',
          'No existe cash-out, reventa, intercambio entre jugadores, premio material, criptoactivo, apuesta, loot box ni torneo de entrada pagada.',
          'La potencia pagada está limitada matemáticamente al 20% de la potencia efectiva de cada bando por tick. El exceso queda en cola; no evade el límite.',
          'Los precios y unidades se determinan exclusivamente en el servidor. El navegador no demuestra saldo, compra ni victoria.',
        ],
      },
      {
        heading: 'Suspensión y cambios',
        paragraphs: [
          'Podemos pausar compras o una cuenta ante fraude, chargeback, abuso, riesgo para menores o incumplimiento de las reglas. Las temporadas, el equilibrio y la disponibilidad pueden cambiar, pero los eventos históricos se conservan para auditoría y replay.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Aviso de privacidad de la beta',
    summary: 'Minimización por diseño · El MVP no almacena datos de tarjeta ni contenido de chat libre.',
    sections: [
      {
        heading: 'Datos tratados',
        bullets: [
          'Identificador, correo y nombre visible aportados por ChatGPT Sites para autenticar la cuenta.',
          'Provincia, rol, votos, órdenes, contribuciones, preferencias, reportes y registros antifraude/auditoría del juego.',
          'Identificadores de sesión, intención y evento de Stripe, importes, moneda y estado. Los datos completos de tarjeta y facturación permanecen en Stripe.',
          'La versión inicial no implementa mensajería privada, geolocalización precisa ni huella de dispositivo.',
        ],
      },
      {
        heading: 'Finalidades y seguridad',
        paragraphs: [
          'Los datos se usan para operar el mundo autoritativo, prevenir abuso, cumplir solicitudes de pago e investigar disputas. Los payloads de pago almacenados se reducen a identificadores y hashes; no se copia el objeto completo del proveedor.',
          'D1 es la fuente canónica del runtime. Los eventos de juego, pagos y auditoría relevantes son append-only. La sesión de autenticación usa las cookies gestionadas por ChatGPT Sites.',
        ],
      },
      {
        heading: 'Pendientes antes de producción',
        paragraphs: [
          'El responsable del tratamiento, contacto de privacidad, bases jurídicas por finalidad, plazos de conservación, transferencias internacionales, encargados y procedimiento de derechos deben publicarse con identidad legal real antes de una beta pública con pagos.',
        ],
      },
    ],
  },
  refunds: {
    title: 'Política de reembolsos y disputas',
    summary: 'Borrador beta · El entorno sandbox no mueve dinero real.',
    sections: [
      {
        heading: 'Reembolsos',
        bullets: [
          'Una solicitud debe identificar la compra desde el historial de la cuenta; nunca debe incluir números completos de tarjeta.',
          'Un reembolso confirmado por webhook revoca proporcionalmente el apoyo pagado aún disponible y el derecho digital asociado.',
          'Si el apoyo ya se utilizó, el saldo nunca se vuelve negativo: la cuenta pasa a revisión. Ningún reembolso reescribe capturas o ticks históricos.',
          'El plazo, las excepciones de contenido digital y el mecanismo de desistimiento deben ser cerrados por asesoría de consumo española antes de cobrar dinero real.',
        ],
      },
      {
        heading: 'Chargebacks',
        paragraphs: [
          'Una disputa pausa nuevas compras y retira solamente el apoyo disponible. Si la disputa se gana, se restaura únicamente lo realmente retirado, descontando cualquier reembolso vigente. Una disputa perdida mantiene la cuenta en revisión.',
        ],
      },
      {
        heading: 'Fuente de verdad',
        paragraphs: [
          'La pantalla de éxito no concede contenido. Solo un evento test-mode firmado por Stripe, verificado contra el cuerpo HTTP sin modificar y procesado de forma idempotente, puede completar una compra.',
        ],
      },
    ],
  },
  'game-rules': {
    title: 'Reglas del juego',
    summary: 'Temporada de 28 días · 52 provincias y ciudades autónomas · motor determinista combat-2.0.0.',
    sections: [
      {
        heading: 'Juego justo',
        bullets: [
          'Una persona, una cuenta activa y una membresía de facción por temporada.',
          'Quedan prohibidos bots, macros, explotación de errores, colusión multicuenta, sabotaje con cuentas falsas y manipulación de pagos.',
          'La potencia pagada no puede superar el 20% de la potencia efectiva por bando y tick.',
          'Las decisiones del consejo usan una silla por usuario y un voto de igual peso; el asiento de apoyo está limitado y no controla por sí solo el objetivo.',
        ],
      },
      {
        heading: 'Resolución',
        paragraphs: [
          'El servidor resuelve ticks horarios con aritmética entera versionada. Una provincia solo cambia de control en una ventana de captura y después de cumplir el mínimo de ticks. Cada entrada y resultado queda asociado a un hash de replay.',
        ],
      },
      {
        heading: 'Premios',
        paragraphs: [
          'Crown of Spain y los demás títulos son puramente simbólicos, no transferibles y sin valor monetario o material.',
        ],
      },
    ],
  },
  community: {
    title: 'Política de comunidad',
    summary: 'Coordinación local sin chat libre, enlaces, archivos ni mensajes privados en el MVP.',
    sections: [
      {
        heading: 'Contenido permitido',
        paragraphs: [
          'La beta usa mensajes tácticos predefinidos, anuncios del consejo, votos y notificaciones. Una rivalidad regional puede ser intensa, pero nunca debe dirigirse contra la dignidad o seguridad de una persona o grupo.',
        ],
      },
      {
        heading: 'Contenido prohibido',
        bullets: [
          'Amenazas, acoso, odio, discriminación, glorificación de violencia real o propaganda política partidista.',
          'Direcciones, teléfonos, correos, ubicación precisa, información financiera u otros datos personales.',
          'Enlaces, publicidad, fraude, suplantación, instrucciones ilegales o intento de eludir moderación.',
        ],
      },
      {
        heading: 'Moderación y recurso',
        paragraphs: [
          'Report, mute y block están disponibles desde la actividad. Los reportes se redactan para ocultar datos personales y quedan en una cola de revisión humana. Una regla o clasificador puede priorizar, pero no debe ser el único decisor de una sanción material. El proceso formal de apelación debe completarse antes de una comunidad pública a escala.',
        ],
      },
    ],
  },
};

const englishDocuments: Record<string, LegalDocument> = {
  terms: {
    title: 'Territorios Beta Terms',
    summary: 'Version paid-beta-2026-08-25 · Operational draft for a sandbox demonstration, not legal advice.',
    sections: [
      {
        heading: 'Scope of this demonstration',
        paragraphs: [
          'Territorios is a persistent territorial strategy game. The current release is a technical beta. Checkout clearly marked Stripe Sandbox must not charge real cards and is not a public commercial offer.',
          'The operator’s legal and tax identity, address, formal support channel, and final localized terms must be completed and reviewed by Spanish counsel before real payments are enabled.',
        ],
      },
      {
        heading: 'Account and age',
        bullets: [
          'Free play uses the ChatGPT Sites sign-in identity.',
          'The paid beta is limited to people aged 18 or older through an explicit declaration. This declaration does not replace age verification when required by law or a provider.',
          'An account may not use automation, impersonation, coordinated multiple identities, or another person’s payment instrument without authorization.',
        ],
      },
      {
        heading: 'Nature of the digital content',
        bullets: [
          'Packages are non-transferable digital content. They are not donations, ownership of a province, or political participation.',
          'There is no cash-out, resale, player-to-player exchange, material prize, cryptoasset, gambling, loot box, or paid-entry tournament.',
          'Purchased power is mathematically capped at 20% of each side’s effective power per tick. Excess units remain queued and cannot bypass the cap.',
          'Prices and units are determined exclusively by the server. The browser cannot prove balance, purchase, or victory.',
        ],
      },
      {
        heading: 'Suspension and changes',
        paragraphs: [
          'We may pause purchases or an account in response to fraud, chargebacks, abuse, risks to minors, or rule violations. Seasons, balance, and availability may change, while historical events remain available for audit and replay.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Beta Privacy Notice',
    summary: 'Data minimization by design · The MVP stores neither card data nor free-form chat content.',
    sections: [
      {
        heading: 'Data processed',
        bullets: [
          'The identifier, email address, and display name supplied by ChatGPT Sites to authenticate the account.',
          'Province, role, ballots, orders, contributions, preferences, reports, and game anti-fraud or audit records.',
          'Stripe session, intent, and event identifiers, amounts, currency, and status. Full card and billing data remain with Stripe.',
          'The initial release does not implement private messaging, precise geolocation, or device fingerprinting.',
        ],
      },
      {
        heading: 'Purposes and security',
        paragraphs: [
          'Data is used to operate the authoritative world, prevent abuse, fulfill payment requests, and investigate disputes. Stored payment payloads are reduced to identifiers and hashes; the complete provider object is not copied.',
          'D1 is the canonical runtime source. Relevant game, payment, and audit events are append-only. Authentication uses cookies managed by ChatGPT Sites.',
        ],
      },
      {
        heading: 'Required before production',
        paragraphs: [
          'The controller’s identity, privacy contact, legal basis for each purpose, retention periods, international transfers, processors, and rights procedure must be published with the real legal identity before a public beta with payments.',
        ],
      },
    ],
  },
  refunds: {
    title: 'Refund and Dispute Policy',
    summary: 'Beta draft · The sandbox environment does not move real money.',
    sections: [
      {
        heading: 'Refunds',
        bullets: [
          'A request must identify the purchase from account history and must never include a full card number.',
          'A refund confirmed by webhook proportionally revokes purchased support that is still available and its associated digital entitlement.',
          'If the support has already been used, the balance never becomes negative; the account enters review. Refunds never rewrite historical captures or ticks.',
          'Time limits, digital-content exceptions, and the withdrawal mechanism must be finalized by Spanish consumer counsel before real money is charged.',
        ],
      },
      {
        heading: 'Chargebacks',
        paragraphs: [
          'A dispute pauses new purchases and removes only support that remains available. If the dispute is won, only the amount actually removed is restored, minus any active refund. A lost dispute keeps the account under review.',
        ],
      },
      {
        heading: 'Source of truth',
        paragraphs: [
          'The success page does not grant content. Only a signed Stripe test-mode event, verified against the unmodified HTTP body and processed idempotently, can complete a purchase.',
        ],
      },
    ],
  },
  'game-rules': {
    title: 'Game Rules',
    summary: '28-day season · 52 provinces and autonomous cities · deterministic combat-2.0.0 engine.',
    sections: [
      {
        heading: 'Fair play',
        bullets: [
          'One person, one active account, and one faction membership per season.',
          'Bots, macros, bug exploitation, multi-account collusion, fake-account sabotage, and payment manipulation are prohibited.',
          'Purchased power cannot exceed 20% of either side’s effective power in a tick.',
          'Council decisions use one seat per user and equal-weight ballots. The supporter seat is capped and cannot control the target by itself.',
        ],
      },
      {
        heading: 'Resolution',
        paragraphs: [
          'The server resolves hourly ticks with versioned integer arithmetic. A province changes control only within a capture window after the minimum tick count is met. Every input and result is associated with a replay hash.',
        ],
      },
      {
        heading: 'Awards',
        paragraphs: [
          'Crown of Spain and all other titles are purely symbolic, non-transferable, and have no monetary or material value.',
        ],
      },
    ],
  },
  community: {
    title: 'Community Policy',
    summary: 'Local coordination without free-form chat, links, files, or private messages in the MVP.',
    sections: [
      {
        heading: 'Allowed content',
        paragraphs: [
          'The beta uses predefined tactical messages, council announcements, ballots, and notifications. Regional rivalry can be intense, but it must never target the dignity or safety of a person or group.',
        ],
      },
      {
        heading: 'Prohibited content',
        bullets: [
          'Threats, harassment, hate, discrimination, glorification of real violence, or partisan political propaganda.',
          'Addresses, telephone numbers, emails, precise locations, financial information, or other personal data.',
          'Links, advertising, fraud, impersonation, illegal instructions, or attempts to evade moderation.',
        ],
      },
      {
        heading: 'Moderation and appeal',
        paragraphs: [
          'Report, mute, and block controls are available from activity. Reports are redacted to hide personal data and enter a human-review queue. A rule or classifier may prioritize a case but must not be the sole decision-maker for a material sanction. A formal appeal process must be completed before the community is opened at scale.',
        ],
      },
    ],
  },
};

const documents: Record<AppLocale, Record<string, LegalDocument>> = {
  es: spanishDocuments,
  en: englishDocuments,
};

const pageCopy = {
  es: {
    back: '← Volver al mapa',
    eyebrow: 'Territorios · transparencia beta',
    navigation: 'Documentos legales',
    updated: 'Última actualización: 25 de agosto de 2026.',
  },
  en: {
    back: '← Back to map',
    eyebrow: 'Territorios · beta transparency',
    navigation: 'Legal documents',
    updated: 'Last updated: August 25, 2026.',
  },
} as const;

function resolveLocale(lang: string | undefined): AppLocale {
  return lang === 'en' ? 'en' : 'es';
}

export function generateStaticParams() {
  return Object.keys(spanishDocuments).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}): Promise<Metadata> {
  const locale = resolveLocale((await searchParams).lang);
  const document = documents[locale][(await params).slug];
  return { title: document ? `${document.title} — Territorios` : 'Territorios' };
}

export default async function LegalPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ lang?: string }>;
}) {
  const locale = resolveLocale((await searchParams).lang);
  const localizedDocuments = documents[locale];
  const document = localizedDocuments[(await params).slug];
  if (!document) notFound();
  const copy = pageCopy[locale];

  return (
    <main className="legal-page">
      <Link className="legal-back" href="/">{copy.back}</Link>
      <span className="eyebrow">{copy.eyebrow}</span>
      <h1>{document.title}</h1>
      <p className="legal-summary">{document.summary}</p>
      {document.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.bullets ? (
            <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
          ) : null}
        </section>
      ))}
      <nav className="legal-document-nav" aria-label={copy.navigation}>
        {Object.entries(localizedDocuments).map(([slug, entry]) => (
          <Link key={slug} href={`/legal/${slug}?lang=${locale}`}>{entry.title}</Link>
        ))}
      </nav>
      <small>{copy.updated}</small>
    </main>
  );
}
