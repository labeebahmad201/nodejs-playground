# Review: Big-Picture Event Storming — Upwork-like Marketplace

_Draft / temporary notes._

## Short verdict

What you have is a **state machine for one happy path**, not a big-picture Event Storming map. It's a good skeleton of the core value stream, but it's missing the three things that make big picture useful: **people, contexts, and everything that can go wrong with money.**

---

## 1. Method-level issues

**Arrows are doing too much work.** In big picture you lay events on a timeline left→right and *don't* draw causal arrows everywhere. Arrows turn it into process/design level. Here `UserLoggedIn → ProfessionalSaved` reads as "saving a professional only happens because you logged in" — that's not a business causality, that's a technical precondition. Same for `JobPosted → DisputeRaised`, which is almost certainly wrong (see §3).

**Only one sticky color.** Big picture needs at minimum:
- 🟧 events (you have these)
- 🟨 actors/personas — **buyer/client**, **freelancer/seller**, **platform admin/arbitrator**, **payment provider**
- 🟪 policies ("when X happens, then Y")
- 🟥 hotspots — the arguments and unknowns
- **Pivotal events** — the 3–5 events where the business changes state. Yours are `BidAccepted`, `PaymentCaptured/EscrowFunded`, `JobCompleted`, `DisputeRaised`. Mark them with a bar.

**No bounded contexts.** The map should cluster visibly into Identity, Job Posting, Discovery, Bidding, Contracting, Escrow & Payments, Messaging, Reputation, Disputes/Trust & Safety. Right now the cross-links (login→messaging, job→dispute) are symptoms of missing intermediate events, not real edges.

**Login is not a business event.** `UserSignedUp → UserLoggedIn` puts session lifecycle at the head of your value stream. Keep signup/verification; move login to a supporting context or drop it.

**Personas are inconsistent.** You use "seller" in one box and "buyer" in another without ever naming the roles. Lock the ubiquitous language now: Client/Buyer vs Freelancer/Seller, and who the *platform* acts as.

---

## 2. Missing events (the big holes)

| Context | Missing |
|---|---|
| Identity | EmailVerified, IdentityVerified/KYC, RoleSelected, ProfileCreated, BankAccountAdded, PaymentMethodVerified, AccountSuspended |
| Job | JobDraftCreated, JobPublished, JobEdited, JobClosed, JobExpired |
| Bidding | **BidWithdrawn**, BidDeclined, BidShortlisted, **other bids closed when one is accepted**, interview scheduled |
| Contract | **ContractCreated / OfferAccepted**, TermsAgreed, MilestoneAdded, WorkSubmitted, RevisionRequested, **WorkApproved** |
| Money | **FundsReleasedFromEscrow**, PayoutInitiated, PaymentFailed, RefundIssued, PlatformFeeCharged, ChargebackReceived |
| Reputation | **ReviewSubmitted** (double-blind), ReviewWindowExpired — this loop is what makes a marketplace a marketplace, and it's absent |
| Time-based | AutoReleaseTriggered, DisputeWindowExpired, JobAutoClosed |
| Contract type | Nothing about **hourly vs fixed-price**. Hourly needs TimesheetSubmitted, WorkDiaryApproved, WeeklyBilling — it changes the whole event set |

The money path is the riskiest part of an Upwork clone and you currently have **one** payment event. You need the full chain: authorize → capture/hold → release → payout → fee → refund/chargeback.

---

## 3. Specific boxes that are wrong

- **`PaymentCaptured (in escrow)`** — contradictory. Capture means money moved to you. If it's escrow, it's `EscrowFunded` / `FundsHeld`. Then `PaymentCaptured` belongs later, at `FundsReleasedFromEscrow`.
- **`BidCancelled (by the seller)`** hanging off `BidAccepted` — once accepted, the bid is dead; you're cancelling a *contract*. Rename to `ContractCancelled` and move it. A pre-acceptance seller action is `BidWithdrawn`.
- **`BidRejected (by buyer after initially accepting it)`** — same problem, plus the parenthetical is hiding a missing event. That's `ContractCancelled` / `EngagementTerminated`, probably with an escrow refund branch.
- **`JobPosted → DisputeRaised`** — a dispute needs money at risk. It should hang off the contract/escrow lifecycle (`WorkRejected`, `MilestoneDisputed`, `ContractCancelled` with funds held).
- **`JobCompleted → (nothing)`** — no payout, no fee, no review, no rating. The value stream just stops.
- **`JobAbandoned`** — no recovery: refund? repost? penalty?
- **`MessageSent` off `UserLoggedIn`** — needs `ConversationStarted` and a context (job/contract), or it's just noise.
- **`PaymentMethodAdded` on the main line** — freelancers don't need one to bid. It's a buyer-only branch; keep supporting capabilities off the spine.
- **`ProfessionalSaved` / `ProfessionalUnsaved`** — pick one term for the persona ("Freelancer"/"Talent"), and note that un-saving is usually analytics, not a domain event.
- Typos to fix before this goes in front of anyone: `DosputeResolved`, `DisputeUnderRev iew`, `PaymentCapture d`.

Also missing: `JobPosted → BidPosted` implies exactly one bid. It's a loop, and acceptance must close out all competing bids.

---

## 4. Hotspots you should be arguing about (red stickies)

1. When exactly is escrow funded — offer acceptance or contract start?
2. Auto-release after N days of client silence: yes/no, how long?
3. Dispute window length and who arbitrates (platform? external?)
4. Platform fee: charged on release, on payout, per milestone?
5. Off-platform communication/payment — the classic marketplace leak.
6. Chargebacks and negative balance handling.
7. Hourly vs fixed-price divergence — arguably two value streams, not one.
8. Who can cancel at which point, and with what penalty/refund?

---

## 5. What I'd do next

1. **Drop the arrows**, keep the timeline. Re-lay the events as a spine and let clusters form contexts.
2. **Add persona swimlanes** (Client / Freelancer / Platform / Payment provider) — half your missing events will surface immediately because a lane looks empty.
3. **Run the "what could go wrong with money" pass** on the happy path — that's where 80% of your missing events live.
4. **Run a "day 30" pass**: contract open for a month. Auto-release, revisions, timeouts, silence.
5. **Run the reverse story**: refund, dispute, chargeback, ban. You have the dispute branch, but it's disconnected from the financial events that trigger it.
6. Only then move to process-level modeling for the 3–4 pivotal events.

The good news: the core spine (`post → bid → accept → fund → work → complete`) is right. Everything above is the surrounding 70% that big picture is *for*.

---

## Next

Turn this into a revised Mermaid event map (contexts, swimlanes, the missing events, hotspots marked) so you have a v2 to react to.
