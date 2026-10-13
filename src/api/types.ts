export type TokenResponse = {
  accessToken: string
  tokenType: string
  expiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
  tenantId: string
}

export type RegisterTenantResponse = {
  tenantId: string
  organizationName: string
  adminEmail: string
  welcomeEmailAccepted: boolean
  welcomeEmailDetail?: string
}

export type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type Member = {
  userId: string
  email: string
  role: MembershipRole
}

export type InviteMemberResponse = {
  userId: string
  email: string
  role: MembershipRole
  emailAccepted: boolean
  emailDetail?: string
}

export type Product = {
  id: string
  tenantId: string
  name: string
  sku: string
  active: boolean
  createdAt: string
  updatedAt: string
}

export type ProductPage = {
  items: Product[]
  page: number
  size: number
  total: number
}

export type FieldViolation = {
  field: string
  message: string
}

export type ApiErrorBody = {
  status?: number
  error?: string
  message?: string
  path?: string
  violations?: FieldViolation[]
}
