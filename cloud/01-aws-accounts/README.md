# 01 — AWS Accounts & Identities

The container/identity distinction, and why it decides everything downstream.

Source material: [learn.cantrill.io](https://learn.cantrill.io) — Adrian Cantrill's AWS
architecture course, which uses the fictional **Animals4Life** rescue organisation as a
running example. That scenario is preserved in `01-accounts-vs-identities/README.md` because
it gives the abstract concepts something concrete to attach to.

## Sub-topics

| Dir | Covers |
|---|---|
| [`01-accounts-vs-identities`](./01-accounts-vs-identities/) | Account as a container vs IAM identity; account attributes; root user; pay-as-you-go; the Animals4Life scenario |
| [`02-boundary-and-blast-radius`](./02-boundary-and-blast-radius/) | The account boundary, isolation, containment, multi-account structure |
| [`03-iam-users`](./03-iam-users/) | Creating identities inside the account; console vs programmatic toggles; MFA; `AdministratorAccess` |
| [`04-iam-access-keys`](./04-iam-access-keys/) | Access key pairs, the 0–2 rule, long-term credentials, and why IAM roles replace them |
| [`03-iam-users`](./03-iam-users/) | Creating IAM users: sign-in URL/alias, console vs programmatic access, the three permission paths, `AdministratorAccess`, MFA, and the "no email" gotcha |

## Why this is topic 01

Nothing else in Track 3 makes sense without it. IAM policies, roles, and least privilege
(`02`, `03`) are all statements about who can cross the account boundary and what they can
touch once inside. Networking (`04`) assumes you know how many VPCs and in which accounts.

## Node tie-in

The generic version of this lesson is "don't use root." The Node-specific version is more
concrete and more useful:

- **The SDK credential chain** (`@aws-sdk/credential-provider-node`) resolves credentials in
  order — env vars, shared config, container/instance metadata, web identity — and it is the
  reason long-lived access keys in `.env` files are an anti-pattern. Covered in
  [`04-iam-access-keys`](./04-iam-access-keys/README.md), with the full resolution order and
  why setting env vars *shadows* the safe path.
- **Task roles vs instance roles** — on ECS/Fargate the task role is scoped to the workload,
  not the box, so one compromised task can't read another task's credentials.
- **Least privilege at the process level** — if the app can call `iam:PassRole`, it can
  escalate. The account boundary only helps if the policies inside it are tight.

## Status

- [x] `01-accounts-vs-identities`
- [x] `02-boundary-and-blast-radius`
- [x] `03-iam-users`
- [x] `04-iam-access-keys`

Next up: `02-aws-iam-policies` (policy structure, explicit deny, permission boundaries, SCPs).
