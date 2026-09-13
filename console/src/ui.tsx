import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { errorMessage } from './api'

export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; children: ReactNode }) {
  return (
    <button type="button" className="icon-button" title={label} aria-label={label} {...props}>
      {children}
    </button>
  )
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={16} />
      <span>{errorMessage(error)}</span>
      {retry && (
        <button type="button" className="button" onClick={retry}>
          <RefreshCw size={14} />
          Retry
        </button>
      )}
    </div>
  )
}

export function LoadingRows() {
  return (
    <div className="loading-rows" role="status" aria-label="Loading records">
      {Array.from({ length: 7 }, (_, index) => (
        <div key={index}>
          <i />
          <i />
          <i />
        </div>
      ))}
    </div>
  )
}
