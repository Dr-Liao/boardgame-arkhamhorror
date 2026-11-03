import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { MOD, WORKSPACE, writeJson, json, sha } from './tic-migration-lib.mjs'
import { evidenceHashes } from './tic-evidence.mjs'
export default class Reporter {
  onBegin() { this.before = evidenceHashes(); this.tests = [] }
  onTestEnd(test, result) {
    this.tests.push({ file: relative(MOD, test.location.file).replaceAll('\\', '/'), title: test.title, status: result.status,
      screenshots: test.annotations.filter(item => item.type === 'screenshot').map(item => ({
        path: relative(WORKSPACE, item.description).replaceAll('\\', '/'), sha256: sha(readFileSync(item.description)),
      })) })
  }
  onEnd(result) {
    const sourceFiles = evidenceHashes(), stable = json(sourceFiles) === json(this.before)
    writeJson(MOD + '/audit/tic-interactions-browser.json', { schemaVersion: 1,
      generatedBy: 'Playwright + tools/playwright-tic-p4-reporter.mjs',
      status: result.status === 'passed' && stable ? 'passed' : 'failed', sourceStableDuringRun: stable, tests: this.tests, sourceFiles })
  }
}
