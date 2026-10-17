import { mediaSrc } from '../api/http'

export function Avatar({ url, label }: { url?: string | null; label: string }) {
  const src = mediaSrc(url)
  if (src) return <img className="avatar" src={src} alt="" />
  const letter = label.trim().charAt(0).toUpperCase() || '?'
  return <span className="avatar placeholder" aria-hidden="true">{letter}</span>
}

export function Logo({ url }: { url?: string | null }) {
  const src = mediaSrc(url)
  if (!src) return null
  return <img className="logo" src={src} alt="" />
}
