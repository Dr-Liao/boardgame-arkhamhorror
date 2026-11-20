// 旧存档的纯标签用数组。与具名计数器共存时，标签保存在同一对象的 labels 下。
export function markerLabelsOf(card) {
  const markers = card?.markers
  if (Array.isArray(markers)) return markers
  return Array.isArray(markers?.labels) ? markers.labels : []
}

export function setMarkerLabels(card, labels) {
  if (!card.markers || Array.isArray(card.markers)) card.markers = labels
  else if (labels.length) card.markers.labels = labels
  else delete card.markers.labels
}

export function addMarkerLabel(card, label) {
  const labels = [...markerLabelsOf(card), label]
  setMarkerLabels(card, labels)
  return labels.length
}

export function removeMarkerLabel(card, label) {
  const labels = markerLabelsOf(card)
  const index = labels.indexOf(label)
  if (index < 0) return labels.length
  setMarkerLabels(card, labels.toSpliced(index, 1))
  return labels.length - 1
}
