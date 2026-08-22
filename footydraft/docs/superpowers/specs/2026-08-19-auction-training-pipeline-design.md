# Auction Bot — Training Pipeline Design

**Date:** 2026-08-19
**Branch:** `auction-training`
**Status:** design approved, implementation carried out (2026-08-20) — see PROJECT.md's
Project Handover section for the training run's actual results and what's still
unverified about it.

Auction is the one format of four with no trained model. Three prior days of attempts
produced a trainer that was both slow (4.4–7.0 drafts/sec) and flat. `HANDOVER.md`
carries the forensics; this document is the replacement design.

The goal is a single run that is both fast and reliably improving. Three independent
failures have to be fixed, and fixing one does not fix the others:

| Failure | Cause | Fix in this design |
|---|---|---|
| Throughput | one policy forward pass per seat per decision; 546-lot episodes | 15 × N lot cap; fully batched tensor env; one forward per bidding round for the whole batch |
| Learning signal | ~2,730 steps carrying one terminal scalar | potential-based shaping that telescopes to the identical terminal reward |
| *Measurement* (undiagnosed) | self-play margin is identically zero by construction | frozen scripted bidder as an absolute yardstick |

The third row is not in `HANDOVER.md` and may be the real reason the runs *looked*
flat. Reward is `own score − room average`. Under self-play with one shared policy,
`Σᵢ (Sᵢ − mean(S)) = 0` exactly, every episode, forever. Mean training reward is a
constant and cannot move regardless of how strong the bot becomes.

---

## 1. Settled decisions

