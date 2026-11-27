export function createTimedCardViewer({ api, onRefresh }) {
  let current = null
  let sending = Promise.resolve()

  function send(view, viewing) {
    const { session, enemyId, viewId, seat } = view
    const notify = () => {
      if (viewing && current !== view) return null
      return api('POST', '/card-view', { sessionId: session.sessionId, seat, enemyId, viewId, viewing })
    }
    const result = sending.then(notify).catch(() => null)
    sending = result
    return result
  }

  function stop() {
    if (!current) return
    const view = current
    current = null
    clearInterval(view.heartbeat)
    clearTimeout(view.deadlineReport)
    void send(view, false)
  }

  function sync(session, seat, enemy) {
    const tracked = enemy?.viewDurationMs > 0 && session
    if (tracked && current?.session.sessionId === session.sessionId && current.enemyId === enemy.id && current.seat === seat) return
    stop()
    if (!tracked) return
    const view = { session, seat, enemyId: enemy.id, viewId: crypto.randomUUID(), pending: false, deadline: null }
    current = view
    const renew = async () => {
      if (current !== view || view.pending) return
      view.pending = true
      try {
        const result = await send(view, true)
        if (current !== view) return
        if (view.deadline == null && Number.isFinite(result?.durationMs)) {
          view.deadline = performance.now() + result.durationMs
          view.deadlineReport = setTimeout(renew, Math.ceil(result.durationMs) + 1)
        }
        // Online play already receives the host's authoritative snapshot. A
        // local card detail has no polling loop of its own.
        if (!session.online && (result?.durationMs === undefined || performance.now() > view.deadline)) {
          const response = await api('GET', '/session?sessionId=' + encodeURIComponent(session.sessionId)).catch(() => null)
          if (current === view && response?.session) onRefresh(response.session)
        }
      } finally { view.pending = false }
    }
    void renew()
    view.heartbeat = setInterval(renew, 1800)
  }

  return { sync, stop }
}
