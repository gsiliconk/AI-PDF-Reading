import { Modal, Button } from 'animal-island-ui'

interface UpdateModalProps {
  open: boolean
  latest: string
  current: string
  releasesUrl: string
  onClose: () => void
  onDismissToday: () => void
}

export default function UpdateModal({
  open, latest, current, releasesUrl, onClose, onDismissToday,
}: UpdateModalProps) {
  const handleDownload = () => {
    window.open(releasesUrl, '_blank')
    onClose()
  }

  return (
    <Modal
      open={open}
      title={`发现新版本 v${latest}`}
      width={420}
      onClose={onDismissToday}
      footer={null}
      maskClosable={false}
      typewriter={false}
    >
      <div style={{ padding: '8px 4px 4px', color: '#725d42' }}>
        <div style={{ marginBottom: '12px', fontSize: '14px', lineHeight: 1.6 }}>
          点击下方按钮前往下载
        </div>
        <div style={{
          fontSize: '12px', color: '#9f927d',
          background: '#f8f4ec', borderRadius: '8px',
          padding: '8px 12px', marginBottom: '16px',
          border: '1px solid #e8e2d6',
        }}>
          <div>当前版本：v{current}</div>
          <div>最新版本：v{latest}</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <Button size="small" onClick={onDismissToday}>暂不</Button>
          <Button type="primary" size="small" onClick={handleDownload}>前往下载</Button>
        </div>
      </div>
    </Modal>
  )
}
