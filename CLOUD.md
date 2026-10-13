# Cloud & Operations Roadmap

A parallel track to [`ROADMAP.md`](./ROADMAP.md): the **cloud / ops skills** to build and
document — containers, Kubernetes, AWS, observability, IaC, and reliability. Where `ROADMAP.md`
answers *"how does Node work?"*, this answers *"how do I run Node in the cloud, safely and
observably?"*

It deliberately **cross-references** `ROADMAP.md` rather than duplicating it. Several topics there
are cloud-adjacent and are reused here:

| ROADMAP.md topic | Reused by |
|---|---|
| 27 Containerization (Dockerfile, multi-stage, non-root) | Track 1 |
| 28 Orchestration & cloud (K8s, serverless, Node-aware scaling) | Track 2, Track 3 |
| 21 App health & observability (metrics, health checks, OTel) | Track 4 |
| 22 Fault tolerance (retries, timeouts, circuit breakers) | Track 6 |
| 0 OS & runtime fundamentals (cgroups, rlimits, fds) | Track 1 |
| 15/16/17 memory & GC (heap vs RSS, leaks) | Track 2, Track 4 |

Status: `[ ]` not started · `[~]` in progress · `[x]` done

## Guiding principles

1. **Local-first.** Anything we can run on this machine, we run: `kind`/`k3d` for Kubernetes,
   `docker compose` for Prometheus/Grafana/OTel, **LocalStack** for AWS. Real cloud only where a
   managed service can't be emulated — with **cost + teardown** notes on every such lab.
2. **Reproduce → measure → cite** (the `ROADMAP.md` rule). Each topic gets a runnable example where
   possible, real numbers, and authoritative sources. No content copied from docs.
3. **Node is the lens.** Every cloud concept is tied to a Node concern we already document
   (see "Node-specific hooks"). Generic cloud docs are everywhere; the value here is the Node angle.
4. **Vertical slices over breadth.** Prefer one end-to-end example (deploy → observe → load → fail →
   fix) to a wide checklist of unconnected notes.

## Node-specific hooks (the differentiator)

The reason a Node engineer needs *these* cloud topics, and not generic ones:

| Cloud concept | Node concern it collides with | Where we cover it |
|---|---|---|
| Container/K8s **memory limit** | `--max-old-space-size` inside a cgroup; OOMKilled (exit 137) vs V8 GC; Node 20+ is cgroup-aware | `15-v8-memory`, `17-ratelimiter-leak` |
| **CPU limit / throttling** | event-loop lag; `UV_THREADPOOL_SIZE`; libuv starvation under CFS quota | `ROADMAP.md` topic 31, scaling checklist |
| **liveness / readiness probes** | event-loop lag, `/health` that must not block; readiness vs draining | Track 2.5 |
| **HPA / autoscaling** | scale on **custom metrics** (event-loop lag, queue depth), not just CPU | Track 2.8 |
| **SIGTERM / rolling deploy** | graceful shutdown: stop accepting, drain connections, close pools; `preStop` sleep; PDB | `ROADMAP.md` topic 9 |
| **Observability** | per-process metrics: `heapUsed`/`rss`/`external`, GC pauses, fds, active handles, ELU | `ROADMAP.md` → per-process metrics |
| **Secrets / IAM** | no secrets in env/logs; task/instance roles; least privilege | Track 6.31 |
| **Serverless (Lambda)** | cold starts, layers, bundle size, connection reuse (RDS Proxy) | Track 3.20 |

---

## Track 1 — Foundations

- [ ] **1. Containers & images** — Dockerfile, layer caching, multi-stage builds, `.dockerignore`,
  non-root user, distroless/alpine tradeoffs, image size, `HEALTHCHECK`. Node-specific: which base
  image, native deps, `NODE_ENV`, `--production` installs, signal handling (PID 1).
  Example dir: `cloud/01-containers`. Reuses `ROADMAP.md` topic 27.
- [ ] **2. cgroups, namespaces & Node** — how the kernel limits a container (`memory.max`,
  `cpu.max`, `pids.max`), and how Node reads them (Node 20+ derives heap/threadpool defaults from
  cgroup limits). Why a Node process OOM-kills *below* the container limit (RSS + external + native
  + kernel socket buffers). Example dir: `cloud/02-cgroups`. Reuses `ROADMAP.md` topic 0,
  `15-v8-memory/rss.md`.

## Track 2 — Kubernetes

- [ ] **3. Core objects** — Pod, ReplicaSet, Deployment, Service, ConfigMap, Secret; the
  declarative model (`kubectl apply`, desired vs observed state). Example: `cloud/03-k8s-core`.
- [ ] **4. Resource requests & limits / QoS** — requests vs limits, QoS classes
  (Guaranteed/Burstable/BestEffort), **OOMKilled** vs CPU throttling, and how to size a Node heap
  *inside* the limit. Example: `cloud/04-k8s-limits`.
- [ ] **5. Probes** — liveness vs readiness vs startup; `/health`/`/ready` that reflect the event
  loop; why a bad liveness probe causes restart loops; `readiness` for zero-downtime.
  Example: `cloud/05-k8s-probes`.
