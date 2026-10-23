#!/usr/bin/env node
// 文档链接体检：只查本地相对链接能不能落到真实文件/目录，不查外网。
//
// 用法：
//   node tools/check-doc-links.mjs            列出所有失效链接并以非零退出
//   node tools/check-doc-links.mjs --json     机器可读输出
//
// 口径：
// - 扫描 README/ARCHITECTURE/AGENTS/docs/**/audit/*.md/web/**/*.md；跳过 node_modules、
//   参考资源、artifacts（生成物）与 test-results；
// - 忽略 http(s)/mailto、纯锚点、绝对路径（浏览器根）与代码块里的示例链接；
// - 目标路径按「链接所在文件」解析，允许指向目录；带 #锚点或 ?query 时只校验文件部分。

import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = new URL('../', import.meta.url)
const ROOT_PATH = fileURLToPath(ROOT)
const SKIP_DIRS = ['node_modules', '参考资源', 'artifacts', 'test-results', 'playwright-report', '.git', '.tmp-dsh-home']
const SKIP_FILES = new Set([])

async function collectMarkdown(dirUrl, relative = '') {
  const out = []
  for (const entry of await readdir(dirUrl, { withFileTypes: true })) {
    const path = relative ? `${relative}/${entry.name}` : entry.name
    if (entry.isDirectory()) {
      if (SKIP_DIRS.includes(entry.name)) continue
      out.push(...await collectMarkdown(new URL(`${entry.name}/`, dirUrl), path))
    } else if (entry.isFile() && entry.name.endsWith('.md') && !SKIP_FILES.has(path)) {
      out.push(path)
    }
  }
  return out
}

// 链接语法：[text](target) / [id]: target；跳过 ``` 代码块与 `inline code`。
function linksIn(source) {
  const lines = source.split(/\r?\n/)
  const links = []
  let inFence = false
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    if (/^\s*(```|~~~)/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue
    const withoutInline = line.replace(/`[^`]*`/g, '')
    const inline = /(!?)\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
    let match
    while ((match = inline.exec(withoutInline))) links.push({ line: index + 1, target: match[2] })
    const reference = /^\s*\[[^\]]+\]:\s*(\S+)/.exec(withoutInline)
    if (reference) links.push({ line: index + 1, target: reference[1] })
  }
  return links
}

const skipTarget = target => /^(https?:|mailto:|tel:)/i.test(target)
  || target.startsWith('#')
  || target.startsWith('/')
  || target.startsWith('<')
  || target === ''

const files = (await collectMarkdown(ROOT)).sort()
const broken = []
let checked = 0
for (const file of files) {
  const source = await readFile(new URL(file, ROOT), 'utf8')
  for (const { line, target } of linksIn(source)) {
    if (skipTarget(target)) continue
    checked++
    const withoutAnchor = target.split('#')[0].split('?')[0]
    if (!withoutAnchor) continue
    const decoded = decodeURIComponent(withoutAnchor)
    const resolved = resolve(dirname(resolve(ROOT_PATH, file)), decoded)
    let ok = false
    try { ok = (await stat(resolved)).isFile() || (await stat(resolved)).isDirectory() } catch { ok = false }
    if (!ok) broken.push({ file, line, target })
  }
}

if (process.argv[2] === '--json') {
  console.log(JSON.stringify({ files: files.length, links: checked, broken }, null, 2))
} else if (broken.length) {
  console.error(`文档链接体检：${broken.length} 条失效（共检查 ${checked} 条）`)
  for (const item of broken) console.error(`  ${item.file}:${item.line} -> ${item.target}`)
} else {
  console.log(`文档链接体检：${files.length} 个文件、${checked} 条本地链接全部可解析`)
}

if (broken.length) process.exitCode = 1
