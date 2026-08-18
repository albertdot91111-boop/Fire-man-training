import { analyzeBomberAthlete, buildTodayPlan, coachBrief } from './src/bomberCoach.js';

let pass = 0;
let fail = 0;
function check(name, condition) {
    if (condition) { pass += 1; console.log(`✓ ${name}`); }
    else { fail += 1; console.log(`✗ ${name}`); }
}

const sessions = [
    { type: 'forestal', date: '2026-08-10', duration: 4, penalties: 0 },
    { type: 'forestal', date: '2026-08-17', duration: 3.5, penalties: 0 },
    { type: 'estructural', date: '2026-08-12', duration: 3, penalties: 0 },
    { type: 'estructural', date: '2026-08-18', duration: 3, penalties: 2 },
];

const analysis = analyzeBomberAthlete({ sessions, goals: [] });
check('returns all three tests', analysis.tests.length === 3);
check('structural has a numeric grade', analysis.tests.find((x) => x.type === 'estructural')?.latestGrade !== null);
check('penalties are detected', analysis.tests.find((x) => x.type === 'estructural')?.latestPenalties === 2);
check('technical readiness wins over normal', analysis.readiness === 'technical');
check('weakest test is selected by grade', Boolean(analysis.weakest?.type));

const plan = buildTodayPlan({ sessions, minutes: 40, material: ['kettlebell 16 kg', 'slam ball'] });
check('plan respects requested duration approximately', plan.blocks.length >= 3);
check('plan carries warnings', plan.warnings.length > 0);
check('plan carries material', plan.materialUsed.includes('kettlebell 16 kg'));

const brief = coachBrief({ sessions, minutes: 30 });
check('brief contains a priority', brief.text.includes('Prioritat:'));
check('brief contains grade information', brief.text.includes('/10'));

console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
