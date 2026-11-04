// late 卡逐章验收套件的真实章节夹具（w1）。
//
// `tests/tic-scenarios-late.test.mjs` 顶部契约：
//   lateFixture(scenarioId, count = 1, campaignOptions = {}) returns a settled
//   production game state, applying memoriesRecovered/records BEFORE real setup.
//
// 本文件的实现直接复用 `tests/tic-chapter-fixture.mjs#chapterFixture`：
// 它注册 development 章节 → 写入 campaign.records / memoriesRecovered / investigatorRecords
// → 再走真实的 startScenario 设置流程并清空 pendingChoice。因此 `campaignOptions` 的
// `records` / `memoriesRecovered` / `investigatorRecords` 在真实设置前生效。
//
// 运行（不登记 suites/node-suite，由主进程决定）：
//   node --test tests/tic-scenarios-late-registered.test.mjs
import { chapterFixture } from './tic-chapter-fixture.mjs'

export function lateFixture(scenarioId, count = 1, campaignOptions = {}) {
  return chapterFixture(scenarioId, count, campaignOptions)
}

export default lateFixture
