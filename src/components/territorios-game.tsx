'use client';

import { geoMercator, geoPath } from 'd3-geo';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CommunitySnapshot, WorldSnapshot } from '../contracts/game';
import { resolveBattleTick } from '../domain/combat/combat';
import { interpolate, type AppLocale, type PlayerRole, roleLabels, uiCopy } from '../i18n/messages';
import { CommunityHub } from './community-hub';

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
const TICK_MILLISECONDS = 60 * 60 * 1_000;
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
  const [world, setWorld] = useState<WorldSnapshot | null>(null);
  const [community, setCommunity] = useState<CommunitySnapshot | null>(null);
  const [mapError, setMapError] = useState(false);
  const [worldError, setWorldError] = useState(false);
  const [communityError, setCommunityError] = useState(false);
  const [locale, setLocale] = useState<AppLocale>('es');
  const [commandMessage, setCommandMessage] = useState('');
  const [commandPending, setCommandPending] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState('45');
  const [selectedRole, setSelectedRole] = useState<PlayerRole>('defender');
  const [supportAvailable, setSupportAvailable] = useState(0);
  const [attackerPower, setAttackerPower] = useState(7_000);
  const [siegeBp, setSiegeBp] = useState(4_200);
  const [nextTickAt, setNextTickAt] = useState(INITIAL_TICK_AT);
  const [simulatedNow, setSimulatedNow] = useState(
    INITIAL_TICK_AT - TICK_MILLISECONDS,
  );
  const gameRootRef = useRef<HTMLDivElement>(null);
  const copy = uiCopy[locale];

  const applyWorld = useCallback((worldData: WorldSnapshot) => {
    const battle = worldData.battles[0];
    if (battle) {
      setSiegeBp(battle.siegeBp);
      setAttackerPower(battle.freeAttackPower);
    }
    setSupportAvailable(worldData.viewer?.wallet?.freeSupport ?? 0);
    setSimulatedNow(worldData.serverTime);
    setNextTickAt(
      worldData.season.startsAt +
        (worldData.season.lastResolvedTick + 2) * TICK_MILLISECONDS,
    );
    const preferredLocale = worldData.viewer?.preferences?.locale;
    if (preferredLocale === 'es' || preferredLocale === 'en') setLocale(preferredLocale);
    setWorld(worldData);
  }, []);

  useEffect(() => {
    let current = true;
    Promise.all([
      fetch('/data/provinces.geojson').then((response) => {
        if (!response.ok) throw new Error('Province map unavailable');
        return response.json() as Promise<ProvinceCollection>;
      }),
      fetch('/api/game').then((response) => {
        if (!response.ok) throw new Error('Game world unavailable');
        return response.json() as Promise<WorldSnapshot>;
      }),
    ])
      .then(([mapData, worldData]) => {
        if (!current) return;
        setProvinces(mapData);
        applyWorld(worldData);
      })
      .catch(() => {
        if (current) {
          setMapError(true);
          setWorldError(true);
        }
      });
    return () => {
      current = false;
    };
  }, [applyWorld]);

  useEffect(() => {
    let current = true;
    fetch('/api/community')
      .then((response) => {
        if (!response.ok) throw new Error('Community unavailable');
        return response.json() as Promise<CommunitySnapshot>;
      })
      .then((snapshot) => {
        if (snapshot.mode !== 'live-community' || !snapshot.council) {
          throw new Error('Invalid community snapshot');
        }
        if (current) setCommunity(snapshot);
      })
      .catch(() => {
        if (current) setCommunityError(true);
      });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

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
        mode: world?.mode ?? 'loading-world',
        selectedTerritory,
        siegeBp,
        supportAvailable,
        attackerPower,
        defenderPower: 3_000,
        nextTickAt: new Date(nextTickAt).toISOString(),
        mapStatus: mapError ? 'error' : provinces ? 'ready' : 'loading',
        mapProvinces: provinces?.features.length ?? 0,
        worldTerritories: world?.territories.length ?? 0,
        communityStatus: communityError ? 'error' : community ? 'ready' : 'loading',
        councilSeatsFilled: community?.council.seats.filter((seat) => seat.memberRef).length ?? 0,
        locale,
        engineVersion: world?.season.engineVersion ?? null,
        coordinateSystem: 'GeoJSON EPSG:4326 projected to SVG',
      });
    return () => {
      delete (window as Partial<Window>).advanceTime;
      delete (window as Partial<Window>).render_game_to_text;
    };
  }, [attackerPower, community, communityError, locale, mapError, nextTickAt, provinces, resolveTicks, selectedTerritory, siegeBp, supportAvailable, world]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || event.metaKey || event.ctrlKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.matches('input, textarea, select')) return;
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
  const selectedState = world?.territories.find(
    (territory) => territory.code === selectedTerritory,
  );
  const activeBattle = world?.battles[0] ?? null;
  const countdown = nextTickAt - simulatedNow;
  const isOwnedByViewer = Boolean(
    selectedState &&
      world?.viewer?.membership?.factionId === selectedState.ownerFactionId,
  );
  const isBattleTarget = activeBattle?.targetTerritoryCode === selectedTerritory;
  const seasonDay = world
    ? Math.min(28, Math.max(1, Math.floor((world.serverTime - world.season.startsAt) / (24 * 60 * 60 * 1_000)) + 1))
    : 12;

  const sendSupport = async () => {
    if (!activeBattle || supportAvailable < 50 || commandPending) return;
    if (!world?.viewer) {
      setCommandMessage('Inicia sesión para enviar refuerzos al mundo persistente.');
      return;
    }
    if (!world.viewer.membership) {
      setCommandMessage('Elige primero la provincia que representarás esta temporada.');
      return;
    }
    setCommandPending(true);
    setCommandMessage('');
    try {
      const response = await fetch('/api/game/support', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `support-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({
          battleId: activeBattle.id,
          amount: 50,
          assetKind: 'free_support',
        }),
      });
      const result = (await response.json()) as WorldSnapshot | { error: string };
      if (!response.ok || 'error' in result) {
        throw new Error('error' in result ? result.error : 'Orden rechazada.');
      }
      applyWorld(result);
      setCommandMessage('50 refuerzos registrados en el ledger de batalla.');
    } catch (error) {
      setCommandMessage(error instanceof Error ? error.message : 'No se pudo completar la orden.');
    } finally {
      setCommandPending(false);
    }
  };

  const joinSelectedFaction = async () => {
    if (!world?.viewer || commandPending) return;
    setCommandPending(true);
    setCommandMessage('');
    try {
      const response = await fetch('/api/game/join', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `join-${crypto.randomUUID()}`,
        },
        body: JSON.stringify({ territoryCode: selectedTerritory, role: selectedRole }),
      });
      const result = (await response.json()) as WorldSnapshot | { error: string };
      if (!response.ok || 'error' in result) {
        throw new Error('error' in result ? result.error : 'Selección rechazada.');
      }
      applyWorld(result);
      setCommandMessage(`Ahora representas ${selectedName}.`);
    } catch (error) {
      setCommandMessage(error instanceof Error ? error.message : 'No se pudo elegir la facción.');
    } finally {
      setCommandPending(false);
    }
  };

  return (
    <div className="game-shell" ref={gameRootRef}>
      <a className="skip-link" href="#game-map">Ir al mapa</a>
      <header className="topbar">
        <div className="brand-lockup">
          <CrownMark />
          <div>
            <span className="brand-name">TERRITORIOS</span>
            <span className="brand-subtitle">{copy.brandSubtitle}</span>
          </div>
        </div>

        <div className="season-chip" aria-label="Temporada actual">
          <span className="live-dot" />
          <span>{copy.season} {world?.season.number ?? 'I'}</span>
          <strong>{interpolate(copy.day, { day: seasonDay })}</strong>
        </div>

        <div className="resource-strip" aria-label="Recursos de la facción">
          <div className="resource-item"><ResourceIcon kind="grain" /><span><strong>1.240</strong><small>{copy.supplies}</small></span></div>
          <div className="resource-item"><ResourceIcon kind="shield" /><span><strong>{formatNumber(supportAvailable)}</strong><small>{copy.reinforcements}</small></span></div>
          <div className="resource-item resource-coins"><ResourceIcon kind="coin" /><span><strong>{formatNumber(world?.viewer?.wallet?.paidSupport ?? 0)}</strong><small>{copy.paidSupport}</small></span></div>
          <button className="avatar" aria-label="Abrir perfil">{world?.viewer?.displayName.slice(0, 2).toUpperCase() ?? 'TC'}</button>
        </div>
      </header>

      <main className="game-main">
        <section className="map-panel" aria-labelledby="map-heading">
          <div className="map-heading-row">
            <div>
              <span className="eyebrow">{copy.front}</span>
              <h1 id="map-heading">{copy.crownHeading}</h1>
            </div>
            <div className="map-actions">
              <button className="icon-button" aria-label={copy.centerMap}><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></svg></button>
              <button className="icon-button" aria-label={copy.mapHelp}>?</button>
            </div>
          </div>

          <div className="map-stage" id="game-map">
            <div className="map-grid" aria-hidden="true" />
            {mapError ? (
              <div className="map-state" role="alert">{copy.mapError}</div>
            ) : mapPaths.length === 0 ? (
              <div className="map-state" role="status">{copy.mapLoading}</div>
            ) : (
              <svg className="spain-map" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} role="group" aria-label={copy.mapAria}>
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
                        aria-label={interpolate(copy.selectProvince, { name: feature.properties.name })}
                        aria-pressed={isSelected}
                        data-faction={
                          world?.territories.find((territory) => territory.code === code)?.siegeBp
                            ? 'contested'
                            : world?.territories.find((territory) => territory.code === code)?.color ?? factionByCode(code)
                        }
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
              <span><i className="legend-coral" />{copy.yourFaction}</span><span><i className="legend-teal" />{copy.seaHouse}</span><span><i className="legend-gold" />{copy.goldenLeague}</span><span><i className="legend-siege" />{copy.contested}</span>
            </div>
          </div>
          <p className="map-attribution">{copy.mapAttribution}</p>
        </section>

        <aside className="command-panel" aria-label={copy.commandCenter}>
          {worldError ? <div className="command-alert" role="alert">{copy.worldError}</div> : null}
          <section className="province-card">
            <div className="card-topline"><span className={isBattleTarget ? 'status-siege' : 'status-owned'}><i />{isBattleTarget ? copy.siegeActive : isOwnedByViewer ? copy.underControl : copy.stable}</span><button aria-label="Más opciones de provincia">•••</button></div>
            <div className="province-title-row"><span className={`large-crest ${isBattleTarget ? 'crest-siege' : 'crest-coral'}`}>{selectedName.slice(0, 1)}</span><div><span className="eyebrow">{copy.province} {selectedTerritory}</span><h2>{selectedName}</h2></div></div>
            {!isBattleTarget ? (
              <div className="owned-summary"><strong>{isOwnedByViewer ? copy.factionCapital : selectedState?.ownerFactionName ?? copy.neutralProvince}</strong><p>{copy.fortified}</p><dl><div><dt>{copy.defense}</dt><dd>{formatNumber((selectedState?.freeGarrison ?? 8_400) + (selectedState?.paidGarrison ?? 0))}</dd></div><div><dt>{copy.supplyIndex}</dt><dd>{selectedState?.supply ?? 1_000}</dd></div></dl></div>
            ) : (
              <>
                <div className="battle-route"><span className="route-text">{activeBattle?.originName ?? 'Madrid'} → {activeBattle?.targetName ?? 'Toledo'}</span></div>
                <div className="siege-progress-heading"><span>{copy.siegeProgress}</span><strong>{Math.floor(siegeBp / 100)}%</strong></div>
                <div className="siege-progress" role="progressbar" aria-label={copy.siegeProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(siegeBp / 100)}><span style={{ width: `${siegeBp / 100}%` }} /></div>
                <div className="tick-row"><span>{copy.nextCalculation}</span><strong>{formatCountdown(countdown)}</strong></div>
                <div className="army-comparison"><div><span className="army-dot attacker-dot" /><span>{formatNumber(attackerPower)} {copy.attackPower}</span><strong>{formatNumber(attackerPower)}</strong></div><div><span className="army-dot defender-dot" /><span>{formatNumber(selectedState?.freeGarrison ?? 3_000)} {copy.defensePower}</span><strong>{formatNumber(selectedState?.freeGarrison ?? 3_000)}</strong></div></div>
              </>
            )}
          </section>

          <section className="support-card">
            <div className="support-heading"><div><span className="eyebrow">{copy.immediateOrder}</span><h3>{copy.sendSupportTitle}</h3></div><span className="support-balance">{interpolate(copy.supportAvailable, { count: formatNumber(supportAvailable) })}</span></div>
            <p>{copy.supportDescription}</p>
            {!world?.viewer ? (
              <a className="primary-action" href="/signin-with-chatgpt?return_to=%2F">{copy.signIn}</a>
            ) : !world.viewer.membership ? (
              <div className="join-controls">
                <label htmlFor="role-choice">{copy.chooseRole}</label>
                <select id="role-choice" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as PlayerRole)} disabled={commandPending}>
                  {(Object.keys(roleLabels[locale]) as PlayerRole[]).map((role) => <option key={role} value={role}>{roleLabels[locale][role]}</option>)}
                </select>
                <button className="primary-action" type="button" disabled={commandPending} onClick={joinSelectedFaction}>{interpolate(copy.represent, { name: selectedName })}</button>
              </div>
            ) : (
              <button className="primary-action" type="button" disabled={supportAvailable < 50 || commandPending} onClick={sendSupport} aria-label={copy.sendFifty}><span>{commandPending ? copy.registering : copy.sendFifty}</span><span className="action-cost"><ResourceIcon kind="shield" />50</span></button>
            )}
            {commandMessage ? <p className="command-message" role="status">{commandMessage}</p> : null}
            <div className="fair-play-note"><ResourceIcon kind="shield" /><span><strong>{copy.fairPlay}</strong>{copy.paidCap}</span></div>
          </section>

          <section className="activity-card">
            <div className="section-heading"><h3>{copy.recentEvents}</h3><a href="#community-hub">{copy.activity}</a></div>
            {world?.recentEvents.length ? <ol className="activity-list">{world.recentEvents.slice(0, 2).map((event) => <li key={event.sequence}><span className="mini-avatar avatar-one">#{event.sequence}</span><p><strong>{event.eventType.replaceAll('_', ' ')}</strong><time>{event.payloadHash.slice(0, 12)}</time></p></li>)}</ol> : <p className="empty-state">{copy.noEvents}</p>}
          </section>
        </aside>
      </main>

      <CommunityHub
        community={community}
        communityError={communityError}
        locale={locale}
        onCommunity={setCommunity}
        onLocale={setLocale}
        onWorld={applyWorld}
        world={world}
      />

      <nav className="mobile-nav" aria-label="Navegación del juego"><a href="#game-map" aria-current="page">{copy.map}</a><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('territorios:tab', { detail: 'council' }))}>{copy.council}</button><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('territorios:tab', { detail: 'leaderboard' }))}>{copy.leaderboard}</button></nav>
    </div>
  );
}
