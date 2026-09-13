import { useEffect, useReducer, useRef, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Code2, Copy, FileText, KeyRound, Save, Trash2, X } from 'lucide-react'
import { api, errorMessage, formatBytes, writer } from './api'
import { convertValue, encodeValue, type Encoding } from './value'
import { initialDraft, reduceDraft } from './draft'
import { ErrorState, IconButton } from './ui'
import { canEditAfterFailure } from './writes'

type Operation = () => Promise<unknown>
export function RecordPanel({
  namespace,
  recordKey,
  onClose,
  onSaved,
}: {
  namespace: string
  recordKey?: string
  onClose: () => void
  onSaved: (namespace: string) => void
}) {
  const creating = recordKey === undefined
  const [targetNamespace, setNamespace] = useState(namespace)
  const [key, setKey] = useState(recordKey ?? '')
  const [draft, dispatch] = useReducer(reduceDraft, creating, initialDraft)
  const { text, encoding, dirty, record: base } = draft
  const [validation, setValidation] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const operation = useRef<Operation | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const record = useQuery({
    queryKey: ['record', namespace, recordKey],
    queryFn: () => api.get({ namespace, key: recordKey }),
    enabled: !creating,
  })
  useEffect(() => {
    if (record.data) dispatch({ type: 'loaded', record: record.data })
  }, [record.data])
  useEffect(() => {
    if (creating) nameRef.current?.focus()
  }, [creating])

  const save = useMutation({
    scope: { id: 'kv-writes' },
    mutationFn: async (kind: 'put' | 'delete') => {
      if (!operation.current) {
        operation.current =
          kind === 'delete'
            ? await writer.delete({ namespace: targetNamespace, key, ifMatch: base?.etag })
            : await writer.put({
                namespace: targetNamespace,
                key,
                body: encodeValue(text, encoding),
                ifMatch: base?.etag,
                ifNoneMatch: creating,
              })
      }
      return operation.current()
    },
    onSuccess: () => onSaved(targetNamespace),
    onError: (error) => {
      if (canEditAfterFailure(error)) {
        operation.current = null
        if (!creating) void record.refetch()
      }
    },
  })
  const locked = save.isPending || operation.current !== null
  function changeEncoding(next: Encoding) {
    try {
      const converted = convertValue(text, encoding, next)
      dispatch({ type: 'encoding', text: converted, encoding: next })
      setCopied(false)
      setValidation('')
    } catch (error) {
      setValidation(errorMessage(error))
    }
  }
  function submit() {
    try {
      if (!targetNamespace || !key) throw new Error('Namespace and key are required')
      if (new TextEncoder().encode(targetNamespace).length > 255)
        throw new Error('Namespace exceeds 255 bytes')
      if (new TextEncoder().encode(key).length > 1024) throw new Error('Key exceeds 1024 bytes')
      encodeValue(text, encoding)
      setValidation('')
      save.mutate('put')
    } catch (error) {
      setValidation(errorMessage(error))
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch (error) {
      setValidation(errorMessage(error))
    }
  }

  return (
    <aside className="inspector" aria-label={creating ? 'New record' : 'Record details'}>
      <div className="inspector-header">
        <KeyRound size={16} />
        <strong>{creating ? 'New record' : 'Record details'}</strong>
        <IconButton label="Close record" onClick={onClose} disabled={save.isPending}>
          <X size={17} />
        </IconButton>
      </div>
      <div className="inspector-body">
        <label className="field">
          Namespace
          <input
            ref={nameRef}
            value={targetNamespace}
            readOnly={!creating}
            disabled={locked}
            placeholder="app"
            onChange={(event) => setNamespace(event.target.value)}
          />
        </label>
        <label className="field">
          Key
          <input
            value={key}
            readOnly={!creating}
            disabled={locked}
            placeholder="settings/default"
            onChange={(event) => setKey(event.target.value)}
          />
        </label>
        {!creating && base && (
          <dl className="record-meta">
            <div>
              <dt>Generation</dt>
              <dd>{base.generation.toString()}</dd>
            </div>
            <div>
              <dt>Size</dt>
              <dd>{formatBytes(base.size)}</dd>
            </div>
            <div>
              <dt>ETag</dt>
              <dd>{base.etag}</dd>
            </div>
          </dl>
        )}
        {record.isError && <ErrorState error={record.error} retry={() => void record.refetch()} />}
        {base && record.data && base.etag !== record.data.etag && (
          <div className="revision-conflict" role="status">
            <span>This record changed while you were editing.</span>
            <button
              className="button"
              disabled={locked}
              onClick={() => {
                if (record.data) dispatch({ type: 'reload', record: record.data })
                save.reset()
              }}
            >
              Discard edits and reload
            </button>
          </div>
        )}
        <div className="value-heading">
          <span>Value</span>
          <div className="segmented" aria-label="Value encoding">
            {(['json', 'text', 'base64'] as const).map((mode) => (
              <button
                key={mode}
                aria-pressed={encoding === mode}
                disabled={locked}
                onClick={() => changeEncoding(mode)}
              >
                {mode === 'json' ? (
                  <Code2 size={13} />
                ) : mode === 'text' ? (
                  <FileText size={13} />
                ) : null}
                {mode === 'json' ? 'JSON' : mode === 'text' ? 'Text' : 'Base64'}
              </button>
            ))}
          </div>
          <IconButton label={copied ? 'Value copied' : 'Copy value'} onClick={() => void copy()}>
            <Copy size={14} />
          </IconButton>
        </div>
        <textarea
          className="value-editor"
          aria-label="Record value"
          spellCheck={false}
          value={text}
          disabled={locked || (!creating && !base)}
          placeholder="{}"
          onChange={(event) => {
            dispatch({ type: 'edited', text: event.target.value })
            setCopied(false)
          }}
        />
        <div className="value-caption">
          <span>{encoding === 'base64' ? 'Binary' : 'UTF-8'}</span>
          <span>64 KiB maximum</span>
        </div>
        {validation && (
          <p role="alert" className="error-text">
            {validation}
          </p>
        )}
        {save.isError && (
          <ErrorState
            error={save.error}
            retry={() => save.mutate(confirmDelete ? 'delete' : 'put')}
          />
        )}
        {confirmDelete && (
          <div className="delete-confirm" role="alert">
            <strong>Delete this record?</strong>
            <p>{key}</p>
            <div>
              <button className="button" disabled={locked} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button
                className="button danger"
                disabled={save.isPending}
                onClick={() => save.mutate('delete')}
              >
                <Trash2 size={14} />
                Delete record
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="inspector-footer">
        {!creating && (
          <IconButton
            label="Delete record"
            disabled={locked || !base}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={15} />
          </IconButton>
        )}
        <span />
        <button className="button" disabled={save.isPending} onClick={onClose}>
          Close
        </button>
        <button
          className="button primary"
          disabled={locked || (!creating && (!base || !dirty))}
          onClick={submit}
        >
          <Save size={14} />
          {save.isPending ? 'Saving...' : creating ? 'Insert record' : 'Save changes'}
        </button>
      </div>
    </aside>
  )
}
