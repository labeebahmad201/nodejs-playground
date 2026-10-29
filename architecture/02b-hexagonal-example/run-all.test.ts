// Run every nuance with:
//   node --test architecture/02b-hexagonal-example/run-all.test.ts
// Each file registers its own node:test cases.
import "./nuances/00-end-to-end.ts";
import "./nuances/01-inside-outside.ts";
import "./nuances/02-driving-vs-driven.ts";
import "./nuances/03-port-is-not-an-interface.ts";
import "./nuances/04-call-vs-dependency-direction.ts";
import "./nuances/05-what-crosses-the-port.ts";
import "./nuances/06-name-the-port-for-the-need.ts";
import "./nuances/07-domain-port-vs-read-port.ts";
import "./nuances/08-dont-mirror-the-vendor.ts";
import "./nuances/09-error-contract.ts";
import "./nuances/10-port-granularity.ts";
import "./nuances/11-input-port-shape.ts";
import "./nuances/12-composition-root.ts";
import "./nuances/13-transaction-ownership.ts";
import "./nuances/14-external-call-outside-transaction.ts";
import "./nuances/15-idempotency-at-the-port.ts";
import "./nuances/16-clock-and-id-ports.ts";
import "./nuances/17-two-way-mapping.ts";
import "./nuances/18-mapping-loss.ts";
import "./nuances/19-persistence-model-leak.ts";
import "./nuances/20-mapper-placement.ts";
import "./nuances/21-core-test-with-fakes.ts";
import "./nuances/22-fake-fidelity.ts";
import "./nuances/23-adapter-test-in-isolation.ts";
import "./nuances/24-contract-suite.ts";
import "./nuances/25-module-enforcement.ts";
import "./nuances/26-one-giant-hexagon.ts";
import "./nuances/27-migrating-incrementally.ts";
import "./nuances/28-when-to-remove-a-port.ts";
import "./nuances/29-cost-of-module-split.ts";
import "./nuances/30-framework-at-the-edge.ts";
import "./nuances/31-where-the-services-live.ts";
import "./nuances/appendix-vocabulary.ts";
