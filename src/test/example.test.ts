import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

describe('Test Framework Setup', () => {
  it('should run basic vitest test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should support fast-check property testing', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer(), (a, b) => {
        return a + b === b + a // 加法交换律
      }),
      { numRuns: 100 }
    )
  })

  it('should have access to jest-dom matchers', () => {
    const div = document.createElement('div')
    div.textContent = 'Hello'
    document.body.appendChild(div)
    
    expect(div).toBeInTheDocument()
    expect(div).toHaveTextContent('Hello')
    
    document.body.removeChild(div)
  })
})
