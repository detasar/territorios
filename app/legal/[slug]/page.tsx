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
    summary: 'Versión closed-beta-2026-08-25-v1 · Beta privada 18+ sin dinero real; no es una oferta comercial.',
    sections: [
      {
        heading: 'Alcance de esta demostración',
        paragraphs: [
          'Territorios es un juego de estrategia territorial persistente operado para un grupo invitado por Davut Emre. Esta versión no muestra tienda, no configura Stripe y no permite pagos ni tarjetas reales.',
          'La beta no es pública. Activar pagos, ampliar el público o presentar el servicio como producto comercial requiere una revisión jurídica y operativa separada.',
        ],
      },
      {
        heading: 'Cuenta y edad',
        bullets: [
          'El juego gratuito usa la identidad de inicio de sesión de ChatGPT Sites.',
          'La beta está limitada a personas invitadas de 18 años o más mediante una declaración expresa y consentimiento versionado.',
          'Una cuenta no puede usar automatización, suplantación ni múltiples identidades coordinadas.',
        ],
      },
      {
        heading: 'Naturaleza del contenido digital',
        bullets: [
          'No hay paquetes de pago en esta beta. Las unidades, la Corona y las provincias son elementos simbólicos del juego; no son inversión, propiedad ni participación política.',
          'No existe cash-out, reventa, intercambio entre jugadores, premio material, criptoactivo, apuesta, loot box ni torneo de entrada pagada.',
          'Todas las contribuciones disponibles para participantes son gratuitas y se determinan exclusivamente en el servidor.',
        ],
      },
      {
        heading: 'Suspensión y cambios',
        paragraphs: [
          'El operador puede cerrar el acceso o pausar una cuenta ante abuso, riesgo para menores, incidente de seguridad o incumplimiento de las reglas. Las temporadas, el equilibrio y la disponibilidad pueden cambiar; el aviso de privacidad define qué historial se conserva y por cuánto tiempo.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Aviso de privacidad de la beta',
    summary: 'Responsable: Davut Emre · Minimización por diseño · Sin tarjeta, geolocalización ni chat libre.',
    sections: [
      {
        heading: 'Datos tratados',
        bullets: [
          'Identificador, correo y nombre visible aportados por ChatGPT Sites para autenticar la cuenta.',
          'Provincia, rol, votos, órdenes, contribuciones, preferencias, reportes y registros antifraude/auditoría del juego.',
          'ID aleatorio de participante, versión/fecha del consentimiento, métricas de tareas, solicitudes de soporte/seguridad/privacidad y su estado.',
          'La versión inicial no implementa mensajería privada, geolocalización precisa ni huella de dispositivo.',
        ],
      },
      {
        heading: 'Finalidades y seguridad',
        paragraphs: [
          'Los datos se usan para autenticar, operar el mundo autoritativo, medir si la beta es comprensible, responder solicitudes y prevenir abuso. La ejecución del juego solicitada por el participante se apoya en la relación de beta; el estudio voluntario en consentimiento; y seguridad/moderación en el interés legítimo de proteger el grupo.',
          'D1 es la fuente canónica del runtime. Los eventos de juego y auditoría relevantes son append-only mientras la beta está activa. La autenticación usa las cookies necesarias gestionadas por ChatGPT Sites; Territorios no añade cookies publicitarias.',
        ],
      },
      {
        heading: 'Encargados, transferencias y conservación',
        bullets: [
          'OpenAI/ChatGPT Sites aporta autenticación y superficie de aplicación conforme a sus avisos; Cloudflare procesa hosting y D1 conforme a sus condiciones y DPA. Stripe no recibe datos porque no está configurado en esta beta.',
          'Estos proveedores pueden implicar tratamiento internacional según sus términos y salvaguardas. Los enlaces oficiales aparecen al final; la beta no afirma residencia exclusiva en la UE.',
          'Identidad de cuenta y estado de juego: hasta 30 días después de terminar la beta; luego se eliminan o se desvinculan los identificadores directos.',
          'Reportes, seguridad y auditoría: 90 días desde cierre, salvo incidente activo u obligación aplicable. Copias de seguridad: rotación máxima de 30 días. Prueba de consentimiento y solicitudes: 12 meses.',
        ],
      },
      {
        heading: 'Tus derechos y contacto',
        paragraphs: [
          'Desde “Contacto y derechos” puedes pedir acceso o eliminación sin escribir correo, dirección ni texto libre. Recibirás un ID de solicitud y revisión inicial en un máximo de 24 horas. La eliminación puede conservar un registro mínimo cuando sea necesario para seguridad, una obligación aplicable o la defensa de reclamaciones; se explicará en la respuesta.',
          'La solicitud cubre los datos de Territorios. Los datos de la cuenta ChatGPT se gestionan por separado con los controles y el portal de privacidad de OpenAI.',
        ],
      },
    ],
  },
  refunds: {
    title: 'Política de reembolsos y disputas',
    summary: 'No hay compras ni reembolsos: la beta cerrada no acepta dinero real ni checkout sandbox.',
    sections: [
      {
        heading: 'Reembolsos',
        bullets: [
          'Esta versión no ofrece tienda ni solicita datos de tarjeta.',
          'Si observas un cargo relacionado con Territorios, registra de inmediato una solicitud de seguridad: sería un incidente porque esta release no tiene pagos habilitados.',
        ],
      },
      {
        heading: 'Chargebacks',
        paragraphs: [
          'No existe un flujo de chargeback en la beta cerrada. Cualquier futura prueba comercial requerirá un release, consentimiento, política y revisión separados.',
        ],
      },
      {
        heading: 'Fuente de verdad',
        paragraphs: [
          'La metadata visible del release declara realMoney=false y la interfaz no ofrece la tienda. No se añaden secretos de Stripe al deployment.',
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
          'Esta beta no tiene potencia pagada: todos los refuerzos disponibles para participantes son gratuitos.',
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
          'Report, mute y block están disponibles desde la actividad. Davut Emre actúa como moderador/on-call de esta beta: amenaza urgente o doxxing se revisa en 1 hora; reporte normal en 24 horas; apelación en 72 horas. Una regla puede priorizar, pero una sanción material requiere decisión humana.',
          'La vía “Contacto y derechos” permite registrar seguridad urgente y apelaciones con un recibo. El operador puede poner el sitio en solo propietario mientras investiga. Riesgo inmediato para una persona se escala a los servicios de emergencia adecuados; material de abuso infantil no se redistribuye y se escala a la autoridad/canal competente.',
        ],
      },
    ],
  },
};

const englishDocuments: Record<string, LegalDocument> = {
  terms: {
    title: 'Territorios Beta Terms',
    summary: 'Version closed-beta-2026-08-25-v1 · Private 18+ beta with no real money; not a commercial offer.',
    sections: [
      {
        heading: 'Scope of this demonstration',
        paragraphs: [
          'Territorios is a persistent territorial strategy game operated for an invited group by Davut Emre. This release shows no store, configures no Stripe credentials, and accepts no payments or real cards.',
          'The beta is not public. Enabling payments, widening access, or presenting the service as commercial requires a separate legal and operational review.',
        ],
      },
      {
        heading: 'Account and age',
        bullets: [
          'Free play uses the ChatGPT Sites sign-in identity.',
          'The beta is limited to invited people aged 18 or older through an explicit declaration and versioned consent.',
          'An account may not use automation, impersonation, or coordinated multiple identities.',
        ],
      },
      {
        heading: 'Nature of the digital content',
        bullets: [
          'There are no paid packages in this beta. Units, the Crown, and provinces are symbolic game elements, not investments, property, or political participation.',
          'There is no cash-out, resale, player-to-player exchange, material prize, cryptoasset, gambling, loot box, or paid-entry tournament.',
          'Every participant contribution available in this beta is free and determined exclusively by the server.',
        ],
      },
      {
        heading: 'Suspension and changes',
        paragraphs: [
          'The operator may close access or pause an account in response to abuse, risks to minors, a security incident, or rule violations. Seasons, balance, and availability may change; the privacy notice defines which history is retained and for how long.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Beta Privacy Notice',
    summary: 'Controller: Davut Emre · Data minimization by design · No card, geolocation, or free-form chat data.',
    sections: [
      {
        heading: 'Data processed',
        bullets: [
          'The identifier, email address, and display name supplied by ChatGPT Sites to authenticate the account.',
          'Province, role, ballots, orders, contributions, preferences, reports, and game anti-fraud or audit records.',
          'Random participant ID, consent version/time, task metrics, support/security/privacy requests, and their status.',
          'The initial release does not implement private messaging, precise geolocation, or device fingerprinting.',
        ],
      },
      {
        heading: 'Purposes and security',
        paragraphs: [
          'Data is used to authenticate, operate the authoritative world, evaluate beta comprehension, answer requests, and prevent abuse. Requested game operation relies on the beta relationship, the voluntary study on consent, and security/moderation on the legitimate interest of protecting the group.',
          'D1 is the canonical runtime source. Relevant game and audit events remain append-only while the beta is active. Authentication uses necessary cookies managed by ChatGPT Sites; Territorios adds no advertising cookies.',
        ],
      },
      {
        heading: 'Processors, transfers, and retention',
        bullets: [
          'OpenAI/ChatGPT Sites supplies authentication and the application surface under its notices; Cloudflare processes hosting and D1 under its terms and DPA. Stripe receives no data because it is not configured for this beta.',
          'Those providers may involve international processing under their terms and safeguards. Official references appear below; the beta does not claim EU-only residency.',
          'Account identity and game state: up to 30 days after beta closure, followed by deletion or unlinking of direct identifiers.',
          'Reports, security, and audit records: 90 days after closure unless an incident or applicable duty remains open. Backups: maximum 30-day rotation. Consent/request proof: 12 months.',
        ],
      },
      {
        heading: 'Your rights and contact',
        paragraphs: [
          'Use “Contact and rights” to request access or deletion without entering an email, address, or free text. You receive a request ID and an initial review within 24 hours. A minimal record may be retained where needed for security, an applicable duty, or legal claims; the response will explain this.',
          'The request covers Territorios data. ChatGPT account data is managed separately through OpenAI data controls and its privacy portal.',
        ],
      },
    ],
  },
  refunds: {
    title: 'Refund and Dispute Policy',
    summary: 'No purchases or refunds: the closed beta accepts neither real money nor sandbox checkout.',
    sections: [
      {
        heading: 'Refunds',
        bullets: [
          'This release offers no store and asks for no card data.',
          'If you observe a Territorios-related charge, immediately submit a security request: it would be an incident because this release has no enabled payments.',
        ],
      },
      {
        heading: 'Chargebacks',
        paragraphs: [
          'There is no chargeback flow in the closed beta. Any future commercial test requires a separate release, consent, policy, and review.',
        ],
      },
      {
        heading: 'Source of truth',
        paragraphs: [
          'Visible release metadata declares realMoney=false, and the interface exposes no store. No Stripe secrets are added to deployment.',
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
          'This beta has no purchased power: every reinforcement available to participants is free.',
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
          'Report, mute, and block controls are available from activity. Davut Emre is moderator/on-call for this beta: urgent threats or doxxing are reviewed within 1 hour, normal reports within 24 hours, and appeals within 72 hours. A material sanction requires a human decision.',
          '“Contact and rights” records urgent security and appeal requests with a receipt. The operator may return the site to owner-only access while investigating. Immediate danger is escalated to appropriate emergency services; child sexual abuse material is not redistributed and is escalated through the competent authority/channel.',
        ],
      },
    ],
  },
};

const documents: Record<AppLocale, Record<string, LegalDocument>> = {
  es: spanishDocuments,
  en: englishDocuments,
};

const officialReferences = {
  es: [
    { href: 'https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en', label: 'Comisión Europea · derechos de las personas' },
    { href: 'https://openai.com/policies/eu-services-privacy-policy/', label: 'OpenAI · aviso de privacidad para servicios UE' },
    { href: 'https://www.cloudflare.com/cloudflare-customer-dpa/', label: 'Cloudflare · Data Processing Addendum' },
  ],
  en: [
    { href: 'https://commission.europa.eu/law/law-topic/data-protection/information-individuals_en', label: 'European Commission · individual data rights' },
    { href: 'https://openai.com/policies/eu-services-privacy-policy/', label: 'OpenAI · EU services privacy policy' },
    { href: 'https://www.cloudflare.com/cloudflare-customer-dpa/', label: 'Cloudflare · Data Processing Addendum' },
  ],
} as const;

const pageCopy = {
  es: {
    back: '← Volver al mapa',
    eyebrow: 'Territorios · transparencia beta',
    navigation: 'Documentos legales',
    references: 'Referencias oficiales',
    updated: 'Última actualización: 25 de agosto de 2026.',
  },
  en: {
    back: '← Back to map',
    eyebrow: 'Territorios · beta transparency',
    navigation: 'Legal documents',
    references: 'Official references',
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
      <section>
        <h2>{copy.references}</h2>
        <ul>
          {officialReferences[locale].map((reference) => (
            <li key={reference.href}><a href={reference.href} target="_blank" rel="noreferrer">{reference.label}</a></li>
          ))}
        </ul>
      </section>
      <nav className="legal-document-nav" aria-label={copy.navigation}>
        {Object.entries(localizedDocuments).map(([slug, entry]) => (
          <Link key={slug} href={`/legal/${slug}?lang=${locale}`}>{entry.title}</Link>
        ))}
      </nav>
      <small>{copy.updated}</small>
    </main>
  );
}
