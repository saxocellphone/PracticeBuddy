import styles from './MicSelector.module.css'

interface MicSelectorProps {
  devices: MediaDeviceInfo[]
  currentDeviceId: string
  onDeviceChange: (deviceId: string) => void
}

export function MicSelector({
  devices,
  currentDeviceId,
  onDeviceChange,
}: MicSelectorProps) {
  if (devices.length === 0) return null

  return (
    <div className={styles.container}>
      <label className={styles.label} htmlFor="mic-select">
        Input Device
      </label>
      <select
        id="mic-select"
        className={styles.select}
        value={currentDeviceId}
        onChange={(e) => onDeviceChange(e.target.value)}
      >
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label || `Microphone (${device.deviceId.slice(0, 8)})`}
          </option>
        ))}
      </select>
    </div>
  )
}
