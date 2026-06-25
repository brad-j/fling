import { useState, useEffect } from 'react'
import type { FlingSettings } from '../../../main/types'

export default function SettingsPanel() {
  const [settings, setSettings] = useState<FlingSettings | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    window.fling.getSettings().then(setSettings)
  }, [])

  const handleChange = (field: keyof FlingSettings, value: string | number) => {
    if (!settings) return
    setSettings({ ...settings, [field]: value })
  }

  const handleSave = async () => {
    if (!settings) return
    await window.fling.updateSettings(settings)
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center p-8">
        <p className="text-xs text-white/30">Loading...</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4 animate-fade-in">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/30">
        Connection
      </h2>

      <Field
        label="Host"
        value={settings.host}
        onChange={(v) => handleChange('host', v)}
        placeholder="zedd or 100.x.x.x"
      />

      <div className="grid grid-cols-2 gap-2">
        <Field
          label="Port"
          value={String(settings.port)}
          onChange={(v) => handleChange('port', parseInt(v) || 22)}
          placeholder="22"
        />
        <Field
          label="Username"
          value={settings.username}
          onChange={(v) => handleChange('username', v)}
          placeholder="brad"
        />
      </div>

      <Field
        label="Remote Path"
        value={settings.remotePath}
        onChange={(v) => handleChange('remotePath', v)}
        placeholder="~/shared"
      />

      <Field
        label="SSH Key Path"
        value={settings.keyPath}
        onChange={(v) => handleChange('keyPath', v)}
        placeholder="~/.ssh/id_ed25519"
      />

      <div className="h-px bg-white/5 my-1" />

      <h2 className="text-xs font-semibold uppercase tracking-wider text-white/30">
        Screenshots
      </h2>

      <Field
        label="Screenshot Directory"
        value={settings.screenshotDir}
        onChange={(v) => handleChange('screenshotDir', v)}
        placeholder="~/Desktop/screenshots"
      />

      <div className="h-px bg-white/5 my-1" />

      <button
        onClick={handleSave}
        className={`
          w-full py-2 rounded-lg text-xs font-medium transition-all
          ${saved
            ? 'bg-success text-white'
            : 'bg-accent hover:bg-accent-hover text-white'
          }
        `}
      >
        {saved ? '✓ Saved' : 'Save Settings'}
      </button>
    </div>
  )
}

// ─── Reusable Input Field ────────────────────────────────────────────

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
      <span className="text-[10px] text-white/40 font-medium">{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="
          bg-white/[0.04] border border-white/8 rounded-lg px-2.5 py-1.5
          text-xs text-white/90 font-mono
          placeholder:text-white/20
          focus:outline-none focus:border-accent/50 focus:bg-white/[0.06]
          transition-all
        "
      />
    </label>
  )
}
