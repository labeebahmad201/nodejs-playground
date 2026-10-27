# 📡 Coupling via Event Bus Topic Strings

## Definition

This is coupling through an implicit runtime communication channel, typically a string identifier or topic name. A publisher and subscriber have no static reference to each other; they are coupled only by agreeing on the same topic string. A typo silently breaks the chain with no compile-time error.

## Real-world example — TopicEventBus library (Swift)

Subscriber:

```swift
let conversationId = "1234"
_ = self.topicEventBus.subscribe(topic: conversationId, callback: {
    (conversationChangedEvent: ConversationChangedEvent) in
    // runs when an event with topic "1234" is fired
})
```

Publisher in a separate service:

```swift
self.topicEventBus.fire(event: ConversationChangedEvent.init(
    conversationId: "1234",
    newTitle: "First update"
))
```

The publisher has no import or type-level reference to the subscriber. The coupling exists only through the shared string `"1234"`.

## Why it’s bad

The TypeScript compiler sees none of it. The publisher and subscriber can live in different repositories, be compiled at different times, and deploy independently; they agree only on a string literal and an implicit payload shape. When either drifts, nothing fails until runtime, and the failure is often silent.

A typo in the topic string breaks the chain with no compile-time error. A renamed field can parse as `undefined` and still look like a valid event. Neither side knows it is out of sync until something downstream behaves incorrectly.

## Fix: make the contract explicit

The fix has three layers. All three are necessary for a genuine decoupling.

### Layer 1: Make the contract a runtime value, not just a type

The foundational move is to define a runtime schema first, then infer the TypeScript type from it. A plain `interface` erases at runtime; a Zod (or io-ts/Valibot) schema survives as an executable value that can validate payloads coming from any producer, including one written in another language or running an older version of the code.

The `@crossdelta/cloudevents` package shows the canonical pattern: the schema is exported as a value and the type is derived from it, so the schema is the single source of truth for both compile-time inference and runtime validation:

```typescript
// The schema IS the contract — it exists at runtime.
export const OrderCreatedSchema = z.object({
  orderId: z.string(),
  total: z.number(),
});

// The type is INFERRED from the schema, never written separately.
export type OrderCreatedEvent = z.infer<typeof OrderCreatedSchema>;
```

Validation must run at **both boundaries**: on publish (so a malformed producer fails fast) and on receive (so a stale or foreign consumer rejects events it cannot safely process). Libraries like `zodbus` make receive-side validation the default, and the `TypedEventBus` documented in the wild validates on both publish and receive, stripping unknown fields via Zod's `.strip()` behavior. Without runtime validation, an old consumer that still expects `totalAmount` after a producer renames it to `amount` will silently parse `undefined`—the exact failure mode that schema validation exists to catch.

The schema fixes the payload, but the topic is still a string. The topic must become part of the contract too: export the event name from the same versioned artifact, or use the event type in the envelope and let subscribers bind to that type. Otherwise a publisher can validate the payload correctly and still publish to a topic no subscriber is listening to.

### Layer 2: Choose where the contract lives based on deployment coupling

Once the contract is a runtime value, you must decide how it reaches both sides. The choice is a genuine trade-off between **simplicity/coupling** and **autonomy/scalability**.

**Option A — Shared contracts package (simplest for TypeScript-only shops).**

Publish a versioned npm package containing the schemas (and the inferred types) and have both producer and consumer import from it. This eliminates drift within the TypeScript ecosystem because both sides literally execute the same schema object. The `@rjrcosta/contracts` package states the rule explicitly: “Events are versioned (v1, v2, ...); Existing versions MUST NEVER change; New changes require a new version.”

A practical structure, drawn from how real packages organize these, is one contract per logical producer (a “package-per-service” model). The NServiceBus guidance recommends a **separate message-contract assembly for each service**, so that a service can evolve its contracts without impacting others. The downside is versioning overhead: every consumer must be able to process the versions it subscribes to, and you need a sunset policy for old versions.

**Option B — Schema registry (for polyglot or independently deployed services).**

When services are not all TypeScript, or when producers and consumers deploy on entirely independent schedules, a language-neutral registry (Confluent Schema Registry, Apicurio, AWS EventBridge schema registry) is the stronger enforcement point. The registry checks compatibility **at registration time**, before a new producer version ever reaches production, rejecting breaking changes mechanically rather than relying on code review. Code for each language is generated from the registered schema, so the contract is still a runtime artifact—it just lives in a neutral home rather than an npm package.

**Option C — Hybrid: shared package with embedded schema, registry for cross-language boundaries.**

The “lighter-weight alternative” described in the schema-versioning literature is to **embed the Zod schema alongside the event type in a shared package**; both producer and consumer import from it, and the package becomes the contract. This gives you TypeScript-native runtime validation without standing up registry infrastructure. When a non-TypeScript service enters the picture, generate its types from the same schema and register the schema in a registry so the broker enforces compatibility for that boundary.

### Layer 3: Enforce compatibility rules and version deliberately

Regardless of where the contract lives, the coupling is only removed if the contract has a **versioning discipline** that matches the deployment reality. The core rules, repeated across the sources, are:

- **Additive changes only for backward compatibility.** Adding an optional field is safe; removing a required field, renaming a field, or changing its type is a breaking change that requires a new major version.
- **Published events are immutable contracts.** Existing versions must never change; new changes require a new version, and the old version is kept as long as consumers exist.
- **Embed a schema version in the envelope** (header or metadata) so consumers can branch explicitly if they must handle multiple versions.
- **Enforce compatibility mechanically in CI.** Wire schema verification into the pipeline so a producer cannot merge a breaking change without the registry or package versioning catching it before deployment.

### The fix in one sentence

Replace the magic string + implicit shape with a **runtime schema that is imported or generated from a versioned contract artifact (shared package or schema registry) and validated on both publish and receive**, with a versioning policy that treats each event type as an immutable, independently evolvable contract.

This does not remove the dependency—publisher and subscriber must still agree on something—but it converts an invisible, stringly-typed agreement into an **explicit, executable, versioned contract** whose violations are caught at build time (by the package version or registry check) and at runtime (by the schema validator), rather than discovered in production from a silent deserialization failure.
