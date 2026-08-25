import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

type LegalDocument = {
  title: string;
  summary: string;
  sections: Array<{ heading: string; paragraphs?: string[]; bullets?: string[] }>;
};

const documents: Record<string, LegalDocument> = {
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
    summary: 'Temporada de 28 días · 52 provincias y ciudades autónomas · motor determinista combat-1.0.0.',
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

export function generateStaticParams() {
  return Object.keys(documents).map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const document = documents[(await params).slug];
  return { title: document ? `${document.title} — Territorios` : 'Territorios' };
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const document = documents[(await params).slug];
  if (!document) notFound();

  return (
    <main className="legal-page">
      <Link className="legal-back" href="/">← Volver al mapa</Link>
      <span className="eyebrow">Territorios · transparencia beta</span>
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
      <nav className="legal-document-nav" aria-label="Documentos legales">
        {Object.entries(documents).map(([slug, entry]) => (
          <Link key={slug} href={`/legal/${slug}`}>{entry.title}</Link>
        ))}
      </nav>
      <small>Última actualización: 25 de agosto de 2026.</small>
    </main>
  );
}
