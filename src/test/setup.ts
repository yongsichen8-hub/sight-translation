import '@testing-library/jest-dom'

// Mock IndexedDB for testing
import 'fake-indexeddb/auto'

// Global test utilities
beforeEach(() => {
  // Clear any mocks before each test
  vi.clearAllMocks()
})

// Suppress console errors during tests unless explicitly needed
const originalError = console.error
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is no longer supported')
    ) {
      return
    }
    originalError.call(console, ...args)
  }
})

afterAll(() => {
  console.error = originalError
})
