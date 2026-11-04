// 启用 late 卡逐章 pending 验收套件（w1）。
//
// 背景：`tests/tic-scenarios-late.test.mjs` 底部只自动注册「ready」测试（registerLateTests，
// 已在 suites.mjs / node-suite.mjs 登记）；`registerPendingLateTests` 需要主进程在 Flashback12/13、
// 原子钥匙/团队费用、地点附属能力、下个补给窗口等依赖落地后再调用。
//
// 本文件是该套件的**唯一注册入口**：
//   · import 该文件时，其底部 `registerLateTests(chapterFixture)` 会照常注册 ready 测试；
//   · 这里再调用一次 `registerPendingLateTests(lateFixture)`，把 pending 测试全部注册进本进程。
// 同一文件只注册一次，避免与其它测试文件重复注册。
//
// 运行：
//   node --test tests/tic-scenarios-late-registered.test.mjs
// 矩阵产出（w1）：
//   artifacts/migration/tic/p7/workers/w1/late-acceptance-matrix.md
import { registerPendingLateTests } from './tic-scenarios-late.test.mjs'
import { lateFixture } from './tic-late-fixture.mjs'

registerPendingLateTests(lateFixture)
