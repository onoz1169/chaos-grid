export function fileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function extColor(ext: string): string {
  const map: Record<string, string> = {
    ts: '#4488ff', tsx: '#4488ff', js: '#ffcc00', jsx: '#ffcc00',
    py: '#4488bb', rs: '#bb4444', go: '#44bbbb',
    md: '#aaaaaa', json: '#bb8844', yaml: '#bb8844', yml: '#bb8844',
    css: '#bb44bb', html: '#bb6644', sh: '#44bb88', txt: '#888888',
  }
  return map[ext] ?? '#666'
}

export function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / 1_048_576).toFixed(1)}M`
}
