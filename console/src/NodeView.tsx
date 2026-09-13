import { Database, HardDrive, Server } from 'lucide-react'
import type { StatusResponse } from './gen/basisdb/kv/v1/kv_pb'
import { ErrorState, LoadingRows } from './ui'

export function NodeView({
  status,
  error,
  loading,
}: {
  status?: StatusResponse
  error: unknown
  loading: boolean
}) {
  if (loading) return <LoadingRows />
  if (error) return <ErrorState error={error} />
  if (!status) return null
  return (
    <section className="node-surface">
      <div className="node-summary">
        <div>
          <Server size={18} />
          <span>Node ID</span>
          <strong className="mono">{status.nodeId.toString()}</strong>
        </div>
        <div>
          <Database size={18} />
          <span>Raft role</span>
          <strong>{status.mode}</strong>
        </div>
        <div>
          <HardDrive size={18} />
          <span>Stored keys</span>
          <strong className="mono">{status.keyCount.toLocaleString()}</strong>
        </div>
      </div>
      <h2 className="section-title">Connected node</h2>
      <table className="data-table">
        <thead>
          <tr>
            <th>Node</th>
            <th>Role</th>
            <th>Connection</th>
            <th>Keys</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="mono">{status.nodeId.toString()}</td>
            <td>
              <span className={`badge ${status.mode === 'leader' ? 'green' : 'neutral'}`}>
                {status.mode}
              </span>
            </td>
            <td>
              <span className="connection online">
                <i />
                Connected
              </span>
            </td>
            <td className="mono">{status.keyCount.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </section>
  )
}
