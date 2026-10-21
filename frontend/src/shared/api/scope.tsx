import { createContext, useContext } from 'react'

export const ApiScopeContext = createContext<number | null>(null)
export const useApiScope = () => useContext(ApiScopeContext)
