'use client';

import { geoMercator, geoPath } from 'd3-geo';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import type { CommunitySnapshot, WorldSnapshot } from '../contracts/game';
import { resolveBattleTick } from '../domain/combat/combat';
import {
  eventSummary,
  interpolate,
  type AppLocale,
  type PlayerRole,
  roleActionDescriptions,
  roleLabels,
  uiCopy,
} from '../i18n/messages';
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
const CANARY_PROVINCE_CODES = new Set(['35', '38']);
const AUTONOMOUS_CITY_CODES = new Set(['51', '52']);

function SurfaceDialog({
  children,
  onClose,
  titleId,
  triggerRef,
}: {
  children: ReactNode;
  onClose: () => void;
  titleId: string;
  triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trigger = triggerRef.current;
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
    return () => trigger?.focus();
  }, [triggerRef]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? []);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (focusable.length === 1 || (event.shiftKey && document.activeElement === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="surface-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      ref={dialogRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}

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

export function TerritoriosGame({
  initialTerritoryCode,
}: {
  initialTerritoryCode?: string;
} = {}) {
  const [provinces, setProvinces] = useState<ProvinceCollection | null>(null);
  const [world, setWorld] = useState<WorldSnapshot | null>(null);
  const [community, setCommunity] = useState<CommunitySnapshot | null>(null);
  const [mapError, setMapError] = useState(false);
  const [worldError, setWorldError] = useState(false);
  const [communityError, setCommunityError] = useState(false);
  const [locale, setLocale] = useState<AppLocale>('es');
  const [commandMessage, setCommandMessage] = useState('');
  const [commandPending, setCommandPending] = useState(false);
  const [selectedTerritory, setSelectedTerritory] = useState(
    initialTerritoryCode?.match(/^\d{2}$/) ? initialTerritoryCode : '45',
  );
  const [selectedBattleId, setSelectedBattleId] = useState('');
  const [selectedRole, setSelectedRole] = useState<PlayerRole>('defender');
  const [supportAvailable, setSupportAvailable] = useState(0);
  const [attackerPower, setAttackerPower] = useState(7_000);
  const [siegeBp, setSiegeBp] = useState(4_200);
  const [nextTickAt, setNextTickAt] = useState(INITIAL_TICK_AT);
  const [simulatedNow, setSimulatedNow] = useState(
    INITIAL_TICK_AT - TICK_MILLISECONDS,
  );
  const [mapHelpOpen, setMapHelpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [provinceOptionsOpen, setProvinceOptionsOpen] = useState(false);
  const [shareOrigin] = useState(() => typeof window === 'undefined' ? '' : window.location.origin);
  const gameRootRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const mapHelpTriggerRef = useRef<HTMLButtonElement>(null);
  const provinceRefs = useRef(new Map<string, SVGPathElement>());
  const copy = uiCopy[locale];
  const changeLocale = useCallback((nextLocale: AppLocale) => {
    setCommandMessage('');
    setLocale(nextLocale);
  }, []);

  const applyWorld = useCallback((worldData: WorldSnapshot) => {
    setSelectedBattleId((current) => {
      if (worldData.battles.some((battle) => battle.id === current)) return current;
      return worldData.battles.find((battle) => battle.canSupport)?.id
        ?? worldData.battles[0]?.id
        ?? '';
    });
    setSupportAvailable(worldData.viewer?.wallet?.freeSupport ?? 0);
    setSimulatedNow(worldData.serverTime);
    setNextTickAt(worldData.season.nextTickAt);
    const preferredLocale = worldData.viewer?.preferences?.locale;
    if (preferredLocale === 'es' || preferredLocale === 'en') changeLocale(preferredLocale);
    setWorld(worldData);
  }, [changeLocale]);

  const refreshWorld = useCallback(async () => {
    if (document.visibilityState === 'hidden') return;
    try {
      const response = await fetch('/api/game');
      if (!response.ok) throw new Error('Game world unavailable');
      applyWorld(await response.json() as WorldSnapshot);
      setWorldError(false);
    } catch {
      setWorldError(true);
    }
  }, [applyWorld]);

  useEffect(() => {
    let current = true;
    fetch('/data/provinces.geojson')
      .then((response) => {
        if (!response.ok) throw new Error('Province map unavailable');
        return response.json() as Promise<ProvinceCollection>;
      })
      .then((mapData) => {
        if (!current) return;
        setProvinces(mapData);
      })
      .catch(() => {
        if (current) setMapError(true);
      });
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshWorld(), 0);
    const interval = window.setInterval(() => void refreshWorld(), 15_000);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshWorld();
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [refreshWorld]);

  useEffect(() => {
    if (!world) return;
    const delay = Math.max(0, world.season.nextTickAt - world.serverTime + 750);
    const timeout = window.setTimeout(() => void refreshWorld(), delay);
    return () => window.clearTimeout(timeout);
  }, [refreshWorld, world]);

  useEffect(() => {
    let current = true;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      fetch('/api/community')
        .then((response) => {
          if (!response.ok) throw new Error('Community unavailable');
          return response.json() as Promise<CommunitySnapshot>;
        })
        .then((snapshot) => {
          if (snapshot.mode !== 'live-community' || !snapshot.council) {
            throw new Error('Invalid community snapshot');
          }
          if (current) {
            setCommunity(snapshot);
            setCommunityError(false);
          }
        })
        .catch(() => {
          if (current) setCommunityError(true);
        });
    };
    refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      current = false;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setSimulatedNow((current) => current + 1_000);
    }, 1_000);
    return () => window.clearInterval(interval);
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

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void gameRootRef.current?.requestFullscreen();
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'f' || event.metaKey || event.ctrlKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.matches('input, textarea, select')) return;
      toggleFullscreen();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleFullscreen]);

  const mapPaths = useMemo(() => {
    if (!provinces) return [];
    const mainlandFeatures = provinces.features.filter(
      (feature) => !CANARY_PROVINCE_CODES.has(feature.properties.code)
        && !AUTONOMOUS_CITY_CODES.has(feature.properties.code),
    );
    const canaryFeatures = provinces.features.filter(
      (feature) => CANARY_PROVINCE_CODES.has(feature.properties.code),
    );
    const autonomousCityFeatures = provinces.features.filter(
      (feature) => AUTONOMOUS_CITY_CODES.has(feature.properties.code),
    );
    const project = (
      features: ProvinceFeature[],
      extent: [[number, number], [number, number]],
      inset: 'canary' | 'autonomous' | null,
    ) => {
      if (features.length === 0) return [];
      const collection: ProvinceCollection = { type: 'FeatureCollection', features };
      const path = geoPath(geoMercator().fitExtent(extent, collection as never));
      return features.map((feature) => ({
        feature,
        inset,
        path: path(feature as never) ?? '',
      }));
    };
    return [
      ...project(mainlandFeatures, [[20, 18], [MAP_WIDTH - 20, 420]], null),
      ...project(canaryFeatures, [[34, 442], [245, MAP_HEIGHT - 18]], 'canary'),
      ...project(autonomousCityFeatures, [[285, 452], [455, MAP_HEIGHT - 18]], 'autonomous'),
    ];
  }, [provinces]);

  const selectedProvince = provinces?.features.find(
    (feature) => feature.properties.code === selectedTerritory,
  );
  const selectedState = world?.territories.find(
    (territory) => territory.code === selectedTerritory,
  );
  const selectedName = selectedProvince?.properties.name ?? selectedState?.name ?? selectedTerritory;
  const activeBattle = world?.battles.find((battle) => battle.id === selectedBattleId) ?? null;
  const countdown = nextTickAt - simulatedNow;
  const selectedBattle = world?.battles.find(
    (battle) => battle.targetTerritoryCode === selectedTerritory,
  ) ?? null;
  const provinceUrl = `${shareOrigin}/province/${selectedTerritory}`;
  const provinceShareText = selectedBattle
    ? interpolate(copy.shareBattleText, {
        name: selectedName,
        progress: Math.floor(selectedBattle.siegeBp / 100),
        minutes: Math.max(0, Math.ceil(countdown / 60_000)),
      })
    : interpolate(copy.shareStableText, {
        name: selectedName,
        owner: selectedState?.ownerFactionName ?? copy.neutralProvince,
      });
  const isOwnedByViewer = Boolean(
    selectedState &&
      world?.viewer?.membership?.factionId === selectedState.ownerFactionId,
  );
  const isBattleTarget = activeBattle?.targetTerritoryCode === selectedTerritory;
  const seasonDay = world
    ? Math.min(28, Math.max(1, Math.floor((world.serverTime - world.season.startsAt) / (24 * 60 * 60 * 1_000)) + 1))
    : 12;
  const onboardingMessage = world ? {
    'sign-in': copy.onboardingSignIn,
    'join-faction': copy.onboardingJoin,
    'support-front': copy.onboardingSupport,
    'wait-for-front': copy.onboardingWait,
    complete: copy.onboardingComplete,
  }[world.onboarding.nextAction] : null;

  useEffect(() => {
    if (!activeBattle) return;
    const update = window.setTimeout(() => {
      setSiegeBp(activeBattle.siegeBp);
      setAttackerPower(activeBattle.freeAttackPower);
    }, 0);
    return () => window.clearTimeout(update);
  }, [activeBattle]);

  const selectTerritory = (code: string) => {
    setCommandMessage('');
    setSelectedTerritory(code);
    const battle = world?.battles.find((entry) => entry.targetTerritoryCode === code);
    if (battle) setSelectedBattleId(battle.id);
  };

  const selectBattle = (battleId: string) => {
    setCommandMessage('');
    setSelectedBattleId(battleId);
    const battle = world?.battles.find((entry) => entry.id === battleId);
    if (battle) setSelectedTerritory(battle.targetTerritoryCode);
  };

  const moveProvinceFocus = (code: string, key: string) => {
    const index = mapPaths.findIndex(({ feature }) => feature.properties.code === code);
    if (index < 0) return;
    let nextIndex = index;
    if (key === 'ArrowRight' || key === 'ArrowDown') nextIndex = (index + 1) % mapPaths.length;
    if (key === 'ArrowLeft' || key === 'ArrowUp') nextIndex = (index - 1 + mapPaths.length) % mapPaths.length;
    if (key === 'Home') nextIndex = 0;
    if (key === 'End') nextIndex = mapPaths.length - 1;
    if (nextIndex === index && !['Home', 'End'].includes(key)) return;
    const nextCode = mapPaths[nextIndex].feature.properties.code;
    selectTerritory(nextCode);
    provinceRefs.current.get(nextCode)?.focus();
  };

  const centerMap = () => {
    const code = world?.viewer?.membership?.territoryCode
      ?? activeBattle?.targetTerritoryCode
      ?? mapPaths[0]?.feature.properties.code;
    if (!code) return;
    selectTerritory(code);
    provinceRefs.current.get(code)?.focus();
  };

  const copyProvinceLink = async () => {
    const url = new URL(`/province/${selectedTerritory}`, window.location.origin).toString();
    await navigator.clipboard.writeText(url);
    setCommandMessage(copy.linkCopied);
  };

  const shareProvince = async () => {
    const data = {
      title: `${selectedName} — Territorios`,
      text: provinceShareText,
      url: new URL(`/province/${selectedTerritory}`, window.location.origin).toString(),
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    await navigator.clipboard.writeText(`${data.text} ${data.url}`);
    setCommandMessage(copy.linkCopied);
  };

  const sendSupport = async () => {
    if (!activeBattle?.canSupport || supportAvailable < 50 || commandPending) return;
    if (!world?.viewer) {
      setCommandMessage(copy.signInSupportError);
      return;
    }
    if (!world.viewer.membership) {
      setCommandMessage(copy.joinFirstError);
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
        throw new Error('error' in result && locale === 'es' ? result.error : copy.orderRejected);
      }
      applyWorld(result);
      setCommandMessage(copy.supportSuccess);
    } catch (error) {
      setCommandMessage(error instanceof Error ? error.message : copy.orderFailed);
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
        throw new Error('error' in result && locale === 'es' ? result.error : copy.joinRejected);
      }
      applyWorld(result);
      setCommandMessage(interpolate(copy.nowRepresenting, { name: selectedName }));
    } catch (error) {
      setCommandMessage(error instanceof Error ? error.message : copy.joinFailed);
    } finally {
      setCommandPending(false);
    }
  };

  return (
    <div className="game-shell" ref={gameRootRef}>
      <a className="skip-link" href="#game-map">{copy.skipToMap}</a>
      <header className="topbar">
        <div className="brand-lockup">
          <CrownMark />
          <div>
            <span className="brand-name">TERRITORIOS</span>
            <span className="brand-subtitle">{copy.brandSubtitle}</span>
          </div>
        </div>

        <div className="season-chip" aria-label={copy.currentSeasonAria}>
          <span className="live-dot" />
          <span>{copy.season} {world?.season.number ?? 'I'}</span>
          <strong>{interpolate(copy.day, { day: seasonDay })}</strong>
        </div>

        <div className="resource-strip" aria-label={copy.factionResourcesAria}>
          <div className="resource-item"><ResourceIcon kind="grain" /><span><strong>{formatNumber(selectedState?.supply ?? 0)}</strong><small>{copy.supplies}</small></span></div>
          <div className="resource-item"><ResourceIcon kind="shield" /><span><strong>{formatNumber(supportAvailable)}</strong><small>{copy.reinforcements}</small></span></div>
          <div className="resource-item resource-coins"><ResourceIcon kind="coin" /><span><strong>{formatNumber(world?.viewer?.wallet?.paidSupport ?? 0)}</strong><small>{copy.paidSupport}</small></span></div>
          <button ref={profileTriggerRef} className="avatar" aria-label={copy.openProfile} onClick={() => setProfileOpen(true)}>{world?.viewer?.displayName.slice(0, 2).toUpperCase() ?? 'TC'}</button>
        </div>
      </header>

      {profileOpen ? (
        <SurfaceDialog titleId="profile-dialog-title" triggerRef={profileTriggerRef} onClose={() => setProfileOpen(false)}>
          <h2 id="profile-dialog-title">{copy.profileTitle}</h2>
          <strong>{world?.viewer?.displayName ?? copy.signedOut}</strong>
          {world?.viewer?.membership ? (
            <p>{world.viewer.membership.factionName} · {roleLabels[locale][world.viewer.membership.role as PlayerRole] ?? world.viewer.membership.role}</p>
          ) : null}
          <button type="button" onClick={() => setProfileOpen(false)}>{copy.close}</button>
        </SurfaceDialog>
      ) : null}

      {mapHelpOpen ? (
        <SurfaceDialog titleId="map-help-title" triggerRef={mapHelpTriggerRef} onClose={() => setMapHelpOpen(false)}>
          <h2 id="map-help-title">{copy.mapHelpTitle}</h2>
          <p>{copy.mapHelpBody}</p>
          <button type="button" onClick={() => setMapHelpOpen(false)}>{copy.close}</button>
        </SurfaceDialog>
      ) : null}

      {onboardingMessage ? (
        <section className={`onboarding-card onboarding-${world?.onboarding.nextAction}`} aria-labelledby="onboarding-title">
          <span>1 · 2 · 3</span>
          <div><strong id="onboarding-title">{copy.onboardingTitle}</strong><p>{onboardingMessage}</p></div>
        </section>
      ) : null}

      <main className="game-main">
        <section className="map-panel" aria-labelledby="map-heading">
          <div className="map-heading-row">
            <div>
              <span className="eyebrow">{copy.front}</span>
              <h1 id="map-heading">{copy.crownHeading}</h1>
            </div>
            <div className="map-actions">
              <button className="icon-button" aria-label={copy.centerMap} onClick={centerMap}><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v4m0 12v4M2 12h4m12 0h4" /></svg></button>
              <button className="icon-button" aria-label={copy.fullscreenMap} onClick={toggleFullscreen}><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 3H3v5m13-5h5v5M8 21H3v-5m13 5h5v-5" /></svg></button>
              <button ref={mapHelpTriggerRef} className="icon-button" aria-label={copy.mapHelp} onClick={() => setMapHelpOpen(true)}>?</button>
            </div>
          </div>

          {world?.battles.length ? (
            <div className="front-selector">
              <label htmlFor="active-front">{copy.activeFront}</label>
              <select id="active-front" value={selectedBattleId} onChange={(event) => selectBattle(event.target.value)}>
                {world.battles.map((battle) => (
                  <option key={battle.id} value={battle.id}>
                    {interpolate(copy.observeFront, { origin: battle.originName, target: battle.targetName })}
                  </option>
                ))}
              </select>
              <span>{activeBattle?.viewerSide === 'attacker' ? copy.yourSideAttacker : activeBattle?.viewerSide === 'defender' ? copy.yourSideDefender : copy.observingFront}</span>
            </div>
          ) : <p className="empty-state">{copy.noActiveFronts}</p>}

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
                  {mapPaths.some(({ inset }) => inset === 'canary') ? <rect className="map-inset-frame" x="25" y="430" width="234" height="94" rx="12" /> : null}
                  {mapPaths.some(({ inset }) => inset === 'autonomous') ? <rect className="map-inset-frame" x="275" y="440" width="190" height="84" rx="12" /> : null}
                  {mapPaths.map(({ feature, inset, path }) => {
                    const code = feature.properties.code;
                    const isSelected = code === selectedTerritory;
                    const territory = world?.territories.find((entry) => entry.code === code);
                    const isViewerTerritory = territory?.ownerFactionId === world?.viewer?.membership?.factionId;
                    const territoryStatus = territory?.siegeBp
                      ? copy.siegeActive
                      : isViewerTerritory
                        ? copy.underControl
                        : copy.stable;
                    return (
                      <path
                        key={code}
                        ref={(node) => {
                          if (node) provinceRefs.current.set(code, node);
                          else provinceRefs.current.delete(code);
                        }}
                        d={path}
                        role="button"
                        tabIndex={isSelected ? 0 : -1}
                        aria-label={interpolate(copy.selectProvince, {
                          name: feature.properties.name,
                          owner: territory?.ownerFactionName ?? copy.neutralProvince,
                          status: territoryStatus,
                          defense: formatNumber((territory?.freeGarrison ?? 0) + (territory?.paidGarrison ?? 0)),
                        })}
                        aria-pressed={isSelected}
                        data-faction={
                          world?.territories.find((territory) => territory.code === code)?.siegeBp
                            ? 'contested'
                            : world?.territories.find((territory) => territory.code === code)?.color ?? factionByCode(code)
                        }
                        data-selected={isSelected ? 'true' : undefined}
                        data-inset={inset ?? undefined}
                        onClick={() => selectTerritory(code)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            selectTerritory(code);
                          }
                          if (['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
                            event.preventDefault();
                            moveProvinceFocus(code, event.key);
                          }
                        }}
                      ><title>{feature.properties.name}</title></path>
                    );
                  })}
                </g>
              </svg>
            )}

            <div className="map-legend" aria-label={copy.mapLegend}>
              <span><i className="legend-coral" />{copy.yourFaction}</span><span><i className="legend-teal" />{copy.seaHouse}</span><span><i className="legend-gold" />{copy.goldenLeague}</span><span><i className="legend-siege" />{copy.contested}</span>
            </div>
          </div>
          <p className="map-attribution">{copy.mapAttribution}</p>
        </section>

        <aside className="command-panel" aria-label={copy.commandCenter}>
          {worldError ? <div className="command-alert" role="alert">{copy.worldError}</div> : null}
          <section className="province-card">
            <div className="card-topline"><span className={isBattleTarget ? 'status-siege' : 'status-owned'}><i />{isBattleTarget ? copy.siegeActive : isOwnedByViewer ? copy.underControl : copy.stable}</span><button aria-label={copy.provinceOptions} onClick={() => setProvinceOptionsOpen((open) => !open)}>•••</button></div>
            {provinceOptionsOpen ? (
              <div className="province-options">
                <strong>{copy.shareProvince}</strong>
                <button type="button" onClick={() => void shareProvince()}>{copy.callReinforcements}</button>
                <button type="button" onClick={() => void copyProvinceLink()}>{copy.copyLink}</button>
                <a href={`https://wa.me/?text=${encodeURIComponent(`${provinceShareText} ${provinceUrl}`)}`} target="_blank" rel="noreferrer">{copy.shareWhatsApp}</a>
                <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(provinceShareText)}&url=${encodeURIComponent(provinceUrl)}`} target="_blank" rel="noreferrer">{copy.shareX}</a>
                <a href={`/province/${selectedTerritory}`}>{interpolate(copy.openProvincePage, { name: selectedName })}</a>
              </div>
            ) : null}
            <div className="province-title-row"><span className={`large-crest ${isBattleTarget ? 'crest-siege' : 'crest-coral'}`}>{selectedName.slice(0, 1)}</span><div><span className="eyebrow">{copy.province} {selectedTerritory}</span><h2>{selectedName}</h2></div></div>
            {!isBattleTarget ? (
              <div className="owned-summary"><strong>{isOwnedByViewer ? copy.factionCapital : selectedState?.ownerFactionName ?? copy.neutralProvince}</strong><p>{copy.fortified}</p><dl><div><dt>{copy.defense}</dt><dd>{formatNumber((selectedState?.freeGarrison ?? 8_400) + (selectedState?.paidGarrison ?? 0))}</dd></div><div><dt>{copy.supplyIndex}</dt><dd>{selectedState?.supply ?? 1_000}</dd></div></dl></div>
            ) : (
              <>
                <div className="battle-route"><span className="route-text">{activeBattle ? `${activeBattle.originName} → ${activeBattle.targetName}` : copy.noActiveFronts}</span></div>
                <div className="siege-progress-heading"><span>{copy.siegeProgress}</span><strong>{Math.floor(siegeBp / 100)}%</strong></div>
                <div className="siege-progress" role="progressbar" aria-label={copy.siegeProgress} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.floor(siegeBp / 100)}><span style={{ width: `${siegeBp / 100}%` }} /></div>
                <div className="tick-row"><span>{copy.nextCalculation}</span><strong>{formatCountdown(countdown)}</strong></div>
                <div className="army-comparison"><div><span className="army-dot attacker-dot" /><span>{formatNumber(attackerPower)} {copy.attackPower}</span><strong>{formatNumber(attackerPower)}</strong></div><div><span className="army-dot defender-dot" /><span>{formatNumber(selectedState?.freeGarrison ?? 3_000)} {copy.defensePower}</span><strong>{formatNumber(selectedState?.freeGarrison ?? 3_000)}</strong></div></div>
                {activeBattle ? (
                  <div className="modifier-grid">
                    <span>{activeBattle.combatContext.supplyConnected ? copy.supplyConnected : copy.supplyDisconnected}</span>
                    <span>{activeBattle.routeKind === 'sea' ? copy.seaRoute : copy.landRoute}</span>
                    <span>{interpolate(copy.overextension, { value: Math.floor(activeBattle.combatContext.attacker.overextensionBp / 100) })}</span>
                    <span>{interpolate(copy.fortificationModifier, { value: Math.floor(activeBattle.combatContext.defender.fortificationBp / 100) })}</span>
                  </div>
                ) : null}
              </>
            )}
          </section>

          <section className="support-card">
            <div className="support-heading"><div><span className="eyebrow">{copy.immediateOrder}</span><h3>{copy.sendSupportTitle}</h3></div><span className="support-balance">{interpolate(copy.supportAvailable, { count: formatNumber(supportAvailable) })}</span></div>
            <p>{copy.supportDescription}</p>
            {activeBattle ? <p className="support-route"><span>{copy.supportRoute}</span><strong>{activeBattle.originName} → {activeBattle.targetName}</strong></p> : null}
            {!world?.viewer ? (
              <a className="primary-action" href="/signin-with-chatgpt?return_to=%2F">{copy.signIn}</a>
            ) : !world.viewer.membership ? (
              <div className="join-controls">
                <label htmlFor="role-choice">{copy.chooseRole}</label>
                <select id="role-choice" value={selectedRole} onChange={(event) => setSelectedRole(event.target.value as PlayerRole)} disabled={commandPending}>
                  {(Object.keys(roleLabels[locale]) as PlayerRole[]).map((role) => <option key={role} value={role}>{roleLabels[locale][role]}</option>)}
                </select>
                <p className="role-description">{roleActionDescriptions[locale][selectedRole]}</p>
                <button className="primary-action" type="button" disabled={commandPending} onClick={joinSelectedFaction}>{interpolate(copy.represent, { name: selectedName })}</button>
              </div>
            ) : activeBattle?.canSupport ? (
              <button className="primary-action" type="button" disabled={supportAvailable < 50 || commandPending} onClick={sendSupport} aria-label={interpolate(copy.sendFiftyTo, { origin: activeBattle.originName, target: activeBattle.targetName })}><span>{commandPending ? copy.registering : copy.sendFifty}</span><span className="action-cost"><ResourceIcon kind="shield" />50</span></button>
            ) : <p className="support-unavailable">{activeBattle?.supportDisabledReason === 'not-party' ? copy.supportNotParty : copy.supportWait}</p>}
            {commandMessage ? <p className="command-message" role="status">{commandMessage}</p> : null}
            <div className="fair-play-note"><ResourceIcon kind="shield" /><span><strong>{copy.fairPlay}</strong>{copy.paidCap}</span></div>
          </section>

          <section className="activity-card">
            <div className="section-heading"><h3>{copy.recentEvents}</h3><a href="#community-hub">{copy.activity}</a></div>
            {world?.recentEvents.length ? <ol className="activity-list">{world.recentEvents.slice(0, 2).map((event) => <li key={event.sequence}><span className="mini-avatar avatar-one">#{event.sequence}</span><p><strong>{eventSummary(locale, event.summaryKey, event.summaryArgs)}</strong><time>{interpolate(copy.integrityShort, { hash: event.payloadHash.slice(0, 12) })}</time></p></li>)}</ol> : <p className="empty-state">{copy.noEvents}</p>}
            {world ? <p className="last-updated">{interpolate(copy.lastUpdated, {
              seconds: Math.max(0, Math.floor((simulatedNow - world.lastUpdatedAt) / 1_000)),
            })}</p> : null}
          </section>
        </aside>
      </main>

      <CommunityHub
        community={community}
        communityError={communityError}
        locale={locale}
        onCommunity={setCommunity}
        onLocale={changeLocale}
        onWorld={applyWorld}
        world={world}
      />

      <nav className="mobile-nav" aria-label={copy.commandCenter}><a href="#game-map" aria-current="page">{copy.map}</a><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('territorios:tab', { detail: 'council' }))}>{copy.council}</button><button type="button" onClick={() => window.dispatchEvent(new CustomEvent('territorios:tab', { detail: 'leaderboard' }))}>{copy.leaderboard}</button></nav>
    </div>
  );
}
