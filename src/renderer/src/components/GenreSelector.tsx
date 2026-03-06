import type { JSX } from 'react'
import type { GenreInfo } from '../utils/output-types'

interface GenreSelectorProps {
  genres: GenreInfo[]
  selected: string | null
  onSelect: (name: string) => void
}

export default function GenreSelector({ genres, selected, onSelect }: GenreSelectorProps): JSX.Element {
  return (
    <div style={{
      padding: '5px 12px', borderBottom: '1px solid #141414',
      display: 'flex', gap: 5, flexWrap: 'wrap', flexShrink: 0,
      background: '#080808',
    }}>
      {genres.map((g) => {
        const active = selected === g.name
        return (
          <button
            key={g.name}
            onClick={() => onSelect(g.name)}
            style={{
              background: active ? '#1a1a1a' : 'none',
              border: `1px solid ${active ? g.color : '#222'}`,
              color: active ? g.color : '#555',
              fontSize: 9, padding: '2px 9px', borderRadius: 3, cursor: 'pointer',
              letterSpacing: 0.5,
            }}
            onMouseEnter={(e) => { if (!active) { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = '#888' } }}
            onMouseLeave={(e) => { if (!active) { e.currentTarget.style.borderColor = '#222'; e.currentTarget.style.color = '#555' } }}
          >
            {g.name}
          </button>
        )
      })}
    </div>
  )
}
