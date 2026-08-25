export type RankedBallot = {
  voterId: string;
  choices: string[];
};

export type RankedChoiceRound = {
  counts: Record<string, number>;
  eliminated: string | null;
};

export type RankedChoiceResult = {
  status: 'winner' | 'tie' | 'no-quorum';
  winner: string | null;
  finalists: string[];
  rounds: RankedChoiceRound[];
};

export type CouncilCandidate = {
  id: string;
  role: string;
  contributionScore: number;
  supporterPoints: number;
};

export type CouncilSeatKind =
  | 'public-1'
  | 'public-2'
  | 'defense'
  | 'strategy'
  | 'supporter';

export type ResolvedCouncilSeat = {
  seatKind: CouncilSeatKind;
  userId: string | null;
  supporterScore: number;
};

export type SupplyEdge = {
  from: string;
  to: string;
  enabled: boolean;
};

export function resolveRankedChoice(
  candidateIds: string[],
  ballots: RankedBallot[],
  quorum: number,
): RankedChoiceResult {
  const candidates = [...new Set(candidateIds)];
  const candidateSet = new Set(candidates);
  const voters = new Set<string>();
  const validBallots = ballots.flatMap((ballot) => {
    if (voters.has(ballot.voterId)) return [];
    voters.add(ballot.voterId);
    const choices = [...new Set(ballot.choices)].filter((choice) => candidateSet.has(choice));
    return choices.length > 0 ? [{ ...ballot, choices }] : [];
  });

  if (validBallots.length < quorum || candidates.length === 0) {
    return { status: 'no-quorum', winner: null, finalists: [], rounds: [] };
  }

  const active = new Set(candidates);
  const rounds: RankedChoiceRound[] = [];
  while (active.size > 0) {
    const counts = Object.fromEntries(
      candidates.filter((candidate) => active.has(candidate)).map((candidate) => [candidate, 0]),
    );
    let allocated = 0;
    for (const ballot of validBallots) {
      const choice = ballot.choices.find((candidate) => active.has(candidate));
      if (!choice) continue;
      counts[choice] += 1;
      allocated += 1;
    }

    const scores = Object.values(counts);
    const topScore = Math.max(...scores);
    const leaders = Object.keys(counts).filter((candidate) => counts[candidate] === topScore);
    if (topScore * 2 > allocated) {
      rounds.push({ counts, eliminated: null });
      return { status: 'winner', winner: leaders[0], finalists: leaders, rounds };
    }
    if (active.size <= 2) {
      rounds.push({ counts, eliminated: null });
      return leaders.length === 1
        ? { status: 'winner', winner: leaders[0], finalists: leaders, rounds }
        : { status: 'tie', winner: null, finalists: leaders.sort(), rounds };
    }

    const lowestScore = Math.min(...scores);
    const eliminated = Object.keys(counts)
      .filter((candidate) => counts[candidate] === lowestScore)
      .sort()
      .at(-1)!;
    rounds.push({ counts, eliminated });
    active.delete(eliminated);
  }

  return { status: 'no-quorum', winner: null, finalists: [], rounds };
}

export function buildCouncilRoster(
  candidates: CouncilCandidate[],
  ballots: RankedBallot[],
): ResolvedCouncilSeat[] {
  const used = new Set<string>();
  const publicWinners: Array<string | null> = [];
  for (let seat = 0; seat < 2; seat += 1) {
    const eligible = candidates.map((candidate) => candidate.id).filter((id) => !used.has(id));
    const result = resolveRankedChoice(eligible, ballots, 1);
    const winner = result.status === 'winner' ? result.winner : null;
    publicWinners.push(winner);
    if (winner) used.add(winner);
  }

  const takeBest = (
    predicate: (candidate: CouncilCandidate) => boolean,
    score: (candidate: CouncilCandidate) => number,
  ) => {
    const candidate = candidates
      .filter((entry) => !used.has(entry.id) && predicate(entry))
      .sort((left, right) => score(right) - score(left) || left.id.localeCompare(right.id))[0];
    if (candidate) used.add(candidate.id);
    return candidate ?? null;
  };

  const defender = takeBest((candidate) => candidate.role === 'defender', (candidate) => candidate.contributionScore);
  const strategist = takeBest(
    (candidate) => ['strategist', 'scout'].includes(candidate.role),
    (candidate) => candidate.contributionScore,
  );
  const supporter = takeBest(
    (candidate) => candidate.supporterPoints > 0,
    (candidate) => Math.min(1_000, candidate.supporterPoints),
  );

  return [
    { seatKind: 'public-1', userId: publicWinners[0], supporterScore: 0 },
    { seatKind: 'public-2', userId: publicWinners[1], supporterScore: 0 },
    { seatKind: 'defense', userId: defender?.id ?? null, supporterScore: 0 },
    { seatKind: 'strategy', userId: strategist?.id ?? null, supporterScore: 0 },
    {
      seatKind: 'supporter',
      userId: supporter?.id ?? null,
      supporterScore: supporter ? Math.min(1_000, supporter.supporterPoints) : 0,
    },
  ];
}

export function validSupplyTargets(
  origin: string,
  edges: SupplyEdge[],
  suppliedTerritories: Set<string>,
): string[] {
  const targets = edges.flatMap((edge) => {
    if (!edge.enabled) return [];
    if (edge.from === origin && suppliedTerritories.has(edge.to)) return [edge.to];
    if (edge.to === origin && suppliedTerritories.has(edge.from)) return [edge.from];
    return [];
  });
  return [...new Set(targets)].sort();
}
