/**
 * @tsfullstack/visual-test 入口
 */
export type {
  Scenario,
  ScenarioResult,
  ScenarioStatus,
  RunConfig,
  RunReport,
  Manifest,
  ManifestEntry,
  TestEnv,
} from "./types";

export { runTests, approveScenario, rejectScenario } from "./runner";
export { startServer } from "./server";
export { serializeDom, diffDomJson } from "./dom-serializer";
export type { VisualTestAPI } from "./api";
