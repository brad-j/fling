import { useEffect, useMemo, useState } from 'react'
import type { ConnectionTestResult, FlingSettings, SshConfigHost } from '../../../main/types'

type OnboardingStep = 'welcome' | 'connection' | 'test'

function hasRequiredConnectionSettings(settings: FlingSettings): boolean {
  return Boolean(
    settings.host.trim() &&
    settings.username.trim() &&
    settings.remotePath.trim() &&
    settings.keyPath.trim() &&
    settings.screenshotDir.trim()
  )
}

function missingFields(settings: FlingSettings): string[] {
  const missing: string[] = []
  if (!settings.host.trim()) missing.push('Host')
  if (!settings.username.trim()) missing.push('Username')
  if (!settings.remotePath.trim()) missing.push('Remote path')
  if (!settings.keyPath.trim()) missing.push('SSH key path')
  if (!settings.screenshotDir.trim()) missing.push('Screenshot directory')
  return missing
}

export default function OnboardingPanel({
  settings,
  onComplete
}: {
  settings: FlingSettings | null
  onComplete: (settings: FlingSettings) => void
}) {
  const [draft, setDraft] = useState<FlingSettings | null>(settings)
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null)
  const [sshConfigHosts, setSshConfigHosts] = useState<SshConfigHost[]>([])

  useEffect(() => {
    setDraft(settings)
    if (settings && hasRequiredConnectionSettings(settings)) {
      setStep('test')
    }
  }, [settings])

  useEffect(() => {
    window.filefling.getSshConfigHosts().then(setSshConfigHosts)
  }, [])

  const missing = useMemo(() => draft ? missingFields(draft) : [], [draft])
  const canContinue = missing.length === 0 && !saving && !testing

  const updateDraft = (field: keyof FlingSettings, value: string | number | boolean) => {
    if (!draft) return
    setDraft({ ...draft, [field]: value })
    setTestResult(null)
    setError(null)
  }

  const applySshConfigHost = (alias: string) => {
    if (!draft) return
    setTestResult(null)
    setError(null)

    if (!alias) {
      setDraft({ ...draft, sshConfigHost: '' })
      return
    }

    const configHost = sshConfigHosts.find((host) => host.alias === alias)
    if (!configHost) return

    setDraft({
      ...draft,
      sshConfigHost: configHost.alias,
      host: configHost.hostName || configHost.alias,
      username: configHost.user || draft.username,
      port: configHost.port || draft.port,
      keyPath: configHost.identityFile || draft.keyPath
    })
  }

  const saveDraft = async (onboardingComplete: boolean): Promise<FlingSettings | null> => {
    if (!draft) return null
    setSaving(true)
    setError(null)
    try {
      const updated = await window.filefling.updateSettings({
        ...draft,
        onboardingComplete
      })
      setDraft(updated)
      return updated
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleContinueToTest = async () => {
    if (!canContinue) return
    const updated = await saveDraft(false)
    if (updated) setStep('test')
  }

  const handleTestConnection = async () => {
    if (!draft || !canContinue) return
    setTesting(true)
    setError(null)
    setTestResult(null)

    try {
      const updated = await saveDraft(false)
      if (!updated) return
      const result = await window.filefling.testConnection(updated)
      setTestResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setTesting(false)
    }
  }

  const handleFinish = async () => {
    const updated = await saveDraft(true)
    if (updated) onComplete(updated)
  }

  const handleSkip = async () => {
    if (!draft) return
    setSaving(true)
    setError(null)
    try {
      const updated = await window.filefling.updateSettings({ onboardingComplete: true })
      setDraft(updated)
      onComplete(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  if (!draft) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="theme-muted text-xs animate-pulse">Loading setup...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="theme-section-title text-xs font-semibold uppercase tracking-[0.2em]">
            First-run setup
          </h2>
          <p className="theme-muted-soft text-[10px] mt-1">
            Connect FileFling to your SSH destination.
          </p>
        </div>
        <StepDots step={step} />
      </div>

      {step === 'welcome' && (
        <section className="theme-dropzone rounded-xl border p-4 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full theme-primary-button border flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div>
              <h3 className="theme-text text-sm font-semibold">Send your first file in a minute</h3>
              <p className="theme-muted text-[11px] leading-relaxed mt-1">
                Add your SSH details, run a tiny test upload, then FileFling will copy remote paths automatically.
              </p>
            </div>
          </div>

          <ul className="theme-muted text-[11px] leading-relaxed list-disc pl-5 space-y-1">
            <li>Uses your existing SSH key.</li>
            <li>Creates the remote directory if needed.</li>
            <li>Trusts the host key on first use.</li>
          </ul>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setStep('connection')}
              className="theme-primary-button border flex-1 rounded-lg py-2 text-xs font-medium transition-all"
            >
              Begin Setup
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving}
              className="theme-dropzone border rounded-lg px-3 py-2 text-xs theme-muted transition-all"
            >
              Later
            </button>
          </div>
        </section>
      )}

      {step === 'connection' && (
        <section className="flex flex-col gap-3">
          <SshConfigPicker
            hosts={sshConfigHosts}
            selectedAlias={draft.sshConfigHost}
            onSelect={applySshConfigHost}
          />

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Field
                label="Host"
                value={draft.host}
                onChange={(value) => updateDraft('host', value)}
                placeholder="devbox or 100.x.x.x"
              />
            </div>
            <Field
              label="Port"
              value={String(draft.port)}
              onChange={(value) => updateDraft('port', parseInt(value) || 22)}
              placeholder="22"
            />
          </div>

          <Field
            label="Username"
            value={draft.username}
            onChange={(value) => updateDraft('username', value)}
            placeholder="your-user"
          />

          <Field
            label="Remote Path"
            value={draft.remotePath}
            onChange={(value) => updateDraft('remotePath', value)}
            placeholder="~/shared"
          />

          <Field
            label="SSH Key Path"
            value={draft.keyPath}
            onChange={(value) => updateDraft('keyPath', value)}
            placeholder="~/.ssh/id_ed25519"
          />

          <Field
            label="Screenshot Directory"
            value={draft.screenshotDir}
            onChange={(value) => updateDraft('screenshotDir', value)}
            placeholder="~/Desktop"
          />

          {missing.length > 0 && (
            <p className="theme-status-error text-[10px] leading-relaxed">
              Required: {missing.join(', ')}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setStep('welcome')}
              className="theme-dropzone border rounded-lg px-3 py-2 text-xs theme-muted transition-all"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleContinueToTest}
              disabled={!canContinue}
              className={`border flex-1 rounded-lg py-2 text-xs font-medium transition-all ${canContinue ? 'theme-primary-button' : 'theme-primary-button-sending cursor-not-allowed'}`}
            >
              {saving ? 'Saving...' : 'Save & Test'}
            </button>
          </div>
        </section>
      )}

      {step === 'test' && (
        <section className="flex flex-col gap-3">
          <div className="theme-dropzone rounded-xl border p-3">
            <p className="theme-text text-[11px] font-mono truncate">
              {draft.username}@{draft.host}:{draft.remotePath}
            </p>
            <p className="theme-muted-soft text-[10px] mt-1 truncate">
              Key: {draft.keyPath}
            </p>
          </div>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={!canContinue || testing}
            className={`border w-full rounded-lg py-2.5 text-xs font-medium transition-all ${testing ? 'theme-primary-button-sending cursor-wait' : 'theme-primary-button'}`}
          >
            {testing ? 'Testing connection...' : 'Run Test Upload'}
          </button>

          {testResult && <TestResult result={testResult} />}

          {testResult?.ok && (
            <p className="theme-muted text-[10px] leading-relaxed">
              Test upload worked and the temporary file was removed. You’re ready to fling files.
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setStep('connection')}
              disabled={testing || saving}
              className="theme-dropzone border rounded-lg px-3 py-2 text-xs theme-muted transition-all"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleFinish}
              disabled={testing || saving || !testResult?.ok}
              className={`border flex-1 rounded-lg py-2 text-xs font-medium transition-all ${testResult?.ok ? 'theme-primary-button' : 'theme-primary-button-sending cursor-not-allowed'}`}
            >
              {saving ? 'Finishing...' : 'Finish Setup'}
            </button>
          </div>
        </section>
      )}

      {error && (
        <p className="theme-status-error text-[10px] leading-relaxed">{error}</p>
      )}
    </div>
  )
}

function SshConfigPicker({
  hosts,
  selectedAlias,
  onSelect
}: {
  hosts: SshConfigHost[]
  selectedAlias: string
  onSelect: (alias: string) => void
}) {
  if (hosts.length === 0) {
    return (
      <div className="theme-dropzone rounded-lg border px-2.5 py-2">
        <p className="theme-muted-soft text-[10px] leading-relaxed">
          No concrete hosts found in ~/.ssh/config. Enter SSH details manually.
        </p>
      </div>
    )
  }

  const selectedHost = hosts.find((host) => host.alias === selectedAlias)

  return (
    <label className="flex flex-col gap-1">
      <span className="theme-muted text-[10px] font-medium tracking-wide">SSH Config Host</span>
      <select
        value={selectedAlias}
        onChange={(event) => onSelect(event.target.value)}
        className="theme-input border rounded-lg px-2.5 py-1.5 text-xs font-mono transition-all focus:outline-none"
      >
        <option value="">Manual settings</option>
        {hosts.map((host) => (
          <option key={host.alias} value={host.alias}>
            {host.alias} → {host.hostName}{host.user ? ` (${host.user})` : ''}
          </option>
        ))}
      </select>
      {selectedHost && (
        <p className="theme-muted-soft text-[9px] leading-relaxed truncate">
          Applies HostName, User, Port, and first IdentityFile from {selectedHost.sourcePath || '~/.ssh/config'}.
        </p>
      )}
    </label>
  )
}

function StepDots({ step }: { step: OnboardingStep }) {
  const steps: OnboardingStep[] = ['welcome', 'connection', 'test']
  const currentIndex = steps.indexOf(step)

  return (
    <div className="flex gap-1" aria-label="Setup progress">
      {steps.map((item, index) => (
        <div
          key={item}
          className="w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: index <= currentIndex ? 'var(--accent)' : 'var(--accent-border)'
          }}
        />
      ))}
    </div>
  )
}

function TestResult({ result }: { result: ConnectionTestResult }) {
  return (
    <div className="theme-dropzone rounded-xl border p-3 flex flex-col gap-2">
      <p className={`text-[11px] font-medium ${result.ok ? 'theme-status-success' : 'theme-status-error'}`}>
        {result.ok ? '✓ Connection ready' : 'Connection test failed'}
      </p>
      <p className="theme-muted text-[10px] leading-relaxed">{result.message}</p>

      <div className="flex flex-col gap-1 pt-1">
        {result.checks.map((check) => (
          <div key={check.id} className="flex items-start gap-2">
            <span className="text-[10px] leading-4" style={{ color: check.status === 'success' ? 'var(--success)' : check.status === 'error' ? 'var(--error)' : 'var(--muted)' }}>
              {check.status === 'success' ? '✓' : check.status === 'error' ? '!' : '·'}
            </span>
            <div className="min-w-0">
              <p className="theme-text text-[10px]">{check.label}</p>
              {check.message && (
                <p className="theme-muted-soft text-[9px] truncate">{check.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="theme-muted text-[10px] font-medium tracking-wide">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="theme-input border rounded-lg px-2.5 py-1.5 text-xs font-mono transition-all focus:outline-none"
      />
    </label>
  )
}
