export type TokenResponse = {
  accessToken: string
  tokenType: string
  expiresAt: string
  refreshToken: string
  refreshTokenExpiresAt: string
  tenantId: string
  organizationName: string
}

export type RegisterTenantResponse = {
  tenantId: string
  organizationName: string
  adminEmail: string
}

export type MembershipRole = 'OWNER' | 'ADMIN' | 'MEMBER'

export type Member = {
  userId: string
  email: string
  name: string
  role: MembershipRole
  avatarUrl?: string | null
}

export type Profile = {
  email: string
  name: string
  avatarUrl?: string | null
}

export type Organization = {
  name: string
  logoUrl?: string | null
}

export type SubscriptionStatus = 'NONE' | 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE'

export type Plan = 'FREE' | 'PRO'

export type Billing = {
  plan: Plan
  subscriptionStatus: SubscriptionStatus
  productAccess: boolean
  auditAccess: boolean
  configured: boolean
  canSubscribe: boolean
  canManage: boolean
}

export type BillingLink = {
  url: string
}

export type AuditEvent = {
  id: string
  action: string
  targetType: string
  targetId?: string | null
  actorUserId?: string | null
  metadata: Record<string, string>
  createdAt: string
}

export type AuditPage = {
  items: AuditEvent[]
  page: number
  size: number
  total: number
}

export type InviteMemberResponse = {
  userId: string
  email: string
  role: MembershipRole
  emailAccepted: boolean
  emailDetail?: string
}

export type MembershipInvitePreview = {
  organizationName: string
  role: MembershipRole
}

export type AcceptMembershipInviteResponse = {
  tenantId: string
  organizationName: string
  role: MembershipRole
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

export type LoginOrganization = {
  tenantId: string
  name: string
  role: MembershipRole
}

export type ApiErrorBody = {
  status?: number
  error?: string
  message?: string
  path?: string
  violations?: FieldViolation[]
  organizations?: LoginOrganization[]
}
