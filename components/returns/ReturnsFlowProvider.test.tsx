import { describe, it, expect } from 'vitest'
import React from 'react'
import { readFileSync } from 'fs'
import { join } from 'path'
import { ReturnsFlowProvider, useReturnsFlowEnabled } from './ReturnsFlowProvider'

const reactDomServer = require('react-dom/server')

function Probe() {
  const enabled = useReturnsFlowEnabled()
  return React.createElement('span', { 'data-enabled': String(enabled) })
}

describe('ReturnsFlowProvider', () => {
  it('defaults to false when there is no provider', () => {
    const html = reactDomServer.renderToString(React.createElement(Probe))
    expect(html).toContain('data-enabled="false"')
  })

  it('exposes the enabled value to descendants', () => {
    const html = reactDomServer.renderToString(
      React.createElement(ReturnsFlowProvider, { enabled: true }, React.createElement(Probe)),
    )
    expect(html).toContain('data-enabled="true"')
  })

  it('exposes false when enabled is false', () => {
    const html = reactDomServer.renderToString(
      React.createElement(ReturnsFlowProvider, { enabled: false }, React.createElement(Probe)),
    )
    expect(html).toContain('data-enabled="false"')
  })
})

const layoutSrc = readFileSync(
  join(process.cwd(), 'app', 'dashboard', 'customer', 'orders', '[id]', 'layout.tsx'),
  'utf8',
)
const pageSrc = readFileSync(
  join(process.cwd(), 'app', 'dashboard', 'customer', 'orders', '[id]', 'page.tsx'),
  'utf8',
)

describe('order page returns flow wiring', () => {
  it('layout wraps children in ReturnsFlowProvider instead of injecting props via cloneElement', () => {
    expect(layoutSrc).toContain('ReturnsFlowProvider')
    expect(layoutSrc).not.toContain('cloneElement')
    expect(layoutSrc).not.toContain('isValidElement')
  })

  it('layout computes the flag server-side and passes it as enabled', () => {
    expect(layoutSrc).toContain('isReturnsFlowEnabled()')
    expect(layoutSrc).toContain('<ReturnsFlowProvider enabled={isEnabled}>{children}</ReturnsFlowProvider>')
  })

  it('page no longer takes returnsFlowEnabled as a prop', () => {
    expect(pageSrc).not.toContain('returnsFlowEnabled = false')
    expect(pageSrc).not.toContain('returnsFlowEnabled?: boolean')
    expect(pageSrc).not.toMatch(/CustomerOrderDetailPage\([^)]*returnsFlowEnabled/)
  })

  it('page reads the flag from context', () => {
    expect(pageSrc).toContain("from '@/components/returns/ReturnsFlowProvider'")
    expect(pageSrc).toContain('useReturnsFlowEnabled()')
  })
})
