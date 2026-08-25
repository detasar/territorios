'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CommunitySnapshot, WorldSnapshot } from '../contracts/game';
import {
  ANNOUNCEMENT_MESSAGES,
  translateAnnouncement,
  type AnnouncementKey,
} from '../domain/community/moderation';
import {
  eventSummary,
  interpolate,
  type AppLocale,
  type PlayerRole,
  roleActionDescriptions,
  roleLabels,
  uiCopy,
} from '../i18n/messages';
import { PaymentPanel } from './payment-panel';

type CommunityTab = 'leaderboard' | 'council' | 'activity' | 'store' | 'settings';

const seatCopy = {
  'public-1': 'publicRepresentative',
  'public-2': 'publicRepresentative',
  defense: 'defenseCommander',
  strategy: 'strategyCommander',
  supporter: 'supporterRepresentative',
} as const;

const reportReasons = [
  'illegal-content',
  'hate-harassment',
  'threat',
  'personal-information',
  'fraud-impersonation',
  'political-propaganda',
  'other',
] as const;

const reportReasonLabels: Record<AppLocale, Record<(typeof reportReasons)[number], string>> = {
  es: {
    'illegal-content': 'Contenido ilegal',
    'hate-harassment': 'Odio o acoso',
    threat: 'Amenaza',
    'personal-information': 'Información personal',
    'fraud-impersonation': 'Fraude o suplantación',
    'political-propaganda': 'Propaganda política',
    other: 'Otro',
  },
  en: {
    'illegal-content': 'Illegal content',
    'hate-harassment': 'Hate or harassment',
    threat: 'Threat',
    'personal-information': 'Personal information',
    'fraud-impersonation': 'Fraud or impersonation',
    'political-propaganda': 'Political propaganda',
    other: 'Other',
  },
};

const notificationLabels: Record<AppLocale, Record<string, string>> = {
  es: {
    'council-announcement': 'Anuncio del consejo',
    'role-action': 'Acción de rol',
  },
  en: {
    'council-announcement': 'Council announcement',
    'role-action': 'Role action',
  },
};

function roleLabelsFor(locale: AppLocale, role: string): string {
  return role in roleLabels[locale] ? roleLabels[locale][role as PlayerRole] : role;
}

