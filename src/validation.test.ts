import { describe, expect, it } from 'vitest'
import {
  emailError,
  loginPasswordError,
  requiredText,
  signupPasswordError,
  tenantIdError,
} from './validation'

describe('emailError', () => {
  it('accepts a normal address and trims it', () => {
    expect(emailError('  owner@acme.test  ')).toBeUndefined()
  })

  it('rejects empty, malformed, and overlong addresses', () => {
    expect(emailError('   ')).toBe('Email is required')
    expect(emailError('not-an-email')).toBe('Enter a valid email address')
    expect(emailError('a@b')).toBe('Enter a valid email address')
    expect(emailError(`${'a'.repeat(320)}@x.io`)).toBe('Email must be at most 320 characters')
  })
})

describe('loginPasswordError', () => {
  it('requires a password and caps it at 72 bytes', () => {
    expect(loginPasswordError('')).toBe('Password is required')
    expect(loginPasswordError('x'.repeat(72))).toBeUndefined()
    expect(loginPasswordError('x'.repeat(73))).toBe('Password must be at most 72 bytes')
  })

  it('counts bytes, not characters', () => {
    // 37 two-byte characters are 74 bytes.
    expect(loginPasswordError('é'.repeat(37))).toBe('Password must be at most 72 bytes')
  })
})

describe('signupPasswordError', () => {
  it('enforces the 12 to 72 character range', () => {
    expect(signupPasswordError('')).toBe('Password is required')
    expect(signupPasswordError('short')).toBe('Password must be at least 12 characters')
    expect(signupPasswordError('x'.repeat(12))).toBeUndefined()
    expect(signupPasswordError('x'.repeat(73))).toBe('Password must be at most 72 characters')
  })

  it('rejects a password that is short in characters but over 72 bytes', () => {
    expect(signupPasswordError('é'.repeat(37))).toBe('Password must be at most 72 bytes')
  })
})

describe('requiredText', () => {
  it('requires a trimmed value within the limit', () => {
    expect(requiredText('  ', 'Name', 10)).toBe('Name is required')
    expect(requiredText('Acme', 'Name', 10)).toBeUndefined()
    expect(requiredText('x'.repeat(11), 'Name', 10)).toBe('Name must be at most 10 characters')
  })
})

describe('tenantIdError', () => {
  it('allows blank and valid UUIDs', () => {
    expect(tenantIdError('')).toBeUndefined()
    expect(tenantIdError('9180a8b1-3fe8-4424-a578-b958c709c709')).toBeUndefined()
  })

  it('rejects anything else', () => {
    expect(tenantIdError('tenant-1')).toBe('Enter a tenant id in UUID form')
  })
})
