import type { JSX } from 'react'
import type { AnalyzeResult } from '../utils/output-types'

interface FlowAnalysisPanelProps {
  analyzeResult: AnalyzeResult
}

export default function FlowAnalysisPanel({ analyzeResult }: FlowAnalysisPanelProps): JSX.Element | null {
  const { flow, ideas } = analyzeResult
  if (!flow) return null

  return (
    <div style={{ padding: '8px 16px', borderBottom: '1px solid #111', background: '#060608', flexShrink: 0 }}>
      {/* Confidence label */}
      {flow.confidence && (
        <div style={{ marginBottom: 6 }}>
          <span style={{
            fontSize: 8, letterSpacing: 1, padding: '1px 6px', borderRadius: 2,
            color: flow.confidence === 'high' ? '#6a6' : flow.confidence === 'medium' ? '#aa6' : '#a66',
            background: flow.confidence === 'high' ? '#0a1a0a' : flow.confidence === 'medium' ? '#1a1a0a' : '#1a0a0a',
            border: `1px solid ${flow.confidence === 'high' ? '#1a3a1a' : flow.confidence === 'medium' ? '#3a3a1a' : '#3a1a1a'}`,
          }}>
            CONFIDENCE: {flow.confidence.toUpperCase()}
          </span>
        </div>
      )}

      {/* Changes since last */}
      {flow.changesSinceLast && (
        <div style={{
          marginBottom: 6, padding: '4px 8px', borderRadius: 3,
          background: '#0a0a0a', border: '1px solid #1a1a1a',
        }}>
          <span style={{ fontSize: 8, color: '#444', letterSpacing: 1 }}>CHANGES SINCE LAST</span>
          <div style={{ fontSize: 10, color: '#777', marginTop: 2, lineHeight: 1.5 }}>{flow.changesSinceLast}</div>
        </div>
      )}

      {/* Connections */}
      {flow.connections && flow.connections.length > 0 && (
        <div style={{
          marginBottom: 6, padding: '6px 8px', borderRadius: 3,
          background: '#080810', border: '1px solid #1a1a2a',
        }}>
          <span style={{ fontSize: 8, color: '#668', letterSpacing: 1 }}>CONNECTIONS</span>
          {flow.connections.map((conn, i) => {
            const fromColor = conn.fromCell.toLowerCase().includes('supply') ? '#cc6666'
              : conn.fromCell.toLowerCase().includes('will') ? '#66cc88'
              : conn.fromCell.toLowerCase().includes('stimulus') ? '#6688cc'
              : '#999'
            const toColor = conn.toCell.toLowerCase().includes('supply') ? '#cc6666'
              : conn.toCell.toLowerCase().includes('will') ? '#66cc88'
              : conn.toCell.toLowerCase().includes('stimulus') ? '#6688cc'
              : '#999'
            return (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4, lineHeight: 1.5 }}>
                <span style={{ fontSize: 10, color: fromColor, fontFamily: 'monospace', flexShrink: 0 }}>{conn.fromCell}</span>
                <span style={{ fontSize: 10, color: '#444', flexShrink: 0 }}>&rarr;</span>
                <span style={{ fontSize: 10, color: toColor, fontFamily: 'monospace', flexShrink: 0 }}>{conn.toCell}</span>
                <span style={{ fontSize: 10, color: '#888' }}>{conn.insight}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Human Questions */}
      {flow.humanQuestions && flow.humanQuestions.length > 0 && (
        <div style={{
          marginBottom: 6, padding: '6px 8px', borderRadius: 3,
          background: '#0d0a00', border: '1px solid #332a00',
        }}>
          <span style={{ fontSize: 8, color: '#aa8800', letterSpacing: 1, fontWeight: 700 }}>YOUR DECISION NEEDED</span>
          {flow.humanQuestions.map((q, i) => (
            <div key={i} style={{ fontSize: 11, color: '#ddaa00', lineHeight: 1.6, marginTop: 3, paddingLeft: 8 }}>
              {q}
            </div>
          ))}
        </div>
      )}

      {/* Priority cell */}
      {flow.priorityCell && (
        <div style={{
          marginBottom: 6, padding: '4px 8px', borderRadius: 3,
          background: '#0d0a00', border: '1px solid #332a00',
        }}>
          <span style={{ fontSize: 8, color: '#665500', letterSpacing: 1 }}>NEXT HUMAN ACTION NEEDED</span>
          <div style={{ fontSize: 11, color: '#ddaa00', marginTop: 2 }}>{flow.priorityCell}</div>
        </div>
      )}

      {/* Blocked cells */}
      {flow.blockedCells && flow.blockedCells.length > 0 && (
        <div style={{ marginBottom: 6, display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 8, color: '#664444', letterSpacing: 1 }}>BLOCKED:</span>
          {flow.blockedCells.map((cell, i) => (
            <span key={i} style={{
              fontSize: 10, color: '#cc6666', padding: '1px 6px',
              background: '#1a0a0a', border: '1px solid #331a1a', borderRadius: 2,
            }}>{cell}</span>
          ))}
        </div>
      )}

      {/* Flow details */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginTop: 4 }}>
        <div>
          <span style={{ fontSize: 8, color: '#446', letterSpacing: 1 }}>STIMULUS &rarr; WILL</span>
          <div style={{ fontSize: 10, color: '#999', lineHeight: 1.5, marginTop: 1 }}>{flow.stimuliToWill}</div>
        </div>
        <div>
          <span style={{ fontSize: 8, color: '#446', letterSpacing: 1 }}>WILL &rarr; SUPPLY</span>
          <div style={{ fontSize: 10, color: '#999', lineHeight: 1.5, marginTop: 1 }}>{flow.willToSupply}</div>
        </div>
        <div>
          <span style={{ fontSize: 8, color: '#644', letterSpacing: 1 }}>STUCK</span>
          <div style={{ fontSize: 10, color: flow.stuck.toLowerCase() === 'none' ? '#555' : '#cc8866', lineHeight: 1.5, marginTop: 1 }}>{flow.stuck}</div>
        </div>
        <div>
          <span style={{ fontSize: 8, color: '#464', letterSpacing: 1 }}>NEXT</span>
          <div style={{ fontSize: 10, color: '#aaa', lineHeight: 1.5, marginTop: 1 }}>{flow.next}</div>
        </div>
      </div>

      {/* Ideas */}
      {ideas.length > 0 && (
        <div style={{ marginTop: 6, borderTop: '1px solid #111', paddingTop: 4 }}>
          <span style={{ fontSize: 8, color: '#446', letterSpacing: 1 }}>IDEAS</span>
          {ideas.map((idea, i) => (
            <div key={i} style={{ fontSize: 10, color: '#888', lineHeight: 1.5, paddingLeft: 8 }}>- {idea}</div>
          ))}
        </div>
      )}
    </div>
  )
}
