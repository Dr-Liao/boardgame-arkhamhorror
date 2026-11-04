// Playwright 报告器：TIC 浏览器验收账本 `audit/tic-browser-acceptance.json` 的唯一写者。
//
// 两类证据合并在同一份账本里：
//  1) 语言/视口覆盖（coverage）与「卡文直达」链接（links）：沿用标题判据，主来源是
//     `tests/tic-rules.browser.mjs`（标题含 `${viewport} ${lang}` / `${viewport} 卡文`）。
//  2) **逐章实机路径**（scenarios）：`tests/tic-chapters-acceptance.browser.mjs` 的每条用例带
//     annotation `scenario=<chapterId>` / `viewport=desktop|mobile` / `screenshot=<绝对路径>`；
//     本报告器按章节归集「该章 desktop 与 mobile 均有 passed 用例且截图真实存在」。
//     `tools/audit-tic-scenarios.mjs#browserEvidenceFor` 只读 `tests[].scenario` + `tests[].viewport`
//     + `status`，因此 tests[] 里必须带这两个字段（此前缺失导致 8 章 browserAcceptance 恒 false）。
//
// 证据命令（一次跑齐；缺 spec 时仍会写出账本，但 status=failed，不伪造完成）：
//   node ../../node_modules/@playwright/test/cli.js test --config tests/playwright/playwright.tic.config.mjs
import { existsSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { WORKSPACE, MOD, writeJson, sha } from './tic-migration-lib.mjs'
import { evidenceHashes } from './tic-evidence.mjs'

// 与 content/campaigns/theInnsmouthConspiracy/shared.js#chapters 的 8 章一致（顺序同章序）。
const TIC_CHAPTERS = ['thePitOfDespair', 'theVanishingOfElinaHarper', 'inTooDeep', 'devilReef',
  'horrorInHighGear', 'aLightInTheFog', 'theLairOfDagon', 'intoTheMaelstrom']
const annotationValue = (annotations, type) =>
  (annotations || []).find(item => item.type === type && item.description)?.description || null

export default class Reporter {
  onBegin() { this.entries = []; this.before = evidenceHashes() }
  onTestEnd(test, result) {
    const screenshots = test.annotations.filter(item => item.type === 'screenshot').map(item => ({
      path: relative(WORKSPACE, item.description).replaceAll('\\', '/'),
      sha256: sha(readFileSync(item.description)),
      exists: existsSync(item.description),
    }))
    const viewport = annotationValue(test.annotations, 'viewport')
      || (/mobile/.test(test.title) ? 'mobile' : 'desktop')
    this.entries.push({
      title: test.title,
      scenario: annotationValue(test.annotations, 'scenario'),
      viewport,
      status: result.status,
      screenshots,
    })
  }
  onEnd(result) {
    const sourceFiles = evidenceHashes()
    const stable = JSON.stringify(sourceFiles) === JSON.stringify(this.before)
    const coverage = Object.fromEntries(['desktop', 'mobile'].flatMap(view => ['zh-CN', 'en'].map(lang => [view + ':' + lang,
      this.entries.some(test => test.status === 'passed' && test.title.includes(`${view} ${lang}`) && test.screenshots.length)])))
    const links = Object.fromEntries(['desktop', 'mobile'].map(view => [view,
      this.entries.some(test => test.status === 'passed' && test.title.includes(`${view} 卡文`))]))
    // 逐章实机路径：每章 desktop/mobile 各至少一条 passed 用例，且该视口截图真实存在。
    const liveShots = viewport => this.entries
      .filter(test => test.viewport === viewport)
      .flatMap(test => test.screenshots.filter(shot => shot.exists).map(shot => ({ ...shot, test })))
    const scenarios = TIC_CHAPTERS.map(scenario => {
      const passedOf = viewport => this.entries.some(test => test.scenario === scenario
        && test.viewport === viewport && test.status === 'passed' && test.screenshots.length > 0)
      const shotsOf = viewport => liveShots(viewport).filter(shot => shot.test.scenario === scenario)
      const desktop = passedOf('desktop') && shotsOf('desktop').length > 0
      const mobile = passedOf('mobile') && shotsOf('mobile').length > 0
      return { scenario, desktop, mobile, ok: desktop && mobile,
        screenshots: [...shotsOf('desktop'), ...shotsOf('mobile')].map(shot => shot.path) }
    })
    const scenariosComplete = scenarios.length === TIC_CHAPTERS.length && scenarios.every(entry => entry.ok)
    const status = result.status === 'passed' && stable && Object.values(coverage).every(Boolean)
      && Object.values(links).every(Boolean) && scenariosComplete ? 'passed' : 'failed'
    writeJson(MOD + '/audit/tic-browser-acceptance.json', {
      schemaVersion: 2,
      generatedBy: 'playwright + tools/playwright-tic-reporter.mjs',
      evidenceCommand: 'node ../../node_modules/@playwright/test/cli.js test --config tests/playwright/playwright.tic.config.mjs',
      status,
      sourceStableDuringRun: stable,
      coverage,
      links,
      scenarios,
      scenariosComplete,
      chapterCount: TIC_CHAPTERS.length,
      tests: this.entries.map(({ screenshots, ...test }) => ({ ...test, screenshots: screenshots.map(({ path, sha256 }) => ({ path, sha256 })) })),
      screenshots: this.entries.flatMap(test => test.screenshots.map(shot => ({
        path: shot.path, sha256: shot.sha256, exists: shot.exists,
        scenario: test.scenario, viewport: test.viewport, title: test.title,
      }))),
      sourceFiles,
    })
  }
}
