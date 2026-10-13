# AWS Accounts vs AWS Users

Source: [learn.cantrill.io](https://learn.cantrill.io) — Adrian Cantrill's AWS architecture
course, which uses the fictional **Animals4Life** rescue organisation as its running example.

## The scenario: Animals4Life

Everything in this folder is framed against a real-shaped problem, so the scenario comes
first.

### Who they are

- Animal Rescue and Awareness Organisation
- Global, HQ in Brisbane, Australia — ~100 staff
- Departments: call centre, admin, IT, marketing, legal, accounts
- ~100 remote workers across Australia and globally
- Animal care staff, activists, and lobbyists
- Major offices in London, New York, and Seattle

### Current infrastructure (the starting point)

- Small on-premises datacentre in Brisbane
- A badly implemented AWS trial in the Sydney region
- A few isolated Azure and GCP pilots
- Global offices and mobile staff consume everything through Brisbane

### Field workers

Field workers carry a laptop and connect over 3G, 4G, or satellite. Their usage is:

- data upload **and** download
- email and file access
- chat and planning
- research datasets

Every one of those operations traverses a constrained backhaul to Brisbane.

### Current problems

| Problem | Detail |
|---|---|
| Legacy on-premises hardware | failing |
| AWS and Azure pilots | messy, not best practice |
| Field worker performance | poor |
| HA and scalability | lacking, because hardware is expensive |
| Staff skills | struggling, little automation |
| Global expansion | cost of new infrastructure is the blocker |

### Ideal outcomes

- Fast performance for all field workers
- Able to deploy into **new regions quickly** when required
- **Low cost and scalable** base infrastructure
- **Agility** — spin up new marketing campaigns, social, and progressive applications
  (IoT, big data, etc.)
- **Automation** — low base staffing costs

### Networks in the current state

Three disconnected CIDR ranges, one per estate:

| Estate | CIDR |
|---|---|
| On-premises | `192.168.10.0/24` |
| AWS pilot | `10.0.0.0/16` |
| Azure pilot | `172.31.0.0/16` |

---

## The lesson: accounts vs identities

An AWS **account** is a container. Inside it live the identities you log in with and the
resources you provision. An **IAM identity** is one of those logins.

The confusion between these two is the single most common source of "why can't I do that"
in AWS, so it is worth being precise about the boundary between them.

## Why the distinction matters

A simple system may run perfectly well inside a single AWS account. There is no rule that
says an account must be small.

Complex businesses move the other way. A large enterprise may run **10s or 100s of AWS
accounts**. The reason is blast radius: an AWS account contains the impact of a breach, an
admin error, or an exploit by a bad actor. The account is the unit of containment.

Common ways to split:

- by environment: DEV, TEST, PROD
- by team
- by product
- by client

## What an account contains

An account has three attributes you supply at creation:

1. **Account name** — e.g. `PROD`
2. **A unique email address**
3. **A credit card**

The credit card can be reused across multiple AWS accounts. The email address cannot — it
must be unique per account.

Everything provisioned inside the account bills to that account's payment method as it is
consumed. AWS is pay-as-you-go: you pay only for what you use.

## The account root user

The email address you provide while creating an account automatically creates a special
entity called the **account root user**.

Every account has its own root user:

- create an account with `admin@animals4life.org` → that is the root user of that account
- create a separate developer account with `dev@animals4life.org` → that account gets its
  **own, distinct** root user

Root user properties:

- full control over every resource in the account
- **cannot be restricted** — no IAM policy, permission boundary, or SCP can limit it
- initially it is the only identity in the account

Because it cannot be restricted, root user is the single most dangerous credential in the
account. In practice it is used for a handful of bootstrap actions (enabling MFA on itself,
paying invoices, a few account-level settings) and everything else is delegated to IAM
identities.

## IAM identities

You create additional identities inside an account using the **IAM** service. These *can* be
restricted.

- they start with **no access at all**
- access is granted explicitly, via policies attached to the identity, a group, or a role
- users, groups, and roles can be given full **or** limited permissions

Isolation between accounts:

> Any IAM identity created within one account **cannot** access resources in another
> account.

This is the default. Cross-account access **is** possible, but you must explicitly configure
it — you never get it for free.

## The account boundary

The account boundary is what keeps outside things from getting in, and inside things from
getting out. By default **all** access is denied except for the root user.

The full treatment — including blast radius, external identities, multi-account structure, and
the egress caveat — is in
[`../02-boundary-and-blast-radius`](../02-boundary-and-blast-radius/README.md).

## Summary table

| | AWS Account | IAM Identity (User) |
|---|---|---|
| What it is | A container | A login inside a container |
| Created with | Name, unique email, credit card | IAM, via policy assignment |
| Access by default | Full control (root) | None, until granted |
| Has resources? | Yes, hosts them | No |
| Can be restricted? | The boundary itself | Yes |
| Cross-account access | Isolated by default | Cannot reach other accounts unless explicitly granted |
| Billing | Bills to the account's payment method | Consumes, does not bill directly |

## In the Animals4Life context

The management team is cost-conscious but progressive. They are not asking to be handed a
maximum-complexity answer — they want the smallest structure that fixes the problems.

The ideal outcomes map onto account structure like this:

| Ideal outcome | What account structure contributes |
|---|---|
| Fast field worker performance | Not account structure — network and edge work |
| Deploy into new regions quickly | Repeatable, templated account creation |
| Low cost, scalable base infrastructure | Per-account cost visibility, and a place to apply budgets |
| Agility for campaigns / IoT / big data | Isolated scratch accounts per campaign, deleted afterwards |
| Automation, low staffing costs | Account creation as code, not click-ops |

The concrete question the current state raises: the AWS trial in Sydney is one messy account.
Replacing it is the first decision that constrains everything else:

- one shared "animals4life" account, or
- separate accounts per environment (DEV, TEST, PROD), or
- separate accounts per environment *and* per team/product

Each step up in structure buys a smaller blast radius and better cost attribution, at the cost
of more cross-account role assumption and more operational overhead.

A compromise that often fits the "cost-conscious but progressive" profile: production gets
its own hardened account, while DEV and TEST share a lower-privileged one. Blast radius for
the thing that actually matters, without paying the full tax of the enterprise layout on day
one.

## Related

- [`../02-boundary-and-blast-radius`](../02-boundary-and-blast-radius/README.md) — isolation,
  blast radius, and how to split accounts
- [`CLOUD.md`](../../../CLOUD.md) → Track 3 — the full AWS roadmap
- [learn.cantrill.io](https://learn.cantrill.io) — the source of the Animals4Life scenario
