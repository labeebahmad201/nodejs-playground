# 03 — IAM Users (your first login inside the account)

Source: [learn.cantrill.io](https://learn.cantrill.io) — Adrian Cantrill's AWS architecture
course (running example: the **Animals4Life** rescue org).

## One-line mental model

> An AWS **account** is the building. An **IAM user** is a keycard you issue to someone who
> needs to get in. The keycard opens only the doors you list.

## Revise in 30 seconds

- You create IAM users in the **IAM** service. Each one is a login **inside one account**.
- A new user starts with **zero permissions** — access is granted explicitly.
- There are **two independent** kinds of access: **Console** (password) and **Programmatic**
  (access keys). Console access is **opt-in**.
- Secure it with **MFA**, exactly like the root user.
- IAM users have **no email** → no self-service password reset; an admin must help.
- **Root is special; IAM users are normal.** Root cannot be restricted; IAM users can.

## The hooks (memorise these)

| Fact | Hook |
|---|---|
| Container vs login | Account = container · IAM user = login inside it |
| Who has an email | Root has an email · **IAM users don't** |
| Two access types | Console = password · Programmatic = access keys (separate toggles) |
| Console access | **Opt-in** — tick "Provide user access to the AWS Management Console" |
| New user's rights | None. Grant via **group / copy / attach** |
| "Full access" policy | `AdministratorAccess` ≈ `Action:*` on `Resource:*` |
| First login | Force a **password change** at next sign-in |
| Human logins | Always add **MFA** |

## The sign-in link (account alias)

Every account has a **sign-in URL**. By default it uses the account ID, which nobody can
remember:

```
https://<12-digit-account-id>.signin.aws.amazon.com/console
```

You can replace the ID with an **account alias** you choose (e.g. `animals4life`):

```
https://animals4life.signin.aws.amazon.com/console
```

- The alias is a **per-account, human-friendly name** for the login page.
- It's cosmetic and global-ish, but it makes sign-in links shareable and memorable.
- You set it in **IAM → Account settings → Account alias**.

> Why it matters: without an alias, users must paste a 12-digit account ID to log in.

## Creating a user: the three permission paths

When you create (or edit) an IAM user, permissions can arrive three ways. Same destination,
different ergonomics:

| Path | What it does | When to use |
|---|---|---|
| **Add to group** | User inherits the group's policies | **Preferred** — manage many users in one place |
| **Copy permissions** | Clone another user's groups + policies | Fast bootstrap; then move them into a group |
| **Attach policies directly** | Policies on the user itself | One-off / exceptions only |

**Rule of thumb:** grant through **groups**, not directly. Direct attachments don't scale and
are easy to forget when someone changes roles. (The course does it directly on `iamadmin` to
show the mechanism — in real life you'd attach `AdministratorAccess` to an *Admins* group.)

## `AdministratorAccess` — what it actually is

`AdministratorAccess` is an **AWS-managed policy**:

```
arn:aws:iam::aws:policy/AdministratorAccess
{ "Effect": "Allow", "Action": "*", "Resource": "*" }
```

Plain English: **"allow every action on every resource in this account."** It's the broadest
permission you can attach to an identity — effectively *god mode inside the account*.

What it is **not**:

- **Not root.** A few things stay root-only (closing the account, changing root credentials,
  some billing/account-level actions). `AdministratorAccess` can't do those.
- **Not above the account boundary.** It grants nothing in other accounts.
- **Not un-restrictable.** Unlike root, it *can* be capped by an SCP or permission boundary.

Use it for a deliberate **admin identity**. Everyone else should get scoped policies via groups.

## MFA — lock the keycard to a device

You attach MFA to an IAM user the same way you do for root: **IAM → Users → (user) →
Security credentials → Assign MFA device**.

- Common types: **virtual MFA** (an authenticator app, TOTP), **hardware key** (FIDO2), passkey.
- A stolen password alone is then useless.
- Do it at creation, not "later" — later never comes.

## IAM users have **no email** (and why that matters)

- The **root user** is tied to the email you created the account with.
- An **IAM user** is not — it has **no email address** at all.

Consequences you should be able to recite:

- No self-service **"forgot password"** email.
- No self-service **MFA reset**.
- If a user is locked out, **an admin must reset** their password/MFA in the console.

So **troubleshooting routes through the account admin**, not through email. Design for it:
have at least one working admin login, and a documented reset process.

## Console access is opt-in — what if you skip it?

Creating a user has an optional checkbox: **"Provide user access to the AWS Management
Console."** Tick it → you set a **console password**. Skip it → the user has **no web login**.

| You provide… | The user can… | They cannot… |
|---|---|---|
| **Console access** (password) | Sign in at the sign-in URL, use the web console | — |
| **Programmatic access** (access keys) | Use the CLI / SDK / IaC | Sign in to the web console |
| Both | Do either | — |

So if you *don't* provide console access, the experience is: the person has **no password and
no console** — they exist only for **programmatic** use (and only if you also created access
keys). Many service/automation identities are exactly this. Human admins almost always get
console access.

## Recipe — create your first admin IAM user (9 steps)

1. Open the **IAM** service (search "IAM" in the service list).
2. **Customise the sign-in URL** by creating an **account alias**.
3. Create a user named **`iamadmin`** and grant admin permissions.
4. Set a **console password**; decide whether a **change is required at next sign-in**.
5. Assign the **`AdministratorAccess`** policy directly to the user.
6. **Review** the settings and create the user.
7. Secure it with **MFA** (choose a device, follow the prompts, test it).
8. **Sign out** of the account.
9. Sign back in using **`iamadmin`** and the **IAM sign-in URL** (alias).

Outcome: an admin IAM user, secured with MFA, used for most day-to-day admin tasks — leaving
the **root** user for the handful of root-only actions.

## Cheat sheet (60-second recall)

```
Account  = container          Root    = unrestricted, has email
IAM user = login inside it     IAM user = restrictable, NO email

Access types:   Console (password)  +  Programmatic (access keys)  — separate
Grant rights:   group (preferred) · copy · attach directly
Full access:    AdministratorAccess = Action:* on Resource:*
Secure:         MFA on every human login
Locked out?     Admin resets it (no email self-service)
```

## Node tie-in

This is the identity a Node app's credentials ultimately come from — and why you rarely want
the static-key version:

- A user with **programmatic access** means long-lived **access keys**. Prefer **roles** on
  EC2/ECS/Lambda so there are no stored keys (see `CLOUD.md` → Track 3.03).
- If you *must* use an IAM user for the SDK, scope it tightly — `@aws-sdk/client-*` will use
  whatever the identity allows, so `AdministratorAccess` on an app is a breach waiting to happen.
- The SDK **credential chain** (`@aws-sdk/credential-provider-node`) is why env-var keys are a
  fallback of last resort, not a default.

## Related

- [`../01-accounts-vs-identities`](../01-accounts-vs-identities/README.md) — account vs identity
- [`../02-boundary-and-blast-radius`](../02-boundary-and-blast-radius/README.md) — the boundary
- [`CLOUD.md`](../../../CLOUD.md) → Track 3 — the full AWS roadmap (policies, roles next)
- [learn.cantrill.io](https://learn.cantrill.io) — source of the Animals4Life scenario
