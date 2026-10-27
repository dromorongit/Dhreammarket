'use client'

import React, { createContext, useContext, ReactNode } from 'react'

interface ReturnsFlowContextValue {
  enabled: boolean
}

const ReturnsFlowContext = createContext<ReturnsFlowContextValue | undefined>(undefined)

export function ReturnsFlowProvider({ enabled, children }: { enabled: boolean; children?: ReactNode }) {
  return React.createElement(ReturnsFlowContext.Provider, { value: { enabled } }, children)
}

export function useReturnsFlowEnabled(): boolean {
  const ctx = useContext(ReturnsFlowContext)
  return ctx?.enabled ?? false
}
