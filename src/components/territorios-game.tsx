'use client';

import { geoMercator, geoPath } from 'd3-geo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveBattleTick } from '../domain/combat/combat';

type Position = [number, number];

type ProvinceGeometry =
  | { type: 'Polygon'; coordinates: Position[][] }
  | { type: 'MultiPolygon'; coordinates: Position[][][] };

type ProvinceFeature = {
  type: 'Feature';
  id: string;
  properties: {
    code: string;
    name: string;
    nationalCode: string;
  };
  geometry: ProvinceGeometry;
};

type ProvinceCollection = {
  type: 'FeatureCollection';
  features: ProvinceFeature[];
};

const MAP_WIDTH = 760;
const MAP_HEIGHT = 530;
const TICK_MILLISECONDS = 30 * 60 * 1_000;
const INITIAL_TICK_AT = Date.UTC(2026, 7, 25, 3, 30, 0);
const COMBAT_MODIFIERS = {
  supplyBp: 10_000,
  distanceBp: 10_000,
  overextensionBp: 10_000,
  fortificationBp: 10_000,
  homelandBp: 10_000,
};

const factionByCode = (code: string) => {
  if (code === '28') return 'coral';
  if (code === '45') return 'contested';
  const value = Number(code);
  if (value % 5 === 0) return 'gold';
  if (value % 3 === 0) return 'coral';
  if (value % 2 === 0) return 'teal';
  return 'neutral';
};

function formatNumber(value: number) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function CrownMark() {
  return (
    <svg aria-hidden="true" className="brand-mark" viewBox="0 0 48 48">
      <path d="M8 17 17 25l7-15 7 15 9-8-4 21H12L8 17Z" />
      <path d="M14 33h20" />
    </svg>
  );
}

function ResourceIcon({ kind }: { kind: 'grain' | 'shield' | 'coin' }) {
  if (kind === 'grain') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 21V8m0 4c-4 0-6-2-6-5 4 0 6 2 6 5Zm0 3c4 0 6-2 6-5-4 0-6 2-6 5ZM9 8C7 7 6 5 7 3c3 1 4 3 2 5Zm6 0c2-1 3-3 2-5-3 1-4 3-2 5Z" />
      </svg>
    );
  }
  if (kind === 'shield') {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6l8-3Z" />
        <path d="m8.5 12 2.2 2.2 4.8-5" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="8" />
      <path d="M14.5 8.5c-.6-.7-1.4-1-2.5-1-1.7 0-3 1.2-3 2.7S10.3 13 12 13s3 1.2 3 2.7-1.3 2.8-3 2.8c-1.1 0-2-.4-2.6-1.1M12 5v14" />
    </svg>
  );
}

