import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Database,
  ExternalLink,
  KeyRound,
  Menu,
  Plus,
  RefreshCw,
  Search,
  Server,
  Table2,
  X,
} from 'lucide-react'
import { api } from './api'
import { DataView } from './DataView'
import { NodeView } from './NodeView'
import { RecordPanel } from './RecordPanel'
import { ErrorState, IconButton } from './ui'

type Location = { view: 'data' | 'node'; namespace: string }
function location(): Location {
  const params = new URLSearchParams(window.location.hash.slice(1))
  return {
    view: params.get('view') === 'node' ? 'node' : 'data',
    namespace: params.get('namespace') ?? '',
  }
}
function link(view: Location['view'], namespace = '') {
  return `#${new URLSearchParams({ view, ...(namespace ? { namespace } : {}) })}`
}

export function App() {
  const [route, setRoute] = useState(location)
  const [search, setSearch] = useState('')
  const [mobileNav, setMobileNav] = useState(false)
  const [record, setRecord] = useState<{ namespace: string; key: string } | null>(null)
  const [creating, setCreating] = useState(false)
  const client = useQueryClient()
  const status = useQuery({
    queryKey: ['status'],
    queryFn: () => api.status({}),
    refetchInterval: 5000,
  })
  const namespaces = useInfiniteQuery({
    queryKey: ['namespaces'],
    initialPageParam: '',
    queryFn: ({ pageParam }) => api.listNamespaces({ startAfter: pageParam, limit: 100 }),
    getNextPageParam: (last) => last.nextStartAfter || undefined,
  })
  useEffect(() => {
    const update = () => {
      setRoute(location())
      setMobileNav(false)
      setRecord(null)
      setCreating(false)
    }
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  const allNamespaces = namespaces.data?.pages.flatMap((page) => page.namespaces) ?? []
  const activeNamespace = route.namespace || allNamespaces[0]?.name || ''
  const selected = allNamespaces.find((ns) => ns.name === activeNamespace)
  const preview = import.meta.env.DEV && import.meta.env.MODE === 'preview'
  function refresh() {
    void client.invalidateQueries()
  }
  function closeRecord() {
    setRecord(null)
    setCreating(false)
  }
  const hasPanel = creating || record !== null

  return (
    <div className="console">
      <a
        className="skip-link"
        href="#main"
        onClick={(event) => {
          event.preventDefault()
          document.getElementById('main')?.focus()
        }}
      >
        Skip to content
      </a>
      <header className="topbar">
        <div className="brand">
          <Database size={20} strokeWidth={1.6} />
          <strong>BasisDB</strong>
          <span>console</span>
        </div>
        <div className="breadcrumbs">
          <span>Local</span>
          <ChevronRight size={13} />
          <span>{route.view === 'data' ? 'Data' : 'Node'}</span>
          {route.view === 'data' && activeNamespace && (
            <>
              <ChevronRight size={13} />
              <strong>{activeNamespace}</strong>
            </>
          )}
        </div>
        <div className="topbar-right">
          {preview && <span className="badge amber">Preview</span>}
          <span className={`connection ${status.isSuccess ? 'online' : ''}`}>
            <i />
            {status.isSuccess ? 'Connected' : status.isPending ? 'Connecting' : 'Disconnected'}
          </span>
          <IconButton
            label="Toggle navigation"
            aria-expanded={mobileNav}
            aria-controls="navigation"
            className="icon-button mobile-menu"
            onClick={() => setMobileNav(!mobileNav)}
          >
            <Menu size={18} />
          </IconButton>
        </div>
      </header>

      <aside id="navigation" className={`sidebar ${mobileNav ? 'mobile-open' : ''}`}>
        <div className="connection-block">
          <span className="connection-icon">
            <Database size={19} />
          </span>
          <div>
            <strong>Local instance</strong>
            <span>{preview ? 'Preview connection' : 'Default connection'}</span>
          </div>
        </div>
        <nav aria-label="Main navigation" className="main-nav">
          <a
            href={link('data', activeNamespace)}
            aria-current={route.view === 'data' ? 'page' : undefined}
          >
            <Table2 size={16} />
            Data
          </a>
          <a href={link('node')} aria-current={route.view === 'node' ? 'page' : undefined}>
            <Server size={16} />
            Node
          </a>
        </nav>
        <div className="sidebar-heading">
          <span>Namespaces</span>
          <IconButton
            label="Create record in a namespace"
            onClick={() => {
              setCreating(true)
              setRecord(null)
              setMobileNav(false)
            }}
          >
            <Plus size={14} />
          </IconButton>
        </div>
        <label className="sidebar-search">
          <Search size={14} />
          <input
            aria-label="Find namespace"
            placeholder="Find namespace..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <nav className="namespace-list" aria-label="Namespaces">
          {allNamespaces
            .filter((ns) => ns.name.toLowerCase().includes(search.toLowerCase()))
            .map((ns) => (
              <a
                key={ns.name}
                href={link('data', ns.name)}
                aria-current={
                  activeNamespace === ns.name && route.view === 'data' ? 'page' : undefined
                }
              >
                <KeyRound size={14} />
                <span>{ns.name}</span>
                <small>{ns.keyCount.toString()}</small>
              </a>
            ))}
          {namespaces.isPending && <span className="sidebar-note">Loading namespaces...</span>}
          {namespaces.isError && (
            <span className="sidebar-note error-text">Namespaces unavailable</span>
          )}
          {namespaces.isSuccess && !allNamespaces.length && (
            <span className="sidebar-note">No namespaces</span>
          )}
          {namespaces.hasNextPage && (
            <button
              className="text-button"
              disabled={namespaces.isFetchingNextPage}
              onClick={() => void namespaces.fetchNextPage()}
            >
              <ChevronDown size={14} />
              Load more
            </button>
          )}
        </nav>
        <div className="sidebar-footer">
          <a
            href="https://github.com/windsornguyen/basisdb/tree/main/spec"
            target="_blank"
            rel="noreferrer"
          >
            <BookOpen size={15} />
            Documentation
            <ExternalLink size={12} />
          </a>
          <span>
            <i />
            Open source · MIT
          </span>
        </div>
      </aside>

      <main id="main" tabIndex={-1} className={`workspace ${hasPanel ? 'with-inspector' : ''}`}>
        <div className="workspace-heading">
          <div className="heading-title">
            <span className="eyebrow">{route.view === 'data' ? 'Database' : 'Infrastructure'}</span>
            <h1>{route.view === 'data' ? 'Data explorer' : 'Node'}</h1>
          </div>
          <div className="heading-actions">
            <IconButton label="Refresh data" onClick={refresh}>
              <RefreshCw size={15} className={status.isFetching ? 'spinning' : ''} />
            </IconButton>
            {route.view === 'data' && (
              <button
                className="button primary"
                onClick={() => {
                  setCreating(true)
                  setRecord(null)
                }}
              >
                <Plus size={15} />
                New record
              </button>
            )}
          </div>
        </div>
        {route.view === 'data' ? (
          <>
            <div className="resource-tabs">
              <span className="resource-tab active">
                <KeyRound size={14} />
                {activeNamespace || 'Namespaces'}
                <span className="tab-type">KV</span>
              </span>
            </div>
            {namespaces.isError && (
              <ErrorState error={namespaces.error} retry={() => void namespaces.refetch()} />
            )}
            <DataView
              key={activeNamespace}
              namespace={activeNamespace}
              count={selected?.keyCount}
              selectedKey={record?.namespace === activeNamespace ? record.key : undefined}
              onSelect={(key) => {
                setRecord({ namespace: activeNamespace, key })
                setCreating(false)
              }}
              onCreate={() => {
                setRecord(null)
                setCreating(true)
              }}
            />
          </>
        ) : (
          <NodeView status={status.data} error={status.error} loading={status.isPending} />
        )}
      </main>

      {hasPanel && (
        <RecordPanel
          key={creating ? `new:${activeNamespace}` : `${record?.namespace}:${record?.key}`}
          namespace={record?.namespace ?? activeNamespace}
          recordKey={creating ? undefined : record?.key}
          onClose={closeRecord}
          onSaved={(namespace) => {
            closeRecord()
            window.location.hash = link('data', namespace)
            refresh()
          }}
        />
      )}
      {mobileNav && (
        <button
          className="nav-scrim"
          aria-label="Close navigation"
          onClick={() => setMobileNav(false)}
        >
          <X />
        </button>
      )}
      <footer className="statusbar">
        <span>
          <Database size={12} />
          {preview ? 'Preview data' : 'Local connection'}
        </span>
        <span>
          {status.data ? `Node ${status.data.nodeId} · ${status.data.mode}` : 'No node status'}
        </span>
        <span className="statusbar-end">BasisDB Console</span>
      </footer>
    </div>
  )
}
