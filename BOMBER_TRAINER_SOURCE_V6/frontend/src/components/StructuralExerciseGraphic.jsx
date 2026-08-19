import React from 'react';

const base = { width: '100%', height: 190, viewBox: '0 0 420 190', role: 'img' };
const stroke = '#0f172a';
const accent = '#dc2626';
const orange = '#f97316';
const green = '#16a34a';
const muted = '#94a3b8';
const light = '#f8fafc';

function Person({ x = 90, y = 108, scale = 1, facing = 1 }) {
  return <g transform={`translate(${x} ${y}) scale(${facing * scale} ${scale})`} fill="none" stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="0" cy="-30" r="10" fill="white" />
    <path d="M0-19 L0 16 M0-8 L-20 7 M0-8 L20 5 M0 16 L-15 43 M0 16 L16 43" />
  </g>;
}

function Arrow({ x1, y1, x2, y2, color = accent }) {
  return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="5" strokeLinecap="round" markerEnd="url(#arrow)" />;
}

export default function StructuralExerciseGraphic({ kind }) {
  const label = {
    discos: 'DISCOS · 2 × 10 kg',
    kettlebells: 'KETTLEBELLS · 2 × 16 kg',
    trineu: 'TRINEU · 10 m + 10 m',
    c: 'RECORREGUT EN C · SOTA TANQUES',
    maniqui: 'ARROSSEGAMENT · MANIQUÍ 50 kg',
    sprint: 'ESPRINT FINAL · 10 m',
  }[kind] || 'ESTRUCTURAL';

  return <div className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2 shadow-inner">
    <svg {...base} aria-label={label}>
      <rect x="0" y="0" width="420" height="190" rx="18" fill={light} />
      <text x="20" y="28" fontSize="13" fontWeight="900" fill="#475569" letterSpacing="1">{label}</text>

      {kind === 'discos' && <g>
        <path d="M25 148 H395" stroke={muted} strokeWidth="5" />
        <Person x={115} y={121} />
        <circle cx="92" cy="101" r="17" fill="#334155" /><circle cx="145" cy="101" r="17" fill="#334155" />
        <path d="M92 101 L115 72 L145 101" fill="none" stroke={accent} strokeWidth="5" />
        <text x="72" y="177" fontSize="11" fontWeight="800" fill="#64748b">TRANSPORT</text>
        <rect x="285" y="108" width="55" height="40" rx="5" fill="#e2e8f0" stroke={stroke} strokeWidth="5" />
        <path d="M312 108 V75" stroke={stroke} strokeWidth="5" />
        <Arrow x1="272" y1="70" x2="272" y2="105" color={green} />
        <text x="295" y="177" fontSize="11" fontWeight="800" fill={green}>STEP-UP</text>
        <path d="M65 54 H165" stroke={accent} strokeWidth="4" />
        <path d="M65 54 l10-7 M65 54 l10 7 M165 54 l-10-7 M165 54 l-10 7" stroke={accent} strokeWidth="3" />
        <text x="82" y="45" fontSize="11" fill={accent} fontWeight="900">2 × 10 kg</text>
      </g>}

      {kind === 'kettlebells' && <g>
        <path d="M25 148 H395" stroke={muted} strokeWidth="5" />
        <Person x={210} y={121} />
        <g fill={orange} stroke={stroke} strokeWidth="5">
          <path d="M157 88 q-12-34 11-44 q24-10 32 17 q8-27 32-17 q23 10 11 44" fill="none" />
          <path d="M150 92 q-17-2-20 18 q0 18 18 18 h26 q17 0 17-18 q-3-20-20-18z" />
          <path d="M215 92 q-17-2-20 18 q0 18 18 18 h26 q17 0 17-18 q-3-20-20-18z" />
        </g>
        <Arrow x1="140" y1="65" x2="156" y2="88" />
        <Arrow x1="275" y1="65" x2="257" y2="88" />
        <text x="158" y="177" fontSize="12" fontWeight="900" fill={orange}>2 × 16 kg · TRANSPORT</text>
      </g>}

      {kind === 'trineu' && <g>
        <path d="M25 148 H395" stroke={muted} strokeWidth="5" />
        <g transform="translate(225 118)">
          <path d="M-35 27 L48 27 L63 12" fill="none" stroke={stroke} strokeWidth="8" strokeLinecap="round" />
          <path d="M-18 27 L-33 43 M28 27 L13 43" stroke={stroke} strokeWidth="6" />
          <rect x="-5" y="-12" width="38" height="28" rx="5" fill={orange} stroke={stroke} strokeWidth="5" />
        </g>
        <Person x={142} y={123} facing={-1} />
        <Arrow x1="112" y1="91" x2="62" y2="91" />
        <text x="55" y="76" fontSize="12" fontWeight="900" fill={accent}>ESTIRAR 10 m</text>
        <Arrow x1="290" y1="76" x2="355" y2="76" color={green} />
        <text x="292" y="61" fontSize="12" fontWeight="900" fill={green}>EMPÈNYER 10 m</text>
      </g>}

      {kind === 'c' && <g>
        <path d="M80 72 H340 M80 72 Q60 72 60 92 V125 Q60 145 82 145 H338 Q360 145 360 125 V92 Q360 72 340 72" fill="none" stroke={orange} strokeWidth="14" strokeLinecap="round" />
        <path d="M95 103 H325" stroke={accent} strokeWidth="5" strokeDasharray="10 9" />
        <Person x={120} y={109} scale={0.72} />
        <Arrow x1="135" y1="99" x2="180" y2="99" />
        <Arrow x1="275" y1="99" x2="320" y2="99" />
        <text x="161" y="48" fontSize="13" fontWeight="900" fill={orange}>SOTA LES TANQUES</text>
        <text x="105" y="172" fontSize="11" fontWeight="800" fill="#64748b">ENTRADA → RECORREGUT EN C → SORTIDA</text>
      </g>}

      {kind === 'maniqui' && <g>
        <path d="M25 148 H395" stroke={muted} strokeWidth="5" />
        <Person x={105} y={119} facing={-1} />
        <g transform="translate(195 124) rotate(-12)">
          <circle cx="0" cy="-30" r="12" fill="#fbbf24" stroke={stroke} strokeWidth="5" />
          <path d="M0-16 L0 25 M0-5 L-22 10 M0-5 L22 10 M0 25 L-15 48 M0 25 L15 48" fill="none" stroke={stroke} strokeWidth="8" strokeLinecap="round" />
        </g>
        <Arrow x1="135" y1="103" x2="178" y2="112" />
        <path d="M70 62 H230" stroke={accent} strokeWidth="4" />
        <path d="M70 62 l10-7 M70 62 l10 7 M230 62 l-10-7 M230 62 l-10 7" stroke={accent} strokeWidth="3" />
        <text x="125" y="52" fontSize="12" fill={accent} fontWeight="900">50 kg</text>
        <text x="139" y="177" fontSize="12" fill="#64748b" fontWeight="900">ARROSSEGAR</text>
      </g>}

      {kind === 'sprint' && <g>
        <path d="M25 148 H395" stroke={muted} strokeWidth="5" />
        {Array.from({ length: 15 }, (_, i) => <path key={i} d={`M${35 + i * 25} 140 V156`} stroke={muted} strokeWidth="2" />)}
        <Person x={112} y={120} scale={1.05} />
        <Arrow x1="150" y1="83" x2="345" y2="83" />
        <path d="M80 58 H350" stroke={accent} strokeWidth="4" />
        <path d="M80 58 l10-6 M80 58 l10 6 M350 58 l-10-6 M350 58 l-10 6" stroke={accent} strokeWidth="3" />
        <text x="184" y="48" fontSize="14" fill={accent} fontWeight="900">10 m · SPRINT FINAL</text>
        <text x="171" y="177" fontSize="11" fill="#64748b" fontWeight="800">SORTIDA → MÀXIMA VELOCITAT → META</text>
      </g>}

      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={accent} />
        </marker>
      </defs>
    </svg>
  </div>;
}
