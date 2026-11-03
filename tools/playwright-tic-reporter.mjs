import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { WORKSPACE, MOD, writeJson, sha } from './tic-migration-lib.mjs'
import { evidenceHashes } from './tic-evidence.mjs'
export default class Reporter {
  onBegin() { this.tests = []; this.before = evidenceHashes() }
  onTestEnd(test, result) {
    this.tests.push({ title: test.title, status: result.status,
      screenshots: test.annotations.filter(item => item.type === 'screenshot').map(item => ({
        path: relative(WORKSPACE, item.description).replaceAll('\\', '/'), sha256: sha(readFileSync(item.description)),
      })) })
  }
  onEnd(result) {
    const sourceFiles = evidenceHashes()
    const stable = JSON.stringify(sourceFiles) === JSON.stringify(this.before)
    const coverage = Object.fromEntries(['desktop', 'mobile'].flatMap(view => ['zh-CN', 'en'].map(lang => [view + ':' + lang,
      this.tests.some(test => test.status === 'passed' && test.title.includes(`${view} ${lang}`) && test.screenshots.length)])))
    const links = Object.fromEntries(['desktop', 'mobile'].map(view => [view, this.tests.some(test => test.status === 'passed' && test.title.includes(`${view} 卡文`))]))
    writeJson(MOD + '/audit/tic-browser-acceptance.json', { schemaVersion: 1, generatedBy: 'playwright + tools/playwright-tic-reporter.mjs',
      status: result.status === 'passed' && stable && Object.values(coverage).every(Boolean) && Object.values(links).every(Boolean) ? 'passed' : 'failed',
      sourceStableDuringRun: stable, coverage, links, tests: this.tests, sourceFiles })
  }
}
