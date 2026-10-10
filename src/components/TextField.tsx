type TextFieldProps = {
  label: string
  name: string
  type?: 'text' | 'email' | 'password'
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  error?: string
  hint?: string
  maxLength?: number
  spellCheck?: boolean
}

export function TextField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  autoComplete,
  error,
  hint,
  maxLength,
  spellCheck,
}: TextFieldProps) {
  const describedBy = [hint ? `${name}-hint` : null, error ? `${name}-error` : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        maxLength={maxLength}
        spellCheck={spellCheck}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <p id={`${name}-hint`} className="hint">{hint}</p> : null}
      {error ? <p id={`${name}-error`} className="field-error">{error}</p> : null}
    </div>
  )
}
