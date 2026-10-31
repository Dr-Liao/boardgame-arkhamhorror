// 诡镇奇谈 · 调试控制台浮层（契约：artifacts/debug-console/CONTRACT.md §7）
//
// 入口是 ` / ~ 键（标题栏不再放按钮），局外枢纽和局内牌桌都能呼出：单机本机玩家可用；联机只有房主能打开
// （客人按键无效果，服务端另有硬拒绝）。浏览器只负责输入与展示：指令文本、名称匹配、目标座位校验与状态修改全部在服务端
// 完成；成功后把返回的权威 session 交回大厅，失败把 error.message 记进结果日志。
//
// 宿主注入 h/t/api/render/state；本文件不 import 其它模块，保证 web/ 挂载目录内自包含。
// 所有用户可见文案都走 debug.* 词典 key（词典片段：web/locales/zh-CN.gameui.js + en.gameui.js）。

const LOG_LIMIT = 20
// 服务端解析器的英文别名：web/ 里不写中文指令字面量。
const HELP_COMMAND = 'help'
// 自动帮助遇到用户正在提交时稍后再试：不和普通指令抢大厅的 busy 通道。
const AUTO_HELP_RETRY_MS = 300

export function createDebugConsole({ h, t, api, render, state }) {
  let opened = false
  let sessionId = null
  let busy = false
  let log = []
  let logSeq = 0
  let helpText = ''
  // 帮助是只读指令（move:null），不锁全局 busy；helpPending 只用于去重自动/手动请求。
  let helpPending = null
  let helpSeq = 0
  let autoHelpTimer = null
  let autoHelpSessionId = null
  let targetSeat = null
  let optionKey = ''
  // render() 每次牌桌重绘都会被调用；只有日志内容变了才重建 DOM，避免频繁 replaceChildren。
  let paintedLogSeq = -1

  // 联机：连接中且自己是房主；单机（没有 state.online.room）：本机可用。
  function canUse(session) {
    if (!session) return false
    const online = state.online
    if (!online?.room) return true
    if (!online.connected) return false
    const me = (online.room.members || []).find(member => member.id === online.memberId)
    return me?.host === true
  }

  function availableSeats(session) {
    const list = session?.state?.investigators
    return Array.isArray(list) ? list.filter(inv => inv && Number.isInteger(inv.seat)) : []
  }

  function defaultSeat(session, list) {
    const preferred = Number.isInteger(session?.mySeat) ? session.mySeat
      : Number.isInteger(session?.observerSeat) ? session.observerSeat : null
    if (list.some(inv => inv.seat === preferred)) return preferred
    return list.length ? list[0].seat : null
  }

  function seatName(inv) {
    return inv.name || t('debug.seat', { number: inv.seat + 1 })
  }

  // -------------------------------------------------------------------------
  // 常驻 DOM：面板与输入节点只建一次，牌桌重绘时复用（输入框不会丢失正在输入的内容）。
  // -------------------------------------------------------------------------
  const titleNode = h('h2', { className: 'ah-debug-title' })
  const hintNode = h('p', { className: 'ah-debug-hint' })
  const closeText = h('span', { className: 'ah-debug-close-text' })
  const closeButton = h('button', { type: 'button', className: 'ah-debug-close', onclick: () => close() },
    h('span', { className: 'ah-debug-close-icon', 'aria-hidden': 'true' }, '×'), closeText)
  const head = h('header', { className: 'ah-debug-head' },
    h('div', { className: 'ah-debug-heading' }, titleNode, hintNode), closeButton)

  const targetLabel = h('span', { className: 'ah-debug-field-label' })
  const targetSelect = h('select', { className: 'ah-debug-select', onchange: () => {
    const value = Number(targetSelect.value)
    targetSeat = Number.isInteger(value) ? value : null
  } })
  const targetField = h('label', { className: 'ah-debug-field' }, targetLabel, targetSelect)

  const inputLabel = h('span', { className: 'ah-debug-field-label' })
  const input = h('input', {
    type: 'text',
    className: 'ah-debug-input',
    autocomplete: 'off',
    spellcheck: 'false',
    onkeydown: event => {
      // Enter 直接提交；输入法组合中的回车交给输入法。
      if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); submit() }
    },
  })
  const commandField = h('label', { className: 'ah-debug-field ah-debug-command' }, inputLabel, input)

  const runButton = h('button', { type: 'button', className: 'bg-btn ah-debug-run', onclick: () => submit() })
  // 帮助显眼入口：点击等价提交 `help`（只读，服务端回复 move:null 的帮助文本）。
  const helpButton = h('button', {
    type: 'button',
    className: 'bg-btn secondary ah-debug-help-button',
    onclick: () => showHelp(),
  })
  const actionRow = h('div', { className: 'ah-debug-actions' }, runButton, helpButton)

  const helpTitle = h('h3', { className: 'ah-debug-section-title' })
  const helpExamples = h('pre', { className: 'ah-debug-help-examples' })
  const helpServer = h('pre', { className: 'ah-debug-help-server' })
  const helpSection = h('section', { className: 'ah-debug-help' }, helpTitle, helpExamples, helpServer)

  const logTitle = h('h3', { className: 'ah-debug-section-title' })
  const logList = h('div', { className: 'ah-debug-log', role: 'log', 'aria-live': 'polite' })
  const logEmpty = h('p', { className: 'ah-debug-empty' })
  const logSection = h('section', { className: 'ah-debug-log-section' }, logTitle, logList, logEmpty)

  const body = h('div', { className: 'ah-debug-body' },
    targetField, commandField, actionRow, helpSection, logSection)
  const panel = h('section', {
    className: 'ah-debug-panel',
    role: 'dialog',
    'aria-modal': 'true',
    tabindex: '-1',
    onkeydown: event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      close()
    },
  }, head, body)
  const root = h('div', {
    className: 'bg-backdrop ah-debug-backdrop',
    hidden: true,
    onclick: event => { if (event.target === root) close() },
  }, panel)

  // -------------------------------------------------------------------------
  // 静态文案：每次渲染都重新取词，切语言后无需重建节点。
  // -------------------------------------------------------------------------
  function applyText() {
    panel.setAttribute('aria-label', t('debug.aria'))
    titleNode.textContent = t('debug.title')
    hintNode.textContent = state.online?.room ? t('debug.hostOnly') : t('debug.localHint')
    closeButton.setAttribute('aria-label', t('debug.closeAria'))
    closeButton.title = t('debug.closeAria')
    closeText.textContent = t('debug.close')
    targetLabel.textContent = t('debug.target')
    targetSelect.setAttribute('aria-label', t('debug.target'))
    inputLabel.textContent = t('debug.inputLabel')
    input.setAttribute('aria-label', t('debug.inputLabel'))
    input.placeholder = t('debug.inputPlaceholder')
    runButton.textContent = busy ? t('debug.busy') : t('debug.run')
    helpButton.textContent = t('debug.helpButton')
    helpButton.setAttribute('aria-label', t('debug.helpButton'))
    helpButton.title = t('debug.helpButton')
    helpTitle.textContent = t('debug.help')
    helpExamples.textContent = t('debug.helpExamples')
    helpServer.textContent = helpText
    helpServer.hidden = !helpText
    logTitle.textContent = t('debug.logTitle')
    logList.setAttribute('aria-label', t('debug.logTitle'))
    logEmpty.textContent = t('debug.empty')
  }

  // 目标调查员下拉：座位列表变化才重建；用户已选座位在列表里就保留。
  function syncTargets(session) {
    const list = availableSeats(session)
    const key = session.sessionId + '|' + list.map(inv => inv.seat + ':' + (inv.name || '')).join(',')
    if (key !== optionKey) {
      optionKey = key
      targetSelect.replaceChildren(...list.map(inv => h('option', { value: String(inv.seat) }, seatName(inv))))
      if (!list.some(inv => inv.seat === targetSeat)) targetSeat = defaultSeat(session, list)
    }
    targetField.hidden = !list.length
    targetSelect.disabled = busy || !list.length
    if (list.some(inv => inv.seat === targetSeat)) targetSelect.value = String(targetSeat)
  }

  function renderLog() {
    if (paintedLogSeq === logSeq) return
    paintedLogSeq = logSeq
    logList.replaceChildren(...log.map(entry => h('p', {
      className: 'ah-debug-log-entry is-' + entry.tone,
      'data-tone': entry.tone,
    },
    h('span', { className: 'ah-debug-log-tone', 'aria-hidden': 'true' }, entry.tone === 'error' ? '✗' : '✓'),
    h('span', { className: 'ah-debug-log-text' }, entry.message))))
    logList.hidden = !log.length
    logEmpty.hidden = !!log.length
    if (log.length) logList.scrollTop = logList.scrollHeight
  }

  function pushLog(tone, message) {
    logSeq++
    const fallback = tone === 'error' ? t('debug.logFail') : t('debug.logOk')
    const text = String(message == null ? '' : message).trim() || fallback
    log.push({ tone, message: text })
    if (log.length > LOG_LIMIT) log.splice(0, log.length - LOG_LIMIT)
  }

  function update() {
    if (!opened) return null
    const session = state.session
    if (!session || session.sessionId !== sessionId || !canUse(session)) {
      opened = false
      return null
    }
    applyText()
    syncTargets(session)
    runButton.disabled = busy
    runButton.setAttribute('aria-busy', String(busy))
    // 帮助只读：提交普通指令或帮助请求进行中时禁用帮助按钮，避免大厅 busy 通道互相打断。
    helpButton.disabled = busy || !!helpPending
    input.disabled = busy
    panel.classList.toggle('is-busy', busy)
    renderLog()
    root.hidden = false
    // 牌桌重绘会把常驻节点重新挂到新的容器里，焦点与光标位置要补回来。
    const focused = root.contains(document.activeElement) ? document.activeElement : null
    if (focused) {
      const selection = typeof focused.selectionStart === 'number'
        ? [focused.selectionStart, focused.selectionEnd] : null
      queueMicrotask(() => {
        if (!root.isConnected) return
        focused.focus({ preventScroll: true })
        if (selection && typeof focused.setSelectionRange === 'function') {
          focused.setSelectionRange(selection[0], selection[1])
        }
      })
    }
    return root
  }

  // -------------------------------------------------------------------------
  // 帮助（只读）：服务端 `help` 返回 move:null 的文本。自动请求每个 session 一次、失败静默；
  // 手动点「帮助」时总会给出日志反馈，与进行中的自动请求合并，不重复提交。
  // -------------------------------------------------------------------------
  function clearAutoHelpTimer() {
    if (autoHelpTimer == null) return
    clearTimeout(autoHelpTimer)
    autoHelpTimer = null
  }

  function requestHelp({ logResult = false } = {}) {
    if (helpPending) return helpPending
    const session = state.session
    if (!session || session.sessionId !== sessionId || !canUse(session)) return Promise.resolve()
    const submitted = session
    const seq = ++helpSeq
    const request = (async () => {
      try {
        const result = await api('POST', '/debug', {
          sessionId: submitted.sessionId,
          revision: submitted.state.revision,
          command: { text: HELP_COMMAND },
        })
        if (seq !== helpSeq || sessionId !== submitted.sessionId) return
        const message = typeof result?.debug?.message === 'string' ? result.debug.message : ''
        if (message) helpText = message
        if (logResult) pushLog('success', message || t('debug.help'))
      } catch (error) {
        if (seq !== helpSeq || sessionId !== submitted.sessionId) return
        if (logResult) pushLog('error', error?.message || error || t('debug.logFail'))
      } finally {
        if (seq === helpSeq) {
          helpPending = null
          update()
          if (opened) render()
        }
      }
    })()
    helpPending = request
    return request
  }

  async function showHelp() {
    if (!opened || busy) return
    // 与打开面板时的自动请求合并：等它回来直接展示，不再多发一次。
    if (helpPending) {
      await helpPending
      if (!opened) return
      const current = state.session
      if (!current || current.sessionId !== sessionId) return
      if (!helpText) { requestHelp({ logResult: true }); return }
      pushLog('success', helpText)
      update()
      render()
      return
    }
    requestHelp({ logResult: true })
  }

  // 打开面板后自动拉一次帮助（每个 session 一次）：不锁输入、失败静默、不跟手动请求重复。
  function requestAutoHelp() {
    if (!opened || helpText || helpPending) return
    // 用户正在提交普通指令：等 idle 再请求，避免两个请求同时占住大厅 busy 通道。
    if (busy) {
      clearAutoHelpTimer()
      autoHelpTimer = setTimeout(requestAutoHelp, AUTO_HELP_RETRY_MS)
      return
    }
    requestHelp()
  }

  function scheduleAutoHelp() {
    if (!opened || autoHelpSessionId === sessionId) return
    autoHelpSessionId = sessionId
    clearAutoHelpTimer()
    requestAutoHelp()
  }

  // 新对局 / 换局时清空上一次的日志与帮助，避免跨局串台。
  function resetForSession(nextId) {
    sessionId = nextId
    log = []
    logSeq = 0
    paintedLogSeq = -1
    helpText = ''
    clearAutoHelpTimer()
    autoHelpSessionId = null
    helpSeq++
    helpPending = null
    targetSeat = null
    optionKey = ''
    input.value = ''
    busy = false
  }

  function open(session) {
    const target = session || state.session
    if (!canUse(target)) return
    if (target.sessionId !== sessionId) resetForSession(target.sessionId)
    opened = true
    if (!Number.isInteger(targetSeat)) targetSeat = defaultSeat(target, availableSeats(target))
    render()
    queueMicrotask(() => { if (opened) input.focus({ preventScroll: true }) })
    scheduleAutoHelp()
  }

  function close(options = {}) {
    if (!opened) return
    opened = false
    clearAutoHelpTimer()
    if (options.render !== false) render()
  }

  // ` / ~（物理键 Backquote，中文键盘上常标成 · / ~）。输入框里不拦截，避免把字符吃掉。
  function onHotkey(event) {
    if (event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return
    if (event.code !== 'Backquote' && event.key !== '`' && event.key !== '~' && event.key !== '·') return
    const target = event.target
    const tag = target?.tagName
    const editable = target?.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
    // 控制台自己的输入框里，这个键用来关闭，不把字符打进去；别的输入框照常打字。
    if (editable && !(opened && root.contains(target))) return
    const session = state.session
    // 局外（战役枢纽、调查准备、幕间）和局内都可以开。只有本地单人或联机房主能用。
    if (state.view !== 'game' || session?.modId !== 'arkhamhorror') return
    if (!canUse(session)) return
    event.preventDefault()
    if (opened) close()
    else open(session)
  }
  if (typeof window !== 'undefined') window.addEventListener('keydown', onHotkey)

  // 提交期间可能换局（重连/返回大厅）或收到更新的快照：只接受同一对局且不更旧的权威 session，
  // 避免把用户已经切走的旧结果盖回当前界面。
  function applyAuthority(session, submitted) {
    if (!session) return
    const current = state.session
    if (!current) return
    const switchedSession = current.sessionId !== submitted.sessionId
    const newerSnapshot = current.sessionId === session.sessionId
      && Number.isSafeInteger(current.state?.revision) && Number.isSafeInteger(session.state?.revision)
      && current.state.revision > session.state.revision
    if (!switchedSession && !newerSnapshot) state.session = session
  }

  async function submit() {
    if (busy || !opened) return
    const session = state.session
    if (!session || session.sessionId !== sessionId || !canUse(session)) return
    const text = String(input.value || '').trim()
    if (!text) { input.focus({ preventScroll: true }); return }
    const command = { text }
    if (Number.isInteger(targetSeat)) command.targetSeat = targetSeat
    const submitted = session
    busy = true
    input.value = ''
    update()
    // 打开面板时的自动帮助可能还在飞：先等它落地（只读、不推进 revision），
    // 否则两个请求会同时占住大厅 busy 通道，普通指令可能被 SESSION_BUSY 拒绝。
    let target = submitted
    if (helpPending) {
      await helpPending.catch(() => {})
      if (!opened) { busy = false; update(); return }
      const current = state.session
      if (!current || current.sessionId !== submitted.sessionId) { busy = false; update(); render(); return }
      target = current
    }
    try {
      const result = await api('POST', '/debug', {
        sessionId: target.sessionId,
        revision: target.state.revision,
        command,
      })
      applyAuthority(result?.session, submitted)
      const message = typeof result?.debug?.message === 'string' ? result.debug.message : ''
      // move === null 表示帮助类指令：服务端只回文本、不提交、不改 revision。
      if (result?.debug?.move == null) {
        if (message) helpText = message
        pushLog('success', message || t('debug.help'))
      } else {
        pushLog('success', message || t('debug.logOk'))
      }
    } catch (error) {
      pushLog('error', error?.message || error || t('debug.logFail'))
    } finally {
      busy = false
      update()
      render()
      queueMicrotask(() => { if (opened) input.focus({ preventScroll: true }) })
    }
  }

  return {
    get opened() { return opened },
    canUse,
    open,
    close,
    render: update,
  }
}
