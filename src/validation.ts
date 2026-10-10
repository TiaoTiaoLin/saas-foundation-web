const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const TENANT_ID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/

export function emailError(email: string): string | undefined {
  const value = email.trim()
  if (!value) return 'Email is required'
  if (value.length > 320) return 'Email must be at most 320 characters'
  if (!EMAIL.test(value)) return 'Enter a valid email address'
  return undefined
}

export function loginPasswordError(password: string): string | undefined {
  if (!password) return 'Password is required'
  if (new TextEncoder().encode(password).length > 72) return 'Password must be at most 72 bytes'
  return undefined
}

export function signupPasswordError(password: string): string | undefined {
  if (!password) return 'Password is required'
  if (password.length < 12) return 'Password must be at least 12 characters'
  if (password.length > 72) return 'Password must be at most 72 characters'
  if (new TextEncoder().encode(password).length > 72) return 'Password must be at most 72 bytes'
  return undefined
}

export function requiredText(value: string, label: string, max: number): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return `${label} is required`
  if (trimmed.length > max) return `${label} must be at most ${max} characters`
  return undefined
}

export function tenantIdError(value: string): string | undefined {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  if (!TENANT_ID.test(trimmed)) return 'Enter a tenant id in UUID form'
  return undefined
}