| # | Decision | Choice |
|---|---|---|
| 1 | Bid loop model | **Simultaneous rounds** |
| 2 | Reward delivery | **Potential-based shaping**, γ=1, episode total unchanged |
| 3 | Improvement measurement | **Scripted bidder** as frozen benchmark *and* partial training opponent |
| 4 | Queue knowledge | **Past-facing counts** — human parity, no clairvoyance |
| 5 | Stopping criterion | **Train to convergence**, floor 500k drafts, wall-clock ceiling |
| 6 | Ability skew curve | **softmax T=10** on ability (Open Questions #3 / #16 / #29) |
| 7 | Budget multiplier | **×19** (amends R8-Q0's ×20) |

---

## 2. Rule amendments to PROJECT.md

Two settled rules change and one open question closes. All three must be written into
`PROJECT.md` as part of this work.

**Scope note:** amending `PROJECT.md` is in scope. Updating the *frontend* budget figure
to match §2.1 is **not** — it is a separate one-line change in the lobby code, tracked
as a follow-up so a training-pipeline plan does not quietly become a UI change.

**2.1 — Budget multiplier ×20 → ×19 (amends R8-Q0).**
`Budget = round_to_nearest_100M(mean(Derived Price over scoped pool) × 19)`.
Effect is confined to Top 5 Leagues (900M → 800M); every other scope sits mid-bucket
and is unchanged by the round-to-100M step. The frontend budget figure needs the same
change (follow-up, per the scope note above).

Rationale on record: at ×20, budget-over-best-available-XI is 0.97 at All Players and
Top 5 (binding — a drafter cannot buy the best XI on the block even unopposed at
opening prices) but 1.42 at Serie A and 1.57 at Bundesliga (not binding at all). ×19
tightens Top 5 to 0.86. It does **not** fix the thin-league slack, and nothing simple
does: that slack comes from top-end pool depth rather than average price, and the
ratio of "best XI on the block" to "total block value" is itself 1.04–1.45 across
configurations. A top-15N-by-ability budget basis was evaluated and rejected — it
fixes thin leagues (Serie A 1.42 → 0.71) but inflates All Players at N=2 to 1.42–1.55.
The variation is inherent to the pool, not the formula.

**2.2 — Ability skew curve fixed (closes Open Questions #3, #16, #29).**
Lot-list draws are weighted `p ∝ exp((ability − max_ability) / 10)`, sampled without
replacement. Measured over 400 sampled 75-lot blocks: mean lot ability 156.6 against a
pool mean of 150.6, with ~12 of the pool's top 20 reaching the block and *which* twelve
varying draft to draft. Rejected: uniform (2.6/20, violates R2-Q10), T=20 (6.6/20, many
drafts feature no household names), T=5 (18.9/20, near-identical elite every draft,
which also flattens the scarcity pricing the bot needs to learn).

Knock-on: R6-Q2 states Deal or No Deal's boxes follow this same pool-wide skew, and
that model is already trained and final. Its observations read actual abilities rather
than assuming a distribution, so this is a mild distribution shift, not a broken model.
Flagged, not blocking.

**2.3 — First bid is at the opening price (clarifies R8-Q4 against R9-Q3).**
R8-Q4 says a lot is discarded "if no one bids at opening bid", so the first bid is *at*
the opening price, not opening + increment. The three increment actions are therefore
redundant in the first bidding round of every lot and are masked down to `{Pass, Bid}`.
A real auction UI renders this as a single "Bid 25M" button before the first bid, with
the increment buttons appearing only from the second bid onward.

---

## 3. Environment

### 3.1 Batching

All state as `[B, …]` tensors, written device-agnostically so identical code runs on CPU
or CUDA behind one flag; both are benchmarked and the faster is used. `B = 4096` tables step
in lockstep (1024 / 4096 / 16384 benchmarked at startup; the fastest that fits is used). No Python loop over envs or over seats — ever. That single constraint
is the source of the projected 1,000× throughput gain.

Every env allocates **5 seat slots** and masks unused ones dead, so tables of 2 and 5
coexist in one rectangular array. Padding waste at an average table of 3.5 is ~30% of
seat slots, which is far cheaper than the bookkeeping cost of homogeneous sub-batches
and lets every env sample its own configuration independently — maximum distribution
diversity per gradient update.

Per-env autoreset: an env that finishes resamples immediately, so no table ever idles
waiting for a slower neighbour.

### 3.2 Reset

- `N ~ Uniform{2,3,4,5}`
- scope ~ `{all: 0.50, top5: 0.30, single_league: 0.20}` (R9-Q9)
- **Single-league draws are sampled jointly with N against the viability table.** Ligue 1
  never appears at any size; Bundesliga only at N=2; First Division at N≤3; Serie A and
  Premier Division at any size. This closes landmine 5 at the sampler rather than
  patching it downstream — `player_pool.get_scope_mask` is left alone.
- Budget per §2.1, computed from the scoped pool.

### 3.3 Lot list

`15 × N` lots total:
- `11N` position-guaranteed — one per single-occupancy slot, two for CB, per
  `AUCTION_LOTS_PER_POSITION_PER_DRAFTER`
- `4N` surplus drawn from the remainder of the scoped pool

Both draws use the §2.2 softmax weighting, without replacement. The combined list is
then shuffled, giving the fully random reveal order of R6-Q1. Squad Completion is
satisfied by construction.

### 3.4 Lot resolution — simultaneous rounds

```
price ← opening bid;  high_bidder ← none;  round ← 0

each round:
    actors = alive seats that are not the current high bidder
    legal  = {Pass} ∪ {raises r : price + r ≤ budget}
             (round 0: raises collapse to a single "bid at opening price")
    all actors decide simultaneously from one batched forward pass
    if any raise:  highest wins (uniform random tie-break)
                   → becomes high_bidder, price += that raise
    else:          lot ends
                   high_bidder exists → sold at price
                   otherwise          → discarded to the unsold pile (R8-Q4)
```

Passing is **not** exiting. A seat that passes this round may raise the next, exactly as
a timer that resets on every bid allows (R8-Q3). Illegal actions are masked with `−∞`
logits (R10-Q6); a seat may legitimately have only `Pass` available.

Bidding is never gated by slot status — a full XI may keep bidding to overflow or to
block (R5-Q6), with no cap or escalating cost (R6-Q7). No nominator, no turn order
(R2-Q5) — which is the main reason simultaneous rounds beat round-robin on fidelity as
well as on speed.

### 3.5 Roster state

The entire squad representation collapses to **`[B, 5, 10, 2]`** — the best two
abilities each seat holds per position.

That is everything optimal slotting can ever need: top-1 for the nine single-occupancy
slots, top-2 for CB. Graveyard contributes 0 to squad score (R9-Q4), so overflow beyond
the top two never has to be stored. Updates are O(1) with no sorting and no per-env
Python. Squad score is a fixed weighted sum over 11 values.

### 3.6 End conditions

The auction ends the moment either holds (R3-Q10, as amended by the lot cap):

1. the lot queue is exhausted, or
2. every seat still short of a full XI can no longer afford the cheapest unsold
   **eligible** footballer for any of its open slots

Condition 2 is the one the previous implementation got wrong — it checked only whether a
drafter had 5M to their name, which a 900M budget makes almost unreachable. It must
check affordability against an *eligible* player for an *open* slot.

Implementation: there are only six distinct scope variants, so each position's
ascending price ladder is precomputed once at startup. Each env carries a small bitmask
over each position's cheapest 32, marking sold. Cheapest-eligible lookups for the end
check, for backfill, and for the Φ recompute all read the same structure.

### 3.7 Backfill

Every empty slot is filled with the cheapest still-eligible unsold footballer for that
position, drawn first from the scoped pool minus sold and falling back to the unsold
pile only when nothing else eligible remains (R2-Q4, R8-Q4). Backfill always places
directly into the XI and can never overflow (R7.2-Q1).

**Assumption:** when two seats need the same cheapest player, seats resolve in *random*
order per env rather than seat order, so seat 0 gets no systematic advantage. The rules
do not specify a tiebreak.

---

## 4. Reward

Terminal reward is unchanged from spec: `R = S_me − mean(S_all)` over final squad
scores, position-weighted ability sum across the starting 11 (R8-Q8, R9-Q2).

Delivery is dense via potential-based shaping:

```
Φ(s) = my projected score − room's mean projected score

       projected score = current best-per-slot, with empty slots filled by
       cheapest-eligible backfill — i.e. the settled reward function evaluated
       on a partial state

r_t  = Φ(s_{t+1}) − Φ(s_t)          γ = 1

Σ r_t = Φ(s_final) − Φ(s_start) = R − 0
```

The episode's total reward is bit-for-bit the settled formula; only the *timing*
changes. This is Ng–Harada–Russell shaping, so the optimal policy is provably unchanged.
`Φ(s_start) = 0` by symmetry — every seat starts empty with identical backfill
projections.

Two consequences fall out without being hand-encoded:
- **Overpaying is punished immediately** — a purchase whose Φ gain is smaller than the
  price implied shows up on the step that caused it, not 60 lots later.
- **Blocking is correctly rewarded** — buying purely to deny a rival lowers their
  projected score, which raises the margin. R5-Q6's intended blocking strategy emerges
  from the reward rather than needing a bonus term.

Φ recomputes once per lot **resolution**, not per bidding round (~75/draft). Rounds
within an unresolved lot carry `r = 0`; γ=1 with GAE propagates the resolution reward
back across them trivially.

Returns are normalized by a running standard deviation. The wiped run's
`reward_scale: 0.01` is discarded — it was a symptom of fighting an unstable run, not a
tuning result.

---

## 5. Observation

**69 features, all normalized. This ordering is a hard contract** between the Python
trainer and the TypeScript inference path. A silent ordering mismatch between them is
the single most likely way this ships broken, so it is pinned here and asserted in tests
on both sides.

| Block | Features | Count |
|---|---|---|
| Lot | ability, position one-hot, derived price, opening bid, current price, price/opening ratio, rounds elapsed | 16 |
| Me | budget, budget ÷ current price, am-I-high-bidder, best ability per position (10), open slots per position (10) | 23 |
| Marginal value | squad-score gain from winning this lot — ability delta over the current holder of that slot × position multiplier | 1 |
| Opponents | live count, max budget, mean budget, how many still need this position, max budget among those who need it, mean squad-fill fraction | 6 |
| History | lots revealed per position (10), lots sold per position (10), lots remaining, fraction of auction elapsed | 22 |
| Context | scoped pool size | 1 |
| | **Total** | **69** |

**Opponents are encoded as aggregates, not four padded blocks.** Fixed width across
N=2–5, no permutation symmetry for the net to waste capacity rediscovering, and no dead
features at small tables. `max budget among opponents who need this position` is the
decision-relevant quantity that per-opponent detail would otherwise be needed for — it
answers "how high can this realistically go".

**Marginal value** is the highest-signal scalar in the set. It is what separates "this
striker is worth 120M to me" from "this striker is worth nothing to me because I already
have a better one".

**History is past-facing only.** Lots revealed and sold per position give the bot exactly
the memory an attentive human at the table has. It never sees the remaining queue's
composition (decision 4).

`AuctionPolicyNetwork`'s hardcoded `obs_dim=37` and the matching 37 in
`export_weights.py`'s format table are both corrected to 69 (landmine 4).

---

## 6. Network

Unchanged in shape from `models.py`: 2 × 128 hidden with LayerNorm and ReLU, separate
actor (4 logits) and critic (1) heads. It must run as hand-rolled matrix multiplies from
JSON weights in the browser, so the architecture stays deliberately plain. Only
`obs_dim` changes.

---

## 7. Training loop

Rebuilds the wiped generic infrastructure (`ppo.py`, `checkpoint_league.py`) rather than
writing Auction-specific versions, since the other three formats may later be re-run on
the same machinery.

- Fixed-length rollout segments of **T = 64 ticks** across all B envs, with autoreset and
  value bootstrapping at the segment boundary. ~260k transitions per update, against the
  wiped run's `batch_size: 256`. Minibatch 32,768, so 8 minibatches per epoch.
- γ = 1 (shaped rewards already telescope to the true return), GAE λ = 0.95
- clip ε = 0.2, 4 epochs per update, `c_value` 0.5, `c_entropy` 0.01
- lr **3e-4** — the standard the other three formats used. The wiped run's 3e-5 was
  10× lower than any other format and is discarded along with `c_entropy: 0.06`.
- All seats' transitions are training data where the seat is driven by the current
  policy; frozen-opponent seats generate environment dynamics only.

**Opponent mix per batch:**

| Slice | Opponents | Cost |
|---|---|---|
| 75% of envs | current policy (pure self-play) | 1 batched forward |
| 12.5% of envs | frozen champion | 1 batched forward over its slice |
| 12.5% of envs | scripted bidder | vectorized arithmetic, no forward |

Three forwards per tick rather than one, in exchange for a training distribution that
contains competent play from the first update instead of only the bot's own early
confusions.

**Scripted bidder** — bid while `current price < α × marginal value`, with budget pacing
against slots still to fill and lots remaining. Fully vectorized, roughly 60 lines. Does
triple duty: frozen benchmark, early-training opponent, and shipping fallback.

`α` is calibrated once, before training starts, by self-play among scripted bidders:
pick the value that beats a random-legal bidder by the widest margin, then confirm it
spends 80–90% of budget and backfills at most one slot. It is then **frozen for the
whole run** — a benchmark that moves is not a benchmark.

---

## 8. Evaluation

Run every 50 updates on frozen weights, 2,048 drafts per opponent set.

**Progress metrics:**
- **mean margin vs 4 scripted bidders** — the absolute yardstick. This is the curve that
  has to climb. Unlike self-play margin it is not pinned at zero by construction.
- **mean margin vs 4 random-legal bidders** — collapse alarm. Should pin high early and
  stay there; a fall means something broke.
- **challenger vs champion head-to-head** — the settled convergence criterion (R10-Q8).

**Diagnostics** — these are what tell us *why* a run is flat, and their absence is why
three days produced no diagnosis:
- mean clearing price ÷ opening bid (overpaying vs underbidding)
- budget unspent at auction end
- backfilled slots per squad
- action distribution across Pass / +5 / +10 / +25
- lots won per seat

A bot leaving 60% of budget unspent and backfilling four slots is a different failure
from one that overpays on lot three and backfills seven. The old metrics could not tell
them apart.

**Stopping:** benchmark margin flat within eval noise across 5 consecutive evals **and**
the challenger failing to take the champion's title across the same span, with a hard
floor at the spec'd 500k drafts (R10-Q7) and a 12-hour wall-clock ceiling. Ship the best checkpoint by benchmark margin.

At the projected throughput the 500k floor costs roughly 25–100 seconds, so it is not a
meaningful constraint — convergence is what decides the run length.

---

## 9. Export

Reuses `export_weights.py` with `obs_dim` corrected, writing the best-benchmark
checkpoint to `src/data/botModels/auction_policy.json`.

**Landmine 1 stands until this runs:** the file currently at that path is a randomly
initialized network, silently exported because no `checkpoints/auction/` existed. It
must be overwritten by a real checkpoint before anything ships.

The TypeScript inference path needs an observation builder that mirrors §5 exactly. Both
sides get a test asserting the feature ordering against a shared fixture.

---

## 10. Testing

Vectorized environments fail silently, so correctness is guarded by invariants rather
than by inspection.

**Reference parity (the key guard):** a plain, slow, obviously-correct single-env
implementation, checked against the batched env step-for-step on shared seeds. If they
diverge, the batched one is wrong.

**Invariants:**
- `Σ shaped rewards == terminal margin` to float tolerance — proves the telescoping and
  therefore that the objective is unmodified
- squad score margins across a room sum to 0
- no draft ever ends with an empty slot (Squad Completion)
- no seat's spend ever exceeds its budget
- lot list is exactly `15N` and meets every per-position quota
- no player appears on the block twice

**Unit tests:** budget formula per §2.1, skew weighting, bid resolution including
first-round `{Pass, Bid}` masking and tie-breaks, both end conditions, backfill fallback
to the unsold pile, viability-aware scope/N sampling never producing an unseatable
table.

---

## 11. File layout

```
scripts/training/
  env_auction.py          batched tensor env (§3)
  obs_auction.py          observation builder — the §5 contract
  scripted_auction.py     heuristic bidder (§7)
  ppo.py                  generic PPO (rebuilt, format-agnostic)
  checkpoint_league.py    league + evaluation (rebuilt, format-agnostic)
  train_auction.py        entry point
  reference_auction.py    slow single-env reference for parity tests
  tests/                  §10
```

Untouched: `config.py` (constants added), `player_pool.py`, `models.py` (obs_dim fixed),
`export_weights.py` (obs_dim fixed).

Also to clear: the untracked junk from the failed run — `debug.log`, `error.log`,
`training_log.txt`, `sim_output.txt`, `read_metrics.py` — plus the stale
`metrics/auction_metrics.json`, `metrics/auction_status.json`, and the auction overrides
in `live_config.json` (landmines 2 and 3).

---

## 12. Success criteria

1. **Throughput** — sustained ≥ 2,000 drafts/sec, against the previous 4.4–7.0. Target
   5,000–20,000.
2. **Correctness** — reference parity holds; every §10 invariant passes.
3. **Learning** — mean margin vs the frozen scripted bidder climbs monotonically in
   trend and then plateaus. A flat curve from the start means the design failed, and the
   diagnostics say which half.
4. **Convergence** — champion holds its title across a prolonged interval.
5. **Ship** — a real trained checkpoint replaces the randomly-initialized
   `auction_policy.json`, and the TS inference path reproduces Python's action
   distribution on a shared fixture.

---

## 13. Open assumptions

Recorded so they can be overturned cheaply:

1. **First bid at opening price** (§2.3) — a reading of R8-Q4, not an explicit rule.
2. **Backfill contention resolves in random seat order** (§3.7) — unspecified.
3. **Deal or No Deal's box skew** now inherits the T=10 curve (§2.2), and that bot is
   already final. Judged a mild distribution shift; not re-trained.
