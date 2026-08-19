import React from 'react';

const base = { width: '100%', height: 150, viewBox: '0 0 360 150', role: 'img' };
const stroke = '#0f172a';
const accent = '#dc2626';
const orange = '#f97316';
const muted = '#94a3b8';

function Person({ x = 90, y = 76, scale = 1, facing = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${facing * scale} ${scale})`} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="0" cy="-28" r="8" fill="#fff" />
    <path d="M0-19 L0 12 M0-8 L-17 5 M0-8 L16 2 M0 12 L-12 35 M0 12 L13 35" />
  </g>;
}

export default function StructuralExerciseGraphic({ kind }) {
  const label = {
    discos: 'DISCOS · 2 × 10 kg', kettlebells: 'KETTLEBELLS · 2 × 16 kg', trineu: 'TRINEU · 10 m + 10 m', c: 'RECORREGUT EN C', maniqui: 'MANIQUÍ · 50 kg', sprint: 'ESPRINT FINAL · 10 m',
  }[kind] || 'ESTRUCTURAL';
  return <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
    <svg {...base} aria-label={label}>
      <rect x="0" y="0" width="360" height="150" rx="18" fill="#f8fafc" />
      <text x="18" y="25" fontSize="12" fontWeight="800" fill="#64748b" letterSpacing="1">{label}</text>
      {kind === 'discos' && <g>
        <path d="M38 116 H322" stroke={muted} strokeWidth="4" />
        <Person x={115} y={96} />
        <circle cx="96" cy="80" r="13" fill="#334155" /><circle cx="134" cy="80" r="13" fill="#334155" />
        <path d="M96 80 L115 55 L134 80" fill="none" stroke={accent} strokeWidth="4" />
        <rect x="225" y="82" width="45" height="34" rx="5" fill="#f1f5f9" stroke={stroke} strokeWidth="4" />
        <path d="M248 82 V55" stroke={stroke} strokeWidth="4" /><path d="M238 60 L248 48 L258 60" fill="none" stroke={orange} strokeWidth="4" />
        <path d="M65 52 H150" stroke={accent} strokeWidth="4" /><path d="M65 52 l10-6 M65 52 l10 6 M150 52 l-10-6 M150 52 l-10 6" stroke={accent} strokeWidth="3" fill="none" />
        <text x="82" y="45" fontSize="11" fill={accent} fontWeight="700">transport + step-ups</text>
      </g>}
      {kind === 'kettlebells' && <g>
        <path d="M25 116 H335" stroke={muted} strokeWidth="4" />
        <Person x={180} y={91} />
        <path d="M151 62 q-13-25 4-34 q18-8 25 11 q7-19 25-11 q17 9 4 34" fill="none" stroke={stroke} strokeWidth="5" />
        <path d="M154 68 q-16-2-18 13 q0 14 15 14 h18 q14 0 14-14 q-2-15-18-13z" fill="#f97316" stroke={stroke} strokeWidth="4" />
        <path d="M194 68 q-16-2-18 13 q0 14 15 14 h18 q14 0 14-14 q-2-15-18-13z" fill="#f97316" stroke={stroke} strokeWidth="4" />
        <path d="M145 42 L120 58 M215 42 L240 58" stroke={accent} strokeWidth="4" markerEnd="url(#arrow)" />
      </g>}
      {kind === 'trineu' && <g>
        <path d="M22 116 H338" stroke={muted} strokeWidth="4" />
        <g transform="translate(90 88)"><path d="M-18 25 L42 25 L55 12" fill="none" stroke={stroke} strokeWidth="6" /><path d="M-5 25 L-20 38 M28 25 L15 38" stroke={stroke} strokeWidth="5" /><rect x="4" y="-5" width="28" height="20" rx="4" fill="#f97316" stroke={stroke} strokeWidth="4" /></g>
        <Person x={62} y={92} facing={-1} /><path d="M55 79 Q75 65 93 70" fill="none" stroke={accent} strokeWidth="4" />
        <path d="M120 48 H235" stroke={accent} strokeWidth="4" /><path d="M120 48 l10-6 M120 48 l10 6 M235 48 l-10-6 M235 48 l-10 6" stroke={accent} strokeWidth="3" />
        <text x="158" y="40" fontSize="12" fill={accent} fontWeight="800">10 m</text>
        <path d="M270 70 H325" stroke="#16a34a" strokeWidth="4" /><path d="M270 70 l10-6 M270 70 l10 6" stroke="#16a34a" strokeWidth="3" /><text x="274" y="62" fontSize="10" fill="#16a34a" fontWeight="700">EMPÈNYER</text>
      </g>}
      {kind === 'c' && <g>
        <path d="M70 55 Q55 55 55 75 V100 Q55 120 75 120 H275 Q295 120 295 100 V75 Q295 55 275 55" fill="none" stroke={orange} strokeWidth="12" strokeLinecap="round" />
        <path d="M90 78 H265" stroke={accent} strokeWidth="4" strokeDasharray="9 8" />
        <Person x={115} y={84} scale={0.8} />
        <path d="M125 73 L155 73" stroke={accent} strokeWidth="4" markerEnd="url(#arrow)" />
        <text x="123" y="45" fontSize="12" fill="#64748b" fontWeight="800">SOTA TANQUES</text>
      </g>}
      {kind === 'maniqui' && <g>
        <path d="M22 116 H338" stroke={muted} strokeWidth="4" />
        <Person x={120} y={88} facing={-1} />
        <g transform="translate(178 96) rotate(-8)"><circle cx="0" cy="-25" r="10" fill="#fbbf24" stroke={stroke} strokeWidth="4" /><path d="M0-14 L0 23 M0-4 L-17 10 M0-4 L17 10 M0 23 L-12 43 M0 23 L12 43" fill="none" stroke={stroke} strokeWidth="7" strokeLinecap="round" /></g>
        <path d="M135 86 C155 92 164 95 177 99" fill="none" stroke={accent} strokeWidth="4" strokeDasharray="7 6" />
        <path d="M72 52 H215" stroke={accent} strokeWidth="4" /><path d="M72 52 l10-6 M72 52 l10 6 M215 52 l-10-6 M215 52 l-10 6" stroke={accent} strokeWidth="3" />
        <text x="115" y="44" fontSize="11" fill={accent} fontWeight="800">ARROSSEGAR</text>
      </g>}
      {kind === 'sprint' && <g>
        <path d="M30 116 H330" stroke={muted} strokeWidth="4" />
        {Array.from({length: 11}, (_, i) => <path key={i} d={`M${55+i*24} 110 V122`} stroke={muted} strokeWidth="2" />)}
        <Person x={88} y={90} scale={1.05} />
        <path d="M110 67 C155 52 215 52 285 67" fill="none" stroke={accent} strokeWidth="5" />
        <path d="M285 67 l-13-8 M285 67 l-15 5" stroke={accent} strokeWidth="4" />
        <path d="M70 45 H290" stroke={accent} strokeWidth="4" /><path d="M70 45 l10-6 M70 45 l10 6 M290 45 l-10-6 M290 45 l-10 6" stroke={accent} strokeWidth="3" />
        <text x="168" y="38" fontSize="13" fill={accent} fontWeight="900">10 m · SPRINT</text>
      </g>}
      <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill={accent} /></marker></defs>
    </svg>
  </div>;
}