- [ ] **6. Config & secrets** — ConfigMap vs Secret, env vs mounted volumes, `Secret` is not
  encrypted at rest by default, external secret operators. Example: `cloud/06-k8s-config`.
- [ ] **7. Services & ingress** — ClusterIP/NodePort/LoadBalancer, kube-proxy, ingress controller
  (nginx), TLS termination, `X-Forwarded-For` at the edge (see `18-x-forwarded-for`).
  Example: `cloud/07-k8s-ingress`.
- [ ] **8. Autoscaling** — HPA (CPU/memory + **custom metrics**), VPA, cluster autoscaler;
  scaling Node on **event-loop lag** or queue depth. Example: `cloud/08-k8s-hpa`.
- [ ] **9. Scheduling** — node/pod affinity, taints & tolerations, topology spread, PDBs.
- [ ] **10. Stateful workloads** — StatefulSet, PVCs, storage classes; running stateful services
  (DBs) vs managed equivalents.
- [ ] **11. Helm & packaging** — charts, values, templating; `helm install/upgrade/rollback`.
- [ ] **12. Local clusters** — `kind`, `k3d`, `minikube`, Docker Desktop K8s; multi-node locally.
  Example dir: `cloud/12-local-cluster`.
- [ ] **13. Operators & CRDs** — the control-loop pattern, when not to write one.

## Track 3 — AWS

Numbering under `cloud/` restarts at `01` and is independent of the root-level topic numbers.

