import React from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import './styles.css'

async function start() {
  if (import.meta.env.DEV && import.meta.env.MODE === 'preview') {
    const { worker } = await import('./preview/worker')
    await worker.start({ onUnhandledRequest: 'bypass', quiet: true })
  }
  const root = document.getElementById('root')
  if (!root) throw new Error('Console root is missing')
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
  createRoot(root).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

void start().catch((error: unknown) => {
  const root = document.getElementById('root')
  if (root) root.textContent = error instanceof Error ? error.message : 'Console startup failed'
})
