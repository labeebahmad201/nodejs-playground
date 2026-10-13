# 02 — Account Boundary & Blast Radius

The account boundary is what keeps outside things from getting in, and inside things from
getting out. Everything about how you structure an AWS estate follows from it.

## The rule

By default, **all** access to an AWS account and its resources is **denied**, with exactly one
exception: the account root user.

Two consequences follow directly:

1. **Isolation in** — external actors cannot reach an account or its resources by default.
2. **Blast radius containment** — if something goes wrong inside the account, the damage stops
   at the account edge.

Point 2 is the entire argument for splitting into many accounts. If a compromised workload
lives in an account with nothing else in it, the incident is contained. If it shares an
account with production, it is not.

## The boundary in practice

| Direction | Default | To change it |
|---|---|---|
| Outside → account | Denied | Attach policies, or grant an external identity access explicitly |
| Account A → account B | Denied | Cross-account IAM role + trust policy in B |
| Inside → outside | Allowed | Egress is not governed by the account boundary; use NACLs, security groups, `NatGateway`/firewall for control |

The last row is the one people miss. The account boundary governs **identity-based access to
AWS resources**, not network egress. A process inside an account with an IAM policy can still
reach the internet unless you constrain it at the network layer (`04-aws-networking`).

## External identities

Identities do not have to live inside the account. An external identity — a staff member like
Julie, a third-party SaaS, a federated IdP — can be granted access.

The boundary is the default, not a prohibition. Granting access *in* is always a deliberate
act. Mechanisms, roughly by trust level:

| Mechanism | When you use it |
|---|---|
| IAM user + keys | Only for legacy; long-lived credentials, treat as a password |
| IAM role via OIDC | CI/CD — GitHub Actions, GitLab, etc. Short-lived, no stored keys |
| IAM role for EC2/ECS | Workloads — instance profile or task role |
| Cross-account role | Service → service, or org → account |
| AWS Organizations SCPs | Guardrails applied from the management account downward |

## Multi-account structure

The account is the unit of containment *and* the unit of cost attribution. Splitting on either
axis buys something; doing both costs more operational overhead.

| Strategy | Blast radius | Cost attribution | Overhead |
|---|---|---|---|
| One account | Whole estate | Blurry | None |
| Per environment (DEV/TEST/PROD) | Per environment | Per environment | Low |
| Per environment + per team/product | Per workload | Precise | High — cross-account access everywhere |
| Per customer/client | Per client | Precise | Very high |

### The Animals4Life middle ground

The org is cost-conscious but progressive — not looking for the enterprise answer, but for the
smallest structure that fixes the actual problems. A common fit:

> **Production gets its own hardened account. DEV and TEST share a lower-privileged one.**

Blast radius for the thing that matters, without paying the full tax of the enterprise layout
on day one. Add Organizations + SCPs later when the org structure outgrows hand-managed roles.

## Trade-offs to state in an interview

- More accounts → smaller blast radius, better cost attribution, cleaner guardrails.
- More accounts → more cross-account role assumption, more IAM policy surface, more to
  automate before you can move fast. **Automation is the prerequisite**, not the nice-to-have.
- A 100-account estate is not "more secure by default." It's 100 chances to write one bad
  policy. Guardrails (SCPs, permission boundaries, IaC with policy-as-code) are what make the
  split safe.

## Node tie-in

The account boundary is why a Node app's AWS credentials matter:

- **No static keys in the image or env.** A leaked `AWS_SECRET_ACCESS_KEY` in a Docker layer is
  a global credential. A task role dies with the task.
- **Scope the role to the process.** If the app only reads one S3 prefix, the policy says one
  prefix. `@aws-sdk/client-s3` will happily accept whatever the role allows.
- **Assume-role chaining** in multi-account setups should be visible in the SDK config, not
  assembled from strings in application code.
- **LocalStack** (`cloud/` local tooling) emulates the credential chain, so you can develop
  against multi-account layouts without real accounts.

## Related

- `01-accounts-vs-identities/README.md` — the container/identity distinction this builds on
- `CLOUD.md` → Track 3, topics 02–03 — policies and roles
