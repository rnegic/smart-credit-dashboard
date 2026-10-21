export { apiRequest, apiEmpty, ApiError } from './client'
export {
  sessionEvents,
  beginSessionChange,
  endSessionChange,
  completeSessionRefresh,
  getSessionGeneration,
  hasActiveSessionChange,
  isSessionSwitching,
  syncSessionChanges,
  useSessionTransition,
  type SessionChangeEvent,
} from './session-lifecycle'
export { ApiScopeContext, useApiScope } from './scope'