export function TerritoriosGame() {
  const [provinces, setProvinces] = useState<ProvinceCollection | null>(null);
  const [mapError, setMapError] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState('45');
  const [supportAvailable, setSupportAvailable] = useState(300);
  const [attackerPower, setAttackerPower] = useState(7_000);
  const [siegeBp, setSiegeBp] = useState(4_200);
  const [nextTickAt, setNextTickAt] = useState(INITIAL_TICK_AT);
  const [simulatedNow, setSimulatedNow] = useState(
    INITIAL_TICK_AT - TICK_MILLISECONDS,
  );
  const gameRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let current = true;
    fetch('/data/provinces.geojson')
      .then((response) => {
        if (!response.ok) throw new Error('Province map unavailable');
        return response.json() as Promise<ProvinceCollection>;
      })
      .then((data) => {
        if (current) setProvinces(data);
      })
      .catch(() => {
        if (current) setMapError(true);
      });
    return () => {
      current = false;
    };
  }, []);

  const resolveTicks = useCallback((milliseconds: number) => {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
    setSimulatedNow((currentNow) => {
      const targetNow = currentNow + milliseconds;
      setNextTickAt((currentTickAt) => {
        let tickAt = currentTickAt;
        let ticks = 0;
        while (targetNow >= tickAt) {
          tickAt += TICK_MILLISECONDS;
          ticks += 1;
        }
        if (ticks > 0) {
          setSiegeBp((currentSiege) => {
            let updated = currentSiege;
            for (let index = 0; index < ticks; index += 1) {
              updated = resolveBattleTick({
                previousSiegeBp: updated,
                attacker: {
                  freeUnits: BigInt(attackerPower),
                  paidUnits: 0n,
                  modifiers: COMBAT_MODIFIERS,
                },
                defender: {
                  freeUnits: 3_000n,
                  paidUnits: 0n,
                  modifiers: COMBAT_MODIFIERS,
                },
              }).siegeBp;
            }
            return updated;
          });
        }
        return tickAt;
      });
      return targetNow;
    });
  }, [attackerPower]);

  useEffect(() => {
    window.advanceTime = resolveTicks;
    window.render_game_to_text = () =>
      JSON.stringify({
        mode: 'demo-season',
        selectedTerritory,
        siegeBp,
        supportAvailable,
        attackerPower,
        defenderPower: 3_000,
        nextTickAt: new Date(nextTickAt).toISOString(),
        mapStatus: mapError ? 'error' : provinces ? 'ready' : 'loading',
        mapProvinces: provinces?.features.length ?? 0,
        coordinateSystem: 'GeoJSON EPSG:4326 projected to SVG',
      });
    return () => {
      delete (window as Partial<Window>).advanceTime;
      delete (window as Partial<Window>).render_game_to_text;
    };
  }, [attackerPower, mapError, nextTickAt, provinces, resolveTicks, selectedTerritory, siegeBp, supportAvailable]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || event.metaKey || event.ctrlKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select')) return;
      if (document.fullscreenElement) {
        void document.exitFullscreen();
      } else {
        void gameRootRef.current?.requestFullscreen();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const mapPaths = useMemo(() => {
    if (!provinces) return [];
    const projection = geoMercator().fitExtent(
      [[28, 20], [MAP_WIDTH - 28, MAP_HEIGHT - 26]],
      provinces as never,
    );
    const path = geoPath(projection);
    return provinces.features.map((feature) => ({
      feature,
      path: path(feature as never) ?? '',
    }));
  }, [provinces]);

  const selectedProvince = provinces?.features.find(
    (feature) => feature.properties.code === selectedTerritory,
  );
  const selectedName = selectedProvince?.properties.name ??
    (selectedTerritory === '28' ? 'Madrid' : 'Toledo');
  const countdown = nextTickAt - simulatedNow;
  const isMadrid = selectedTerritory === '28';

  const sendSupport = () => {
    if (supportAvailable < 50) return;
    setSupportAvailable((current) => current - 50);
    setAttackerPower((current) => current + 50);
  };

  return (
    <div className="game-shell" ref={gameRootRef}>
      <a className="skip-link" href="#game-map">Ir al mapa</a>
      <header className="topbar">
        <div className="brand-lockup">
          <CrownMark />
          <div>
            <span className="brand-name">TERRITORIOS</span>
            <span className="brand-subtitle">La corona se decide provincia a provincia</span>
          </div>
        </div>

        <div className="season-chip" aria-label="Temporada actual">
          <span className="live-dot" />
          <span>Temporada I</span>
          <strong>Día 12 de 30</strong>
        </div>

        <div className="resource-strip" aria-label="Recursos de la facción">
          <div className="resource-item"><ResourceIcon kind="grain" /><span><strong>1.240</strong><small>Suministros</small></span></div>
          <div className="resource-item"><ResourceIcon kind="shield" /><span><strong>{formatNumber(supportAvailable)}</strong><small>Refuerzos</small></span></div>
          <div className="resource-item resource-coins"><ResourceIcon kind="coin" /><span><strong>80</strong><small>Coronas</small></span></div>
          <button className="avatar" aria-label="Abrir perfil">ET</button>
        </div>
      </header>

      <main className="game-main">
        <section className="map-panel" aria-labelledby="map-heading">
          <div className="map-heading-row">
            <div>
              <span className="eyebrow">Frente central · Mundo de demostración</span>
              <h1 id="map-heading">La corona se decide aquí</h1>
            </div>
            <div className="map-actions">
              <button className="icon-button" aria-label="Centrar mapa"><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></svg></button>
              <button className="icon-button" aria-label="Mostrar ayuda del mapa">?</button>
            </div>
          </div>

          <div className="map-stage" id="game-map">
            <div className="map-grid" aria-hidden="true" />
            {mapError ? (
              <div className="map-state" role="alert">No se pudo cargar el mapa oficial.</div>
            ) : mapPaths.length === 0 ? (
              <div className="map-state" role="status">Trazando las 52 provincias…</div>
            ) : (
              <svg className="spain-map" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="img" aria-label="Mapa de Territorios con las 52 provincias de España">
                <defs>
                  <filter id="selected-glow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="0" stdDeviation="5" floodColor="#ffb45d" floodOpacity="0.9" /></filter>
                  <pattern id="siege-lines" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="#df5b50" /><line x1="0" y1="0" x2="0" y2="8" stroke="#f8c38a" strokeWidth="2" opacity=".55" /></pattern>
                </defs>
                <g className="province-layer">
                  {mapPaths.map(({ feature, path }) => {
                    const code = feature.properties.code;
                    const isSelected = code === selectedTerritory;
                    return (
                      <path
                        key={code}
                        d={path}
                        role="button"
                        tabIndex={0}
                        aria-label={`Seleccionar ${feature.properties.name}`}
                        aria-pressed={isSelected}
                        data-faction={factionByCode(code)}
                        data-selected={isSelected ? 'true' : undefined}
                        onClick={() => setSelectedTerritory(code)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            setSelectedTerritory(code);
                          }
                        }}
                      ><title>{feature.properties.name}</title></path>
                    );
                  })}
                </g>
              </svg>
            )}

            <div className="front-label front-madrid" aria-hidden="true"><span className="crest crest-coral">M</span><span>Madrid<strong>Capital</strong></span></div>
            <div className="front-label front-toledo" aria-hidden="true"><span className="battle-pulse" /><span>Toledo<strong>En asedio</strong></span></div>
            <div className="map-legend" aria-label="Leyenda del mapa">
              <span><i className="legend-coral" />Tu facción</span><span><i className="legend-teal" />Casa del Mar</span><span><i className="legend-gold" />Liga Dorada</span><span><i className="legend-siege" />En disputa</span>
            </div>
          </div>
          <p className="map-attribution">Geometría oficial CNIG · BDLJE CC BY 4.0 · Pulsa <kbd>F</kbd> para pantalla completa</p>
        </section>

        <aside className="command-panel" aria-label="Centro de mando">
          <section className="province-card">
            <div className="card-topline"><span className={isMadrid ? 'status-owned' : 'status-siege'}><i />{isMadrid ? 'Bajo tu control' : 'Asedio activo'}</span><button aria-label="Más opciones de provincia">•••</button></div>
            <div className="province-title-row"><span className={`large-crest ${isMadrid ? 'crest-coral' : 'crest-siege'}`}>{isMadrid ? 'M' : 'T'}</span><div><span className="eyebrow">Provincia {selectedTerritory}</span><h2>{selectedName}</h2></div></div>
            {isMadrid ? (
              <div className="owned-summary"><strong>Capital de tu facción</strong><p>Fortificada y conectada. Genera 120 suministros en el próximo reparto.</p><dl><div><dt>Defensa</dt><dd>8.400</dd></div><div><dt>Lealtad</dt><dd>92%</dd></div></dl></div>
            ) : (
              <>
                <div className="battle-route"><span className="route-text">Madrid → Toledo</span></div>
                <div className="siege-progress-heading"><span>Progreso del asedio</span><strong>{Math.floor(siegeBp / 100)}%</strong></div>
                <div className="siege-progress" role="progressbar" aria-label="Progreso del asedio" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(siegeBp / 100)}><span style={{ width: `${siegeBp / 100}%` }} /></div>
                <div className="tick-row"><span>Próximo cálculo</span><strong>{formatCountdown(countdown)}</strong></div>
                <div className="army-comparison"><div><span className="army-dot attacker-dot" /><span>{formatNumber(attackerPower)} fuerza atacante</span><strong>{formatNumber(attackerPower)}</strong></div><div><span className="army-dot defender-dot" /><span>3.000 fuerza defensora</span><strong>3.000</strong></div></div>
              </>
            )}
          </section>

          <section className="support-card">
            <div className="support-heading"><div><span className="eyebrow">Orden inmediata</span><h3>Enviar refuerzos</h3></div><span className="support-balance">{formatNumber(supportAvailable)} disponibles</span></div>
            <p>Refuerza el frente con unidades obtenidas durante la temporada.</p>
            <button className="primary-action" type="button" disabled={supportAvailable < 50} onClick={sendSupport} aria-label="Enviar 50 refuerzos"><span>Enviar 50 refuerzos</span><span className="action-cost"><ResourceIcon kind="shield" />50</span></button>
            <div className="fair-play-note"><ResourceIcon kind="shield" /><span><strong>Juego limpio activo</strong>Los apoyos de pago nunca superan el 20% del poder total.</span></div>
          </section>

          <section className="activity-card">
            <div className="section-heading"><h3>Consejo de guerra</h3><button>Ver todo</button></div>
            <ol className="activity-list"><li><span className="mini-avatar avatar-one">AR</span><p><strong>Ana R.</strong> movilizó 100 unidades <time>hace 4 min</time></p></li><li><span className="mini-avatar avatar-two">JM</span><p><strong>J. Molina</strong> marcó Toledo como prioridad <time>hace 11 min</time></p></li></ol>
          </section>
        </aside>
      </main>

      <nav className="mobile-nav" aria-label="Navegación del juego"><a href="#game-map" aria-current="page">Mapa</a><button>Consejo</button><button>Clasificación</button></nav>
    </div>
  );
}
