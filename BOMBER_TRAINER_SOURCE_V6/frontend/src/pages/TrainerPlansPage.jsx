import React from 'react';
import Helmet from 'react-helmet';
import AppShell from '@/components/AppShell';

export default function TrainerPlansPage() {
  return <AppShell title="PAUTES ENTRENADOR"><Helmet><title>Pautes de l’entrenador — BOMBER TRAINER</title></Helmet><section className="rounded-3xl bg-slate-900 p-5 text-white"><p className="text-xs font-black tracking-widest text-orange-300">PAUTES GUARDADES</p><h1 className="mt-2 text-2xl font-black">Pautes de l’entrenador</h1><p className="mt-2 text-sm text-slate-200">Biblioteca de sessions de treball guardades dins BOMBER TRAINER.</p></section></AppShell>;
}
