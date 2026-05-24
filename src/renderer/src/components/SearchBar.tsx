import { useState, useRef, useEffect } from 'react'
import { Button, Input, Card } from 'animal-island-ui'

interface SearchBarProps {
  isOpen: boolean
  onClose: () => void
  onSearch: (query: string) => void
  onNavigate: (direction: 'prev' | 'next') => void
  currentMatch: number
  totalMatches: number
}

export default function SearchBar({ isOpen, onClose, onSearch, onNavigate, currentMatch, totalMatches }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus()
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    onSearch(e.target.value)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) onNavigate('prev')
      else onNavigate('next')
    }
  }

  if (!isOpen) return null

  return (
    <div style={{
      position: 'absolute',
      top: '12px',
      right: '16px',
      zIndex: 20,
    }}>
      <Card style={{
        padding: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}>
        <Input
          placeholder="搜索..."
          allowClear
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          style={{ width: '200px' }}
        />
        <span style={{
          fontSize: '12px',
          color: '#9f927d',
          minWidth: '60px',
          textAlign: 'center',
        }}>
          {totalMatches > 0 ? `${currentMatch}/${totalMatches}` : '无结果'}
        </span>
        <Button
          type="default"
          size="small"
          onClick={() => onNavigate('prev')}
          disabled={totalMatches === 0}
        >
          ↑
        </Button>
        <Button
          type="default"
          size="small"
          onClick={() => onNavigate('next')}
          disabled={totalMatches === 0}
        >
          ↓
        </Button>
        <Button type="text" size="small" onClick={onClose}>
          ✕
        </Button>
      </Card>
    </div>
  )
}