export function CommunityHub({
  community,
  communityError,
  locale,
  onCommunity,
  onLocale,
  onWorld,
  world,
}: {
  community: CommunitySnapshot | null;
  communityError: boolean;
  locale: AppLocale;
  onCommunity: (snapshot: CommunitySnapshot) => void;
  onLocale: (locale: AppLocale) => void;
  onWorld?: (snapshot: WorldSnapshot) => void;
  world: WorldSnapshot | null;
}) {
  const copy = uiCopy[locale];
  const [activeTab, setActiveTab] = useState<CommunityTab>('leaderboard');
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{ locale: AppLocale; text: string }>({ locale, text: '' });
  const message = feedback.locale === locale ? feedback.text : '';
  const setMessage = (text: string) => setFeedback({ locale, text });
  const [candidate, setCandidate] = useState('');
  const [target, setTarget] = useState('');
  const [announcementKey, setAnnouncementKey] = useState<AnnouncementKey>('DEFEND_HERE');
  const [reportReason, setReportReason] = useState<(typeof reportReasons)[number]>('other');
  const [openModerationAnnouncementId, setOpenModerationAnnouncementId] = useState<string | null>(null);
  const preferences = world?.viewer?.preferences;
  const [quietStartOverride, setQuietStart] = useState<number | null>(null);
  const [quietEndOverride, setQuietEnd] = useState<number | null>(null);
  const [dailyAlertsOverride, setDailyAlerts] = useState<number | null>(null);
  const [councilAlertsOverride, setCouncilAlerts] = useState<boolean | null>(null);
  const selectedCandidate = candidate || community?.council.candidates[0]?.candidateRef || '';
  const selectedTarget = target || community?.council.validTargets[0]?.code || '';
  const quietStart = quietStartOverride ?? preferences?.quietHoursStart ?? 22;
  const quietEnd = quietEndOverride ?? preferences?.quietHoursEnd ?? 8;
  const dailyAlerts = dailyAlertsOverride ?? preferences?.maxWarAlertsPerDay ?? 1;
  const councilAlerts = councilAlertsOverride ?? preferences?.councilAlerts ?? true;

  useEffect(() => {
    const openTab = (event: Event) => {
      const requested = (event as CustomEvent<string>).detail;
      if (requested === 'leaderboard' || requested === 'council' || requested === 'activity' || requested === 'store' || requested === 'settings') {
        setActiveTab(requested);
        document.getElementById('community-hub')?.scrollIntoView({ behavior: 'smooth' });
      }
    };
    window.addEventListener('territorios:tab', openTab);
    return () => window.removeEventListener('territorios:tab', openTab);
  }, []);

  const targetName = useMemo(
    () => community?.council.campaign?.targetTerritoryName ?? community?.council.validTargets.find(
      (entry) => entry.code === community.council.targetResult.winner,
    )?.name,
    [community],
  );

  const runCommand = async (
    path: string,
    body: unknown,
    successMessage: string,
    expectSnapshot = true,
    refreshWorld = false,
  ) => {
    setPending(true);
    setMessage('');
    try {
      const response = await fetch(path, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': `community-${crypto.randomUUID()}`,
        },
        body: JSON.stringify(body),
      });
      const result = await response.json() as CommunitySnapshot | { error?: string };
      if (!response.ok || 'error' in result) {
        throw new Error('error' in result && result.error && locale === 'es' ? result.error : copy.commandFailed);
      }
      if (expectSnapshot && 'mode' in result && result.mode === 'live-community') onCommunity(result);
      if (refreshWorld && onWorld) {
        const worldResponse = await fetch('/api/game');
        if (worldResponse.ok) onWorld(await worldResponse.json() as WorldSnapshot);
      }
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.commandFailed);
    } finally {
      setPending(false);
    }
  };

  const voteRepresentative = () => community?.territory && selectedCandidate && runCommand(
    '/api/community/ballot',
    {
      territoryCode: community.territory.code,
      electionKind: 'representative',
      rankedChoices: [selectedCandidate],
    },
    copy.voteRecorded,
  );
  const voteTarget = () => community?.territory && selectedTarget && runCommand(
    '/api/community/ballot',
    {
      territoryCode: community.territory.code,
      electionKind: 'target',
      rankedChoices: [selectedTarget],
    },
    copy.voteRecorded,
  );
  const publish = () => community?.territory && runCommand(
    '/api/community/announcement',
    { territoryCode: community.territory.code, messageKey: announcementKey },
    copy.announcementPublishedSuccess,
  );

  const tabs: Array<{ id: CommunityTab; label: string }> = [
    { id: 'leaderboard', label: copy.leaderboard },
    { id: 'council', label: copy.council },
    { id: 'activity', label: copy.activity },
    { id: 'store', label: copy.store },
    { id: 'settings', label: copy.settings },
  ];
  const moveTabFocus = (current: CommunityTab, key: string) => {
    const index = tabs.findIndex((tab) => tab.id === current);
    let nextIndex = index;
    if (key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    if (key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    if (key === 'Home') nextIndex = 0;
    if (key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === index && !['Home', 'End'].includes(key)) return;
    const next = tabs[nextIndex].id;
    setActiveTab(next);
    document.getElementById(`tab-${next}`)?.focus();
  };

  return (
    <section className="community-hub" id="community-hub" aria-labelledby="community-heading">
      <div className="community-heading">
        <div>
          <span className="eyebrow">{copy.communitySubtitle}</span>
          <h2 id="community-heading">{copy.communityTitle}</h2>
        </div>
        <span className="community-live"><i />D1 · {copy.live}</span>
      </div>
      {communityError ? <p className="command-alert" role="alert">{copy.communityUnavailable}</p> : null}
      <div className="community-tabs" role="tablist" aria-label={copy.communityTitle}>
        {tabs.map((tab) => (
          <button
            type="button"
            key={tab.id}
            id={`tab-${tab.id}`}
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            tabIndex={activeTab === tab.id ? 0 : -1}
            onClick={() => setActiveTab(tab.id)}
            onKeyDown={(event) => {
              if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                moveTabFocus(tab.id, event.key);
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        className="community-panel"
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
      >
        {activeTab === 'leaderboard' ? (
          <div className="ranking-grid">
            <section>
              <h3>{copy.factionRanking}</h3>
              {world?.factionLeaderboard.length ? (
                <ol className="ranking-list">
                  {world.factionLeaderboard.slice(0, 8).map((faction) => (
                    <li key={faction.factionId}>
                      <i style={{ background: faction.color }} />
                      <span><strong>{faction.name}</strong><small>{faction.territories} {copy.territories}</small></span>
                      <b>{faction.score}</b>
                    </li>
                  ))}
                </ol>
              ) : <p className="empty-state">{copy.noRanking}</p>}
            </section>
            <section>
              <h3>{copy.playerRanking}</h3>
              {world?.playerLeaderboard.length ? (
                <ol className="ranking-list player-ranking">
                  {world.playerLeaderboard.slice(0, 8).map((player, index) => (
                    <li key={`${player.player}-${index}`}>
                      <span><strong>{player.player}</strong><small>{roleLabelsFor(locale, player.role)} · {player.factionName}</small></span>
                      <b>{player.contributionScore}</b>
                    </li>
                  ))}
                </ol>
              ) : <p className="empty-state">{copy.noRanking}</p>}
            </section>
          </div>
        ) : null}

        {activeTab === 'council' ? (
          <div className="council-layout">
            <section>
              <h3>{copy.mixedCouncil}</h3>
              {community?.council.term ? (
                <div className="governance-clock">
                  <strong>{interpolate(copy.councilTerm, { number: community.council.term.number })}</strong>
                  <span>{interpolate(copy.councilTermEnds, { time: new Date(community.council.term.endsAt).toLocaleString(locale) })}</span>
                </div>
              ) : null}
              {community?.council.campaign ? (
                <div className="governance-clock">
                  <strong>{interpolate(copy.campaignCycle, { number: community.council.campaign.cycleNumber })}</strong>
                  <span>{copy[{
                    planning: 'campaignPlanning',
                    mobilizing: 'campaignMobilizing',
                    active: 'campaignActive',
                    cooldown: 'campaignCooldown',
                    resolved: 'campaignResolved',
                  }[community.council.campaign.phase] as keyof typeof copy]}</span>
                </div>
              ) : null}
              <ul className="seat-grid">
                {(community?.council.seats ?? []).map((seat) => (
                  <li key={seat.seatKind}>
                    <span>{copy[seatCopy[seat.seatKind]]}</span>
                    <strong>{seat.label ?? copy.vacant}</strong>
                    <small>{seat.role ? roleLabelsFor(locale, seat.role) : '—'}</small>
                  </li>
                ))}
              </ul>
              {community?.viewer?.role && community.territory ? (
                <div className="role-action-card">
                  <span>{copy.roleAction}</span>
                  <strong>{roleLabelsFor(locale, community.viewer.role)}</strong>
                  <small>
                    {roleActionDescriptions[locale][community.viewer.role as PlayerRole] ?? ''}{' '}
                    {community.viewer.roleActionAvailable
                      ? copy.roleActionReady
                      : interpolate(copy.roleActionUsed, {
                          time: community.viewer.nextRoleActionAt
                            ? new Date(community.viewer.nextRoleActionAt).toLocaleString(locale)
                            : '—',
                        })}
                  </small>
                  <button
                    type="button"
                    disabled={!community.viewer.roleActionAvailable || pending}
                    onClick={() => runCommand(
                      '/api/community/role-action',
                      { territoryCode: community.territory!.code },
                      copy.roleActionSuccess,
                      true,
                      true,
                    )}
                  >{copy.useRoleAction}</button>
                </div>
              ) : null}
              {!community?.viewer || !community.territory ? (
                <p className="empty-state">{copy.signInForCommunity}</p>
              ) : (
                <div className="governance-actions">
                  <div className="field-group">
                    <label htmlFor="candidate-choice">{copy.chooseCandidate}</label>
                    <select
                      id="candidate-choice"
                      value={selectedCandidate}
                      onChange={(event) => setCandidate(event.target.value)}
                      disabled={community.council.representativeBallotCast || pending}
                    >
                      {community.council.candidates.map((entry) => (
                        <option key={entry.candidateRef} value={entry.candidateRef}>
                          {entry.label} · {roleLabelsFor(locale, entry.role)} · {entry.contributionScore}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={voteRepresentative}
                      disabled={!selectedCandidate || community.council.representativeBallotCast || pending}
                    >
                      {community.council.representativeBallotCast ? copy.voteRecorded : copy.castVote}
                    </button>
                  </div>
                  {community.council.canVoteTarget ? (
                    <div className="field-group">
                      <label htmlFor="target-choice">{copy.chooseTarget}</label>
                      <select
                        id="target-choice"
                        value={selectedTarget}
                        onChange={(event) => setTarget(event.target.value)}
                        disabled={community.council.targetBallotCast || pending}
                      >
                        {community.council.validTargets.map((entry) => (
                          <option key={entry.code} value={entry.code}>{entry.name} · {entry.routeKind === 'sea' ? copy.seaRoute : copy.landRoute}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={voteTarget}
                        disabled={!selectedTarget || community.council.targetBallotCast || pending}
                      >{copy.voteTarget}</button>
                    </div>
                  ) : null}
                </div>
              )}
              <p className="target-result">
                {targetName
                  ? interpolate(copy.targetLocked, { target: targetName })
                  : copy.targetPending}
              </p>
              {community?.viewer?.canPublish ? (
                <div className="announcement-publisher">
                  <label htmlFor="announcement-choice">{copy.announcementMessage}</label>
                  <select
                    id="announcement-choice"
                    value={announcementKey}
                    onChange={(event) => setAnnouncementKey(event.target.value as AnnouncementKey)}
                    disabled={pending}
                  >
                    {(Object.keys(ANNOUNCEMENT_MESSAGES) as AnnouncementKey[]).map((key) => (
                      <option key={key} value={key}>{translateAnnouncement(key, locale)}</option>
                    ))}
                  </select>
                  <button type="button" onClick={publish} disabled={pending}>{copy.publishAnnouncement}</button>
                </div>
              ) : null}
            </section>

            <section>
              <h3>{copy.communityFeed}</h3>
              {community?.announcements.length ? (
                <ol className="announcement-list">
                  {community.announcements.map((announcement) => {
                    const isKnown = announcement.messageKey in ANNOUNCEMENT_MESSAGES;
                    const isOwnAnnouncement = community.viewer?.userRef === announcement.authorRef;
                    return (
                      <li key={announcement.id}>
                        <div><strong>{announcement.territoryName}</strong><small>{announcement.authorLabel}</small></div>
                        <p>{isKnown ? translateAnnouncement(announcement.messageKey as AnnouncementKey, locale) : announcement.messageKey}</p>
                        <div className="announcement-actions">
                          <button
                            type="button"
                            disabled={Boolean(announcement.viewerVote) || pending || !community.viewer || isOwnAnnouncement}
                            onClick={() => runCommand('/api/community/announcement/vote', {
                              announcementId: announcement.id,
                              direction: 'up',
                            }, copy.announcementVoteSuccess)}
                          >↑ {copy.helpful} {announcement.upvotes}</button>
                          <button
                            type="button"
                            disabled={Boolean(announcement.viewerVote) || pending || !community.viewer || isOwnAnnouncement}
                            onClick={() => runCommand('/api/community/announcement/vote', {
                              announcementId: announcement.id,
                              direction: 'down',
                            }, copy.announcementVoteSuccess)}
                          >↓ {copy.unhelpful} {announcement.downvotes}</button>
                          {community.viewer && !isOwnAnnouncement ? (
                            <details
                              open={openModerationAnnouncementId === announcement.id}
                              onToggle={(event) => {
                                const isOpen = event.currentTarget.open;
                                setOpenModerationAnnouncementId((current) => {
                                  if (isOpen) return announcement.id;
                                  return current === announcement.id ? null : current;
                                });
                              }}
                            >
                              <summary>{copy.report}</summary>
                              <label htmlFor={`reason-${announcement.id}`}>{copy.reportReason}</label>
                              <select
                                id={`reason-${announcement.id}`}
                                value={reportReason}
                                onChange={(event) => setReportReason(event.target.value as typeof reportReason)}
                              >
                                {reportReasons.map((reason) => <option key={reason} value={reason}>{reportReasonLabels[locale][reason]}</option>)}
                              </select>
                              <button type="button" onClick={() => runCommand('/api/community/report', {
                                targetType: 'announcement',
                                targetId: announcement.id,
                                reason: reportReason,
                              }, copy.reportSuccess, false)}>{copy.sendReport}</button>
                              <button type="button" onClick={() => runCommand('/api/community/safety', {
                                targetRef: announcement.authorRef,
                                action: 'mute',
                              }, copy.muteSuccess)}>{copy.mute}</button>
                              <button type="button" onClick={() => runCommand('/api/community/safety', {
                                targetRef: announcement.authorRef,
                                action: 'block',
                              }, copy.blockSuccess)}>{copy.block}</button>
                            </details>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : <p className="empty-state">{copy.noAnnouncements}</p>}
            </section>
          </div>
        ) : null}

        {activeTab === 'activity' ? (
          <section>
            <h3>{copy.replayTitle}</h3>
            <p className="replay-intro">{copy.replayIntro}</p>
            {world?.recentEvents.length ? (
              <ol className="replay-list">
                {world.recentEvents.map((event) => (
                  <li key={event.sequence}>
                    <span><strong>{eventSummary(locale, event.summaryKey, event.summaryArgs)}</strong><small>#{event.sequence} · {new Date(event.createdAt).toLocaleString(locale)}</small></span>
                    <details className="replay-integrity">
                      <summary>{copy.verifyIntegrity}</summary>
                      <code>{copy.eventHash}: {event.payloadHash}</code>
                    </details>
                  </li>
                ))}
              </ol>
            ) : <p className="empty-state">{copy.noEvents}</p>}
          </section>
        ) : null}

        {activeTab === 'store' ? (
          <PaymentPanel
            catalog={world?.catalog ?? []}
            hasMembership={Boolean(world?.viewer?.membership)}
            locale={locale}
          />
        ) : null}

        {activeTab === 'settings' ? (
          <div className="settings-grid">
            <section>
              <h3>{copy.settings}</h3>
              <div className="field-group">
                <label htmlFor="locale-setting">{copy.language}</label>
                <select id="locale-setting" value={locale} onChange={(event) => {
                  setMessage('');
                  onLocale(event.target.value as AppLocale);
                }}>
                  <option value="es">Español</option>
                  <option value="en">English</option>
                </select>
                <label htmlFor="quiet-start">{copy.quietStart}</label>
                <input id="quiet-start" type="number" min="0" max="23" value={quietStart} onChange={(event) => setQuietStart(Number(event.target.value))} />
                <label htmlFor="quiet-end">{copy.quietEnd}</label>
                <input id="quiet-end" type="number" min="0" max="23" value={quietEnd} onChange={(event) => setQuietEnd(Number(event.target.value))} />
                <label htmlFor="daily-alerts">{copy.dailyAlerts}</label>
                <input id="daily-alerts" type="number" min="0" max="4" value={dailyAlerts} onChange={(event) => setDailyAlerts(Number(event.target.value))} />
                <label className="check-field"><input type="checkbox" checked={councilAlerts} onChange={(event) => setCouncilAlerts(event.target.checked)} />{copy.councilAlerts}</label>
                <button type="button" disabled={pending || !community?.viewer} onClick={() => runCommand('/api/community/preferences', {
                  locale,
                  quietHoursStart: quietStart,
                  quietHoursEnd: quietEnd,
                  maxWarAlertsPerDay: dailyAlerts,
                  councilAlerts,
                }, copy.saved)}>{copy.savePreferences}</button>
              </div>
              <p className="privacy-note">{copy.inboxOnly}</p>
            </section>
            <section>
              <h3>{copy.notifications}</h3>
              {community?.notifications.length ? (
                <ol className="notification-list">
                  {community.notifications.map((notification) => (
                    <li key={notification.id}><strong>{notificationLabels[locale][notification.kind] ?? notification.kind}</strong><time>{new Date(notification.createdAt).toLocaleString(locale)}</time></li>
                  ))}
                </ol>
              ) : <p className="empty-state">{copy.noNotifications}</p>}
            </section>
          </div>
        ) : null}
      </div>
      {pending || message ? <p className="hub-status" role="status" aria-live="polite">{pending ? copy.actionPending : message}</p> : null}
    </section>
  );
}
