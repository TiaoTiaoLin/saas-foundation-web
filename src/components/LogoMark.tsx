export function LogoMark({ className = 'brand-mark' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#f3efe6" />
      <rect x="4.5" y="20.8" width="23" height="6" rx="1.4" fill="#143028" />
      <rect x="8" y="14.2" width="16" height="7.4" rx="1.4" fill="#143028" />
      <rect x="11.5" y="8" width="9" height="7" rx="1.4" fill="#1c4638" />
      <path fill="#c4622d" d="M13.3 5.6h5.4l-.85 4h-3.7z" />
    </svg>
  )
}
