import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownAZ, ArrowLeft, ArrowRight, KeyRound, Plus, Search } from 'lucide-react'
import { api, formatBytes } from './api'
import { ErrorState, LoadingRows } from './ui'

export function DataView({
  namespace,
  count,
  selectedKey,
  onSelect,
  onCreate,
}: {
  namespace: string
  count?: bigint
  selectedKey?: string
  onSelect: (key: string) => void
  onCreate: () => void
}) {
  const [input, setInput] = useState('')
  const [prefix, setPrefix] = useState('')
  const [cursors, setCursors] = useState([''])
  const [limit, setLimit] = useState(50)
  const cursor = cursors.at(-1) ?? ''
  const page = useQuery({
    queryKey: ['keys', namespace, prefix, cursor, limit],
    queryFn: () => api.list({ namespace, prefix, startAfter: cursor, limit }),
    enabled: namespace.length > 0,
  })

  return (
    <section className="data-surface" aria-label="Records">
      <div className="table-toolbar">
        <form
          className="prefix-search"
          onSubmit={(event) => {
            event.preventDefault()
            setPrefix(input)
            setCursors([''])
          }}
        >
          <Search size={15} />
          <input
            aria-label="Key prefix"
            placeholder="Filter by key prefix..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit">Filter</button>
        </form>
        <span className="sort-label">
          <ArrowDownAZ size={14} />
          Key ascending
        </span>
        <span className="record-count">
          {count === undefined ? '' : `${count.toLocaleString()} total records`}
        </span>
      </div>
      {page.isError ? (
        <ErrorState error={page.error} retry={() => void page.refetch()} />
      ) : namespace && page.isPending ? (
        <LoadingRows />
      ) : (
        <div className="grid-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th className="row-number">#</th>
                <th>
                  <KeyRound size={13} />
                  Key
                </th>
                <th>
                  Size <small>bytes</small>
                </th>
                <th>
                  Generation <small>u64</small>
                </th>
                <th>
                  ETag <small>string</small>
                </th>
              </tr>
            </thead>
            <tbody>
              {page.data?.entries.map((row, index) => (
                <tr key={row.key} aria-selected={selectedKey === row.key}>
                  <td className="row-number">{(cursors.length - 1) * limit + index + 1}</td>
                  <td className="key-cell">
                    <button onClick={() => onSelect(row.key)} title={row.key}>
                      {row.key}
                    </button>
                  </td>
                  <td className="mono muted">{formatBytes(row.size)}</td>
                  <td className="mono">
                    <span className="generation">{row.generation.toString()}</span>
                  </td>
                  <td className="mono muted">{row.etag}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!page.data?.entries.length && (
            <div className="empty-state">
              <KeyRound size={26} strokeWidth={1.4} />
              <h2>{prefix ? 'No matching keys' : 'No records yet'}</h2>
              <button className="button" onClick={onCreate}>
                <Plus size={14} />
                New record
              </button>
            </div>
          )}
        </div>
      )}
      <div className="table-footer">
        <label>
          Rows per page
          <select
            value={limit}
            onChange={(event) => {
              setLimit(Number(event.target.value))
              setCursors([''])
            }}
          >
            <option>25</option>
            <option>50</option>
            <option>100</option>
          </select>
        </label>
        <span>{page.data?.entries.length ?? 0} rows</span>
        <div className="pagination">
          <button
            className="button"
            disabled={cursors.length === 1 || page.isFetching}
            onClick={() => setCursors((previous) => previous.slice(0, -1))}
          >
            <ArrowLeft size={14} />
            Previous
          </button>
          <span>Page {cursors.length}</span>
          <button
            className="button"
            disabled={!page.data?.nextStartAfter || page.isFetching}
            onClick={() => {
              const next = page.data?.nextStartAfter
              if (next) setCursors((previous) => [...previous, next])
            }}
          >
            Next
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  )
}
