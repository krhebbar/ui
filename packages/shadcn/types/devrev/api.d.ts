// Auto-generated placeholder DevRev API types
// TODO: Generate from OpenAPI spec when available

// Base DevRev API types
export interface DevRevApiResponse<T = any> {
  data: T
  success: boolean
  message?: string
}

export interface DevRevApiError {
  error: string
  message: string
  details?: any
}

// Request/Response types for selected DevRev objects
// Account API types
export interface CreateAccountRequest extends CreateRequest<Account> {}
export interface UpdateAccountRequest extends UpdateRequest<Account> {}
export interface ListAccountRequest extends ListRequest {}
export interface ListAccountResponse extends ListResponse<Account> {}
export interface GetAccountResponse extends DevRevApiResponse<Account> {}

// Generic CRUD operations
export interface CreateRequest<T> {
  data: Partial<T>
}

export interface UpdateRequest<T> {
  id: string
  data: Partial<T>
}

export interface ListRequest {
  limit?: number
  offset?: number
  filters?: Record<string, any>
}

export interface ListResponse<T> {
  items: T[]
  total: number
  hasMore: boolean
}
