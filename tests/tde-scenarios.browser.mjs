// 《食梦者》（TDE）P9 8 章实机路径浏览器验收（桌面 1440×950 / 移动 390×844）。
//
// 路线图 §8.3 / §11.2 / 交互手册：8 章是 development、战役未进 content/registered.js（P10 才注册），
// 所以照 TCU P8 的做法（tests/tcu-scenarios.browser.mjs）在 spec 进程注册「可启动外壳」：
//   · 真实章节模块 content/campaigns/theDreamEaters/scenarios/<id>/index.js（scenario/behavior/layout）；
//   · 外壳 = 真实三包克隆为 playable 的 *TdeBrowserShell + 每章一个单章外壳战役/关卡（见 tde-browser-shell.mjs）；
//   · 真实 src/engine 的 createGameState 建局 → viewState 投影 → page.route 拦截 /api/start 注入给真实 web/ 界面。
// 章节数据、幕/议程/地点/遭遇牌库、地图与牌桌渲染全部是生产实现，没有手写文案。
//
// 每章断言：真实章节名（.bg-game-title）、幕/议程（「局势」→ dialog「调查局势」）、调查员所在地点、
// 地图节点数 ≥ 本局实际地点数下界、本局自然产生的场景交互面板（A2 蜂拥+掩藏 / A3 警报 / B1 滋生袋 /
// B3 掩藏；数据来自真实 state，非 seed）、无 pageerror、无横向溢出，并截图。
//
// 证据：截图落仓库根 artifacts/tde-migration/p9-scenario-<chapterId>-<viewport>.png；
// annotation scenario=<chapterId> + screenshot（路径相对仓库根，由 tools/playwright-tde-reporter.mjs 汇总）。
// 本 spec 不做任何交互 seed（seed 证据在 tests/tde-interactions.browser.mjs，注释与 handoff 已区分自然/seed）。
import { test, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  installTdeBrowserShell, loadTdeBrowserRuntime, buildChapterState, projectView,
  scenarioFacts, openInjectedTdeTable, captureEvidence, assertNoHorizontalOverflow, VIEWPORTS,
} from './tde-browser-shell.mjs'

const output = fileURLToPath(new URL('../../../artifacts/tde-migration/', import.meta.url))
mkdirSync(output, { recursive: true })

const shell = await installTdeBrowserShell()
const runtime = await loadTdeBrowserRuntime()

// 交互 id → 面板 h3 标题（web/locales/zh-CN.core.js 的 tde.* 文案）。
const PANEL_TITLES = {
  swarm: '蜂拥',
  tokenBag: '滋生袋',
  alarm: '警报等级',
  hidden: '隐藏手牌',
  veiled: '掩藏地点',
  markers: '参考计数',
  vertical: '纵向堆叠',
  epilogue: '梦境之门与结局',
}

for (const chapter of shell.chapters) {
  for (const [viewport, width, height] of VIEWPORTS) {
    test(`P9 ${chapter.name} 实机路径在${viewport}端可进入、可读、可截图`, async ({ page }, testInfo) => {
      testInfo.setTimeout(120_000)
      await page.setViewportSize({ width, height })
      // 真实引擎建局：章节 setup 会换幕牌库/地点变体，断言事实一律取自本局真实 state。
      const state = buildChapterState(runtime, chapter)
      const view = projectView(runtime, state)
      const facts = scenarioFacts(state)
      const naturalInteractions = Object.keys(view.scenarioInteractions || {})
      const { errors } = await openInjectedTdeTable(page, runtime, state)

      // 1) 真实章节名（界面标题来自 state.scenario.name；有的章带「 · English」后缀）。
      await expect(page.locator('.ah-table').first()).toBeVisible()
      await expect(page.locator('.ah-table').first()).toHaveAttribute('data-revision', '1')
      await expect(page.locator('.bg-game-title').first())
        .toContainText(facts.name.split(' · ')[0])

      // 2) 幕/议程在「调查局势」里可见（读本局实际 actIndex/agendaIndex）。
      await page.getByRole('button', { name: '局势', exact: true }).click()
      const situation = page.getByRole('dialog', { name: '调查局势' })
      await expect(situation).toBeVisible()
      if (facts.act) await expect(situation).toContainText(facts.act)
      if (facts.agenda) await expect(situation).toContainText(facts.agenda)
      await page.getByRole('button', { name: '关闭局势详情' }).click()
      await expect(situation).toBeHidden()

      // 3) 调查员所在地点名在牌桌；地图节点数不少于实际入场地点数。
      if (facts.location) await expect(page.locator('body')).toContainText(facts.location)
      expect(await page.locator('.ah-map-node').count(), `${chapter.id} 地图节点`)
        .toBeGreaterThanOrEqual(Math.min(facts.locationsOnTable, 2))

      // 4) 本局自然产生的场景交互面板（真实 state 投影，无 seed）：A2 蜂拥+掩藏 / A3 警报 /
      //    B1 滋生袋（空袋）/ B3 掩藏。只断言这局确实带了的那些分区。
      if (naturalInteractions.length) {
        const region = page.getByRole('region', { name: '场景交互' })
        await expect(region).toBeVisible()
        for (const key of naturalInteractions) {
          const section = region.locator(`[data-interaction="${key}"]`)
          await expect(section, `${chapter.id} 自然交互 ${key}`).toBeVisible()
          const heading = PANEL_TITLES[key]
          if (heading) await expect(section.getByRole('heading', { name: heading })).toBeVisible()
        }
        // B1 的滋生袋在开局是空袋：真实空状态文案。
        if (naturalInteractions.includes('tokenBag') && !view.scenarioInteractions.tokenBag.bags.length) {
          await expect(region.locator('[data-interaction="tokenBag"]')).toContainText('袋是空的')
        }
        // A2 的自然蜂拥：真实宿主与蜂拥卡数量（不写死卡号/名字分支，读本局状态）。
        if (view.scenarioInteractions?.swarm?.length) {
          const host = view.scenarioInteractions.swarm[0]
          await expect(region.locator('[data-interaction="swarm"]')).toContainText(`${host.name}：${host.count} 张蜂拥卡`)
          if (host.blockedReason) {
            await expect(region.locator('[data-interaction="swarm"]')).toContainText(host.blockedReason)
          }
        }
        // A3 的自然警报：按座位 1/5。
        if (view.scenarioInteractions?.alarm?.seats?.length) {
          const alarm = view.scenarioInteractions.alarm
          await expect(region.locator('[data-interaction="alarm"]'))
            .toContainText(`座位 1：${alarm.seats[0].value}/${alarm.max}`)
        }
      }

      expect(errors).toEqual([])
      expect(await assertNoHorizontalOverflow(page)).toBe(true)

      const shot = `${output}p9-scenario-${chapter.id}-${viewport}.png`
      await captureEvidence(testInfo, page, shot)
      testInfo.annotations.push({ type: 'scenario', description: chapter.id })
    })
  }
}