- [x] **01. Accounts & identities** — AWS account as a container vs IAM identity; account root
  user and why it can't be restricted; account boundary, blast radius, and multi-account
  structure; creating the first **IAM user** (sign-in alias, console vs programmatic access,
  group/copy/attach permissions, `AdministratorAccess`, MFA, no-email gotcha). Running example:
  the Animals4Life rescue org from
  [learn.cantrill.io](https://learn.cantrill.io). Node tie-in: why the SDK credential chain and
  task/instance roles replace long-lived root access keys.
  Example: `cloud/01-aws-accounts`.
- [ ] **02. IAM policies** — policy structure, allow/deny, explicit deny, permission boundaries,
  SCPs. Example: `cloud/02-aws-iam-policies`.
- [ ] **03. Roles & federation** — trust policies, `AssumeRole`, cross-account access, OIDC for
  CI, instance profiles & ECS task roles. Why long-lived access keys are the anti-pattern.
  Example: `cloud/03-aws-roles`.
- [ ] **04. Networking** — VPC, subnets (public/private), route tables, security groups vs NACLs,
  ALB/NLB, Route 53. Node tie-in: XFF/`X-Forwarded-Proto` at the ALB (`18-x-forwarded-for`).
  Example: `cloud/04-aws-networking`.
- [ ] **05. Compute** — EC2 → ECS/Fargate → Lambda → App Runner; tradeoffs and when each fits.
  Example: `cloud/05-aws-compute`.
- [ ] **06. Storage** — S3 (and SDK usage/streaming), EBS, EFS. Example: `cloud/06-aws-storage`.
- [ ] **07. Data** — RDS/Aurora, ElastiCache (Redis), DynamoDB, SQS/SNS; Node connection pooling,
  `RDS Proxy` for Lambda. Example: `cloud/07-aws-data`.
- [ ] **08. AWS observability** — CloudWatch metrics/logs/alarms, Container Insights, X-Ray.
  Example: `cloud/08-aws-observability`.
- [ ] **09. Serverless & Node** — Lambda cold starts, layers, bundle size, provisioned concurrency,
  connection reuse, the `aws-lambda` handlers vs a server. Example: `cloud/09-lambda-node`.
- [ ] **10. Cost & teardown** — budgets, tagging, `aws-nuke`/`terraform destroy`, free-tier traps.
  Example: `cloud/10-aws-cost`.

## Track 4 — Observability

- [ ] **22. Metrics** — Prometheus model (counters/gauges/histograms), `prom-client` in Node, scrape
  vs push, `/metrics`; RED (rate/errors/duration) and USE (utilization/saturation/errors) methods.
  Example: `cloud/22-metrics`.
- [ ] **23. Logging** — structured logs (`pino`), correlation/request ids, log levels, shipping to
  Loki/ELK; never log secrets; log volume + cost. Example: `cloud/23-logging`.
- [ ] **24. Tracing** — OpenTelemetry (auto vs manual instrumentation) → Jaeger/Tempo; spans across
  Node services and DB/HTTP calls; trace context propagation. Example: `cloud/24-tracing`.
- [ ] **25. Dashboards** — Grafana, the four golden signals, Node runtime dashboards
  (heap/RSS/GC/event-loop/fds). Example: `cloud/25-dashboards`.
- [ ] **26. SLI / SLO / alerting** — SLIs, SLOs, error budgets, burn-rate alerts, Alertmanager;
  alert on **symptoms**, not causes. Example: `cloud/26-slo`.
- [ ] **27. Node runtime signals** — event-loop lag/ELU (`perf_hooks`), GC pauses
  (`PerformanceObserver`), active handles, open fds, heap/RSS/external — the concrete Node metrics
  from `ROADMAP.md` → "Per-process metrics". Example: `cloud/27-node-signals`.

## Track 5 — IaC & CI/CD

- [ ] **28. Terraform** — providers, state (remote + locking), modules, plan/apply, drift, import.
- [ ] **29. CI/CD** — GitHub Actions: build/test/scan/deploy; caching; environments & OIDC to AWS.
- [ ] **30. GitOps** — ArgoCD/Flux; declarative deploys, drift reconciliation, progressive delivery.

## Track 6 — Security & reliability

- [ ] **31. Secrets management** — AWS Secrets Manager / SSM Parameter Store, Vault, K8s secrets +
  external-secrets; rotation; no secrets in env/logs/images.
- [ ] **32. Least privilege & network policy** — minimal IAM policies, K8s `NetworkPolicy`,
  pod security standards, image scanning (trivy), SBOM.
- [ ] **33. Graceful shutdown & zero-downtime deploys** — SIGTERM handling, connection draining,
  `preStop`, readiness gates, PDBs, rolling vs blue/green vs canary. Reuses `ROADMAP.md` topic 9.
- [ ] **34. Resilience** — timeouts, retries with backoff + jitter, circuit breakers, bulkheads,
  load shedding, chaos experiments. Reuses `ROADMAP.md` topic 22.

---

## Vertical slices (example projects)

End-to-end examples that tie a whole track together. One directory each, with a `README.md`.

- [ ] **Slice 1 — "Ship it and break it."** Containerize the `17-ratelimiter-leak` service, add
  `prom-client` metrics, run it under a **memory limit**, and load-test it to show **OOMKilled vs
  healthy GC**; then deploy the same image to a local cluster with requests/limits, probes, a
  Service, and Prometheus scraping. *Covers Tracks 1, 2, 4.* Example dir: `cloud/slice-01-ship-and-break`.
- [ ] **Slice 2 — Observability stack.** Metrics + logs + traces for one Node service via
  `docker compose` (Prometheus, Grafana, Loki, Tempo/OTel collector) and a starter dashboard + SLO.
  *Covers Track 4.*
- [ ] **Slice 3 — Scale on event-loop lag.** HPA driven by a custom metric (event-loop lag / queue
  depth) instead of CPU. *Covers Track 2.8, Track 4.27.*
- [ ] **Slice 4 — Zero-downtime deploys.** Graceful shutdown + readiness + PDB, then a rolling
  deploy under continuous load with **zero** failed requests. *Covers Track 6.33.*
- [ ] **Slice 5 — Serverless Node.** The same handler as a Lambda (cold starts, layers, RDS Proxy),
  compared against the container. *Covers Track 3.20.*

## Local tooling (what to install)

| Tool | For | Notes |
|---|---|---|
| Docker + Compose | containers, observability stack | already installed |
| `kind` or `k3d` | local Kubernetes | `brew install kind` / `k3d` |
| `helm` | packaging | `brew install helm` |
| `kubectl` | cluster CLI | already installed |
| LocalStack | emulated AWS | Docker image / `brew install localstack` |
| `aws` CLI | real-account labs | `brew install awscli` |
| `terraform` | IaC labs | `brew install terraform` |

> These are **not** installed yet (except Docker + `kubectl`). Install per-slice, on demand.

## Sources / references

- **Kubernetes** docs — <https://kubernetes.io/docs/>; resource management & QoS
  <https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/>; probes
  <https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/>;
  HPA <https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/>.
- **AWS** docs — <https://docs.aws.amazon.com/>; ECS/Fargate, Lambda, IAM, VPC, CloudWatch;
  container memory <https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html>.
- **Docker** — Dockerfile best practices <https://docs.docker.com/build/building/best-practices/>.
- **Prometheus** — <https://prometheus.io/docs/>; `prom-client` <https://github.com/siimon/prom-client>.
- **OpenTelemetry** — Node SDK <https://opentelemetry.io/docs/languages/js/>.
- **Grafana / Loki / Tempo** — <https://grafana.com/docs/>.
- **Linux cgroups v2** — <https://docs.kernel.org/admin-guide/cgroup-v2.html>.
- **Node.js** — `--max-old-space-size`, `UV_THREADPOOL_SIZE`, `process.report`, `perf_hooks`
  (`monitorEventLoopDelay`, `eventLoopUtilization`): <https://nodejs.org/api/cli.html>.
- Cross-references: `ROADMAP.md` (topics 0, 9, 21, 22, 27, 28, 31), `15-v8-memory`,
  `17-ratelimiter-leak`, `18-x-forwarded-for`.

## How to add a cloud topic

1. Pick the next number and create `cloud/{n}-{name}` (kept separate from the flat `ROADMAP.md`
   example dirs to avoid collisions).
2. Add the code/manifests plus a `README.md` (what it shows, how to run, real output, citations).
3. Tick the topic here (status + example dir).
4. If it overlaps a `ROADMAP.md` topic, link to it instead of repeating.
