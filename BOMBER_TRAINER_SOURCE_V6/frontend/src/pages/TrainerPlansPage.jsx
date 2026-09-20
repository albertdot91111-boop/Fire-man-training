import React, { useState } from 'react';
import Helmet from 'react-helmet';
import AppShell from '@/components/AppShell';
import plans from '@/lib/trainerPlans.json';

const categoryClass = (category) => {
  if (category === 'FORÇA') return 'bg-orange-50 border-orange-200';
  if (category === 'NATACIÓ') return 'bg-sky-50 border-sky-200';
  if (category === 'CÓRRER') return 'bg-rose-50 border-rose-200';
  if (category === 'BICI') return 'bg-emerald-50 border-emerald-200';
  return 'bg-violet-50 border-violet-200';
};

export default function TrainerPlansPage() {
  const [filter, setFilter] = useState('TOTS');
  const [open, setOpen] = useState('');
  const categories = ['TOTS', ...Array.from(new Set(plans.map((plan) => plan.category)))];
  const visible = filter === 'TOTS' ? plans : plans.filter((plan) => plan.category === filter);

  return (
    <AppShell title="PAUTES ENTRENADOR">
      <Helmet><title>Pautes de l’entrenador — BOMBER TRAINER</title></Helmet>
      <section className="rounded-3xl bg-slate-900 p-5 text-white shadow-sm">
        <p className="text-xs font-black tracking-[0.2em] text-orange-300">PAUTES GUARDADES</p>
        <h1 className="mt-2 text-2xl font-black">La pauta queda dins l’app.</h1>
        <p className="mt-2 text-sm leading-6 text-slate-200">Sessions copiades de les pautes facilitades perquè les puguis consultar sempre.</p>
        <p className="mt-3 text-xs font-bold text-slate-300">{plans.length} sessions guardades</p>
      </section>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {categories.map((category) => <button key={category} type="button" onClick={() => setFilter(category)} className={`min-h-[44px] shrink-0 rounded-full border px-4 text-xs font-black ${filter === category ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}>{category}</button>)}
      </div>
      <div className="mt-4 space-y-3">
        {visible.map((plan) => {
          const expanded = open === plan.id;
          return <article key={plan.id} className={`overflow-hidden rounded-3xl border shadow-sm ${categoryClass(plan.category)}`}>
            <button type="button" onClick={() => setOpen(expanded ? '' : plan.id)} className="w-full p-5 text-left">
              <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-black tracking-widest text-slate-500">{plan.category}</p><h2 className="mt-1 text-lg font-black text-slate-900">{plan.title}</h2><p className="mt-1 text-sm font-medium text-slate-600">{plan.subtitle}</p></div><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/80 text-xl font-bold">{expanded ? '−' : '+'}</span></div>
            </button>
            {expanded && <div className="border-t border-black/5 bg-white/70 p-4">{plan.sections.map((section) => <section key={section.title} className="mb-3 rounded-2xl border border-slate-200 bg-white p-4 last:mb-0"><h3 className="text-sm font-black uppercase tracking-wider text-slate-500">{section.title}</h3><div className="mt-3 space-y-2">{section.items.map((item) => <div key={item.name} className="rounded-xl bg-slate-50 px-3 py-3"><p className="text-sm font-bold text-slate-800">{item.name}</p>{item.target && <p className="mt-1 text-xs font-extrabold text-slate-500">{item.target}</p>}</div>)}</div></section>)}</div>}
          </article>;
        })}
      </div>
    </AppShell>
  );
}
