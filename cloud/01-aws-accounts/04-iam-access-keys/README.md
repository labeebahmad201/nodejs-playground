# 04 — IAM Access Keys (programmatic credentials)

Source: [learn.cantrill.io](https://learn.cantrill.io) — Adrian Cantrill's AWS architecture
course (running example: the **Animals4Life** rescue org).

## One-line mental model

> If a password gets you into the **console**, an access key gets your **code** into the
> account. It is the same permission, handed to a machine instead of a person.

## Revise in 30 seconds

- So far, access has been through the **console UI**. The command line — and any application
  you write — authenticates with **access keys**, not a username and password.
- The CLI stores them in profiles: `aws configure` (default) or
  `aws configure --profile NAME` (named), selected per command with `--profile`.
- An access key is a pair: **`accessKeyId`** + **`secretAccessKey`**.
- They are **long-term** credentials: they don't change on their own. *You* have to change
  them.
- An IAM user can have **0, 1, or 2** active key pairs — never more than 2.
- Keys can be **created, deleted, activated, or deactivated**.
- The root user can also have access keys, but that is **not recommended**.
- **IAM roles do not use access keys.** This is the important one.

## Console vs programmatic — the two doors

| | Console access | Programmatic access |
|---|---|---|
| Auth | Username + **password** (+ MFA) | **Access key ID + secret** |
| Used by | Humans, in a browser | CLI, SDKs, IaC, CI/CD |
| Set up via | "Provide user access to the AWS Management Console" checkbox | "Create access key" in Security credentials |
| Credential lifetime | Rotated by policy | **Long-term** until manually replaced |

Both are **separate toggles** on the same IAM user. Having one does not imply the other.

## Why "long-term" is the whole point

An access key is called a **long-term** credential because it does not expire. It stays valid
from creation until someone deletes it.

That makes it both the reason it's useful and the reason it's dangerous:

- **Useful** — a CLI or a long-running app can authenticate once and keep working with no
  refresh logic, no token exchange, no STS call.
- **Dangerous** — there is no expiry forcing rotation. A leaked key is valid until a human
  notices. Unlike a session token, nothing forces it to change.

> Say this in an interview: *"the credential is long-lived, so rotation is a human process,
> not an automatic one."* That's the whole reason roles exist as an alternative.

## The 0–2 rule

An IAM user may have **at most two** access key pairs at a time.

Why two? Because the standard rotation pattern uses both:

1. Create **key B** alongside existing **key A**.
2. Deploy **B** everywhere **A** was used.
3. Verify traffic is authenticating with **B**.
4. Delete **A**.

Doing it this way means there's never a window where the credential doesn't work — which is
exactly why the limit is 2 and not 1. AWS wants you to be able to rotate safely; it doesn't
want a pile of stale keys hanging around.

| Keys active | What it means |
|---|---|
| **0** | No programmatic access — human who only uses the console |
| **1** | Normal steady state |
| **2** | Mid-rotation, or two distinct systems/systems of record |
| **3+** | **Not possible.** Delete before creating |

**0 is a completely normal and valid state.** An IAM user created purely for console sign-in
has no keys and needs none.

## Key lifecycle

| Action | Effect |
|---|---|
| **Create** | Issues a new pair. **The secret is shown exactly once.** |
| **Deactivate** | Temporarily disables the pair. The user stays, the key stops working. |
| **Activate** | Re-enables a previously deactivated pair. |
| **Delete** | Removes the pair permanently. Irreversible. |

`Deactivate` is the underrated one. Need to cut off one misbehaving integration *without*
deleting the IAM user and all its permissions? **Deactivate the key.** Same permissions still
attached, one door closed.

## If you lose the secret access key

You cannot retrieve it. AWS shows it once at creation and cannot display it again — by
design, because an API that could re-display it would be an API that leaks it.

Recovery is straightforward anyway:

1. **Delete** the lost key pair.
2. **Create** a new one.
3. **Distribute** the new secret to whatever was using the old one.

That ordering is why the 2-key limit is useful — you can create the replacement *before*
deleting the lost one, so nothing breaks in between.

## Root access keys — technically possible, don't

The root user **can** have access keys. Avoid it.

Why it matters, stated plainly: root keys carry **unrestrictable** permissions. If a root key
leaks, an attacker has everything in the account and there is no policy, SCP, or permission
boundary that can cap it. An IAM user's leaked key is only as powerful as its attached
policies.

Root keys also bypass MFA. Root console access can require MFA; root access keys cannot.

> **Rule:** if you need programmatic access, create a **dedicated IAM user** (or better, a
> role) with scoped policies. Never mint root keys.

## IAM roles don't use access keys

This is the conceptual pivot of the whole topic.

An **IAM role** is not a login. It can't be signed into. It has no password, and it has no
access key. Instead, something *assumes* it and receives **temporary** credentials.

| | IAM user + access key | IAM role |
|---|---|---|
| Has access keys? | Yes — up to 2 | **No, never** |
| Credential type | **Long-term** | **Temporary** (session, minutes to hours) |
| Expiry | None, until deleted | Auto-expires |
| Exposed in code/config? | Yes — often by accident | No |
| Rotation | **Manual, human-driven** | **Automatic** |
| MFA | Can be required for console | N/A |
| Typical use | Legacy, or one-off local dev | EC2, ECS, Lambda, CI/CD, cross-account |

Because role credentials are temporary and handed out at assume-time, the credential only
exists **inside the running process**, not in a config file you can accidentally commit.

Where the credential lives:

| Context | How the role is reached |
|---|---|
| EC2 | Instance profile, via the **instance metadata service** (IMDS) |
| ECS / Fargate | **Task role**, injected into the container |
| Lambda | Automatically, by the service |
| CI/CD | OIDC federation with GitHub Actions / GitLab |
| Cross-account | `AssumeRole` with a trust policy |
| Local dev | `AWS_PROFILE`, or LocalStack |

Every one of these ends in the same place: **the SDK gets temporary credentials at runtime and
never sees a static key.**

## The AWS CLI and profiles

The console is only one of three ways into an account. The same credentials story applies to
all of them:

| Surface | Authenticates with | Typical user |
|---|---|---|
| **Console UI** | Password (+ MFA) | Humans, in a browser |
| **Command line** (`aws` CLI) | **Access keys** | Humans, scripts, one-off ops |
| **In an application** (SDK / IaC) | **Access keys, or role creds** | Services, automation |

On the command line there is **no username and password**. The CLI authenticates with an
access key pair, full stop. That's the same programmatic credential from the rest of this
page — the CLI is just a client that reads it from a file.

### `aws configure`

Run it once and it walks you through four prompts, writing the result to two files under
`~/.aws/`:

```
$ aws configure
AWS Access Key ID [None]: AKIA...
AWS Secret Access Key [None]: ****************
Default region name [None]: ap-southeast-2
Default output format [None]: json
```

That produces:

| File | Holds |
|---|---|
| `~/.aws/credentials` | `accessKeyId` + `secretAccessKey`, in **plaintext** |
| `~/.aws/config` | region, output format, per-profile settings |

Because it's plaintext on disk, `~/.aws/credentials` is itself a secret. Treat it like one.
(That's the residual risk roles eliminate — covered above.)

### Default profile vs named profiles

The four prompts above **without** `--profile` write to the **default profile** — the one used
when you run a bare `aws` command.

To keep more than one identity on the same machine, use a **named profile**:

```
$ aws configure --profile iamadmin-general
```

This keys the same four values under `[iamadmin-general]`. Then you select it per command:

```
$ aws s3 ls --profile iamadmin-general
```

| | Default profile | Named profile |
|---|---|---|
| Written by | `aws configure` | `aws configure --profile NAME` |
| Used when | No `--profile` given | `--profile NAME` on the command |
| Good for | One identity on the machine | Many identities side by side |

`--profile` is the AWS CLI equivalent of `--env` on a Node script: it picks which set of
credentials the command runs under. The SDK resolves the same setting from `AWS_PROFILE`.

> **The value of named profiles:** you can keep a personal identity, an Animals4Life work
> identity, and a CI identity on one laptop, and switch per terminal command instead of
> editing files. It also makes "which identity am I?" an explicit part of every command.

## Reading the two errors

The CLI fails in two distinct ways, and the error message tells you **which layer** is broken.
Learning to read them is the practical skill here.

### No credentials at all

```
$ aws s3 ls
aws: [ERROR]: An error occurred (NoCredentials) when calling the ListBuckets operation:
Unable to locate credentials. You can configure credentials by running "aws login".
```

**Meaning:** no credentials were found. The bare command looked at the **default profile**,
found nothing (you only configured a named one), and gave up.

**Fix:** pass `--profile`, or configure a default profile.

```
$ aws s3 ls --profile iamadmin-general
2026-10-13 18:06:38 platformic-bucket
```

The lesson: `NoCredentials` is a **configuration** problem. The request never got far enough to
be rejected — the CLI didn't know *who* it was.

### Credentials present but invalid

```
$ aws s3 ls --profile iamadmin-general
aws: [ERROR]: An error occurred (InvalidAccessKeyId) when calling the ListBuckets operation:
The AWS Access Key Id you provided does not exist in our records.
```

**Meaning:** a profile was found and its key was sent — but the key **no longer exists in AWS**.
This happens when you delete the access key in the console while the client still holds it
locally.

**Fix:** delete the stale profile (or re-run `aws configure --profile ...` with a live key).

The lesson: `InvalidAccessKeyId` is an **identity** problem. The CLI knew who it was, told AWS,
and AWS said "that key is gone."

| Error | Which layer | Feels like |
|---|---|---|
| `NoCredentials` | **Config** — no key on this machine | "I don't know who I am" |
| `InvalidAccessKeyId` | **Identity** — key exists locally, deleted in AWS | "I claimed an identity AWS doesn't recognise" |

> **Interview-worthy distinction.** `NoCredentials` means the client couldn't *find* a
> credential. `InvalidAccessKeyId` means it found one and AWS *rejected* it. Same symptom
> (command fails), completely different cause and fix. Being able to name which is which is
> the difference between a guess and a diagnosis.

This is also the concrete demonstration of "long-term credentials don't change on their own":
delete the key in AWS and the local copy stops working immediately, with **no expiry event**
and **no notification** — nothing tells you it happened until something breaks.

## Clean up after configuring

Once the CLI is configured and working, **delete the downloaded key file**.

When you create an access key in the console, AWS offers to download a `.csv` containing the
`accessKeyId` and `secretAccessKey`. That file is a plaintext secret sitting in `~/Downloads`.

- The CLI now holds the credential in `~/.aws/credentials`.
- The downloaded `.csv` is a **second, unnecessary copy** of the same secret.
- A second copy is a second place to leak it from.

So: configure, verify, then delete the `.csv`. It served its one purpose.

> Generalise it: **secrets should exist in exactly one place.** Every extra copy — a download,
> a screenshot, a paste into a note, a commit — is an independent chance to leak, and none of
> them expire.

## Node tie-in

This topic maps directly onto how a Node app should authenticate — and it's where most real
leaks happen.

**The anti-pattern:**

```js
// Do not ship this
new S3Client({
  region: "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
```

Real credentials get committed, land in `docker history`, leak through CI logs, and never
expire.

**The default — let the chain resolve:**

```js
new S3Client({ region: "ap-southeast-2" });
```

The SDK's default credential chain
(`@aws-sdk/credential-provider-node`) resolves credentials in this order:

1. Explicit values passed to the client (the anti-pattern above)
2. `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` env vars
3. Shared credentials file (`~/.aws/credentials`, `AWS_PROFILE`)
4. **Container/instance credentials** — IMDS, ECS task role
5. **Web identity token** — Lambda, ECS, EKS pod identity, GitHub Actions OIDC
6. SSO / `aws sso`

Because steps 4 and 5 come **before** you'd think to look, running on EC2 or in CI with **no
keys in the environment** is both the easiest and the safest setup. If you set env vars, you
shadow the safe path with the risky one.

**Rule:** pass `region` and nothing else. If the SDK can't resolve credentials, the
environment is wrong — not the code.

Two more Node-specific points:

- **Never log the config object.** `client.config.credentials` can be populated at runtime; a
  `console.log(client)` or an unhandled-error dump can serialise live secrets. Already covered
  by `21-stdout-vs-console` and the `CLOUD.md` secrets topic.
- **Session credentials are refreshable.** When the SDK assumes a role it gets an expiry and
  re-assumes automatically. Long-term keys don't have that problem to solve — because they
  never expire at all, which is the problem.

## Cheat sheet (60-second recall)

```
Console auth   = password (+MFA)      → browser
Programmatic   = access key pair      → CLI / SDK / IaC

Access key     = accessKeyId + secretAccessKey
                 LONG-TERM — never auto-expires, you rotate it
                 shown ONCE at creation, unrecoverable if lost

Per IAM user   = 0, 1, or 2 key pairs — never 3+
                 0 = console-only user (normal)
                 2 = mid-rotation

Lifecycle      = create · deactivate · activate · delete
                 deactivate = cut off one integration, keep the user

Lost secret?   = delete the pair, create a new one
                 (create the replacement FIRST if you can)

Root keys      = possible, DON'T. Unrestrictable, no MFA.
Roles          = NO access keys, ever. Temporary creds at assume-time.

CLI auth       = access keys, NOT user/password
                 aws configure                      → default profile
                 aws configure --profile NAME       → named profile
                 aws <cmd> --profile NAME           → pick per command

Errors         = NoCredentials      → config problem (no key found)
                 InvalidAccessKeyId  → identity problem (key deleted in AWS)

After config   = delete the downloaded .csv. One secret, one place.
```

## Related

- [`../01-accounts-vs-identities`](../01-accounts-vs-identities/README.md) — account vs identity
- [`../02-boundary-and-blast-radius`](../02-boundary-and-blast-radius/README.md) — the boundary
- [`../03-iam-users`](../03-iam-users/README.md) — IAM users, console vs programmatic toggles
- [`CLOUD.md`](../../../CLOUD.md) → Track 3 — full AWS roadmap (roles & federation next)
- [learn.cantrill.io](https://learn.cantrill.io) — source of the Animals4Life scenario
