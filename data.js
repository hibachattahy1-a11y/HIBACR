// ════════════════════════════════════════════════════
//  data.js  —  Données Chambords (valeurs réelles)
//  Structure réelle du projet :
//    Bloc 3   → CR 1  à CR 4   — SGTM
//    Bloc 4   → CR 5  à CR 13  — TGCC
//    Bloc 1   → CR 14 à CR 21  — SGTM
//    Bloc 2   → CR 22 à CR 33  — SGTM
//              (CR 23/24/25 Phase 1 = Bloc 2 / Phase 2 = Bloc 2-11)
//    Bloc 2-11→ Phase 2 de CR 23, CR 24, CR 25 — SGTM
//
//  p1tot / p1real = levées Phase 1 prévues / réalisées
//  p2tot / p2real = levées Phase 2 prévues / réalisées
//  p3tot / p3real = levées Phase 3 prévues / réalisées (= 0 actuellement)
//  tot  = p1tot + p2tot + p3tot
//  real = p1real + p2real + p3real
// ════════════════════════════════════════════════════

const BLOCS_LIST  = ['1', '2', '2-11', '3', '4'];
const PHASES_LIST = [1, 2, 3];
const MAX_LEVEE   = 18;   // levée max du projet (CR 25 et CR 26 ont 18 levées)

// ── Données réelles par phase ──────────────────────
// Source : tableau de suivi projet (Gemini)
const _RAW = [
  // ── Bloc 3 — SGTM ──────────────────────────────────
  { id:'CR 1',  bloc:'3', ent:'SGTM', p1tot:4,  p1real:3,  p2tot:9,  p2real:0,  p3tot:1, p3real:0 },
  { id:'CR 2',  bloc:'3', ent:'SGTM', p1tot:4,  p1real:3,  p2tot:9,  p2real:0,  p3tot:2, p3real:0 },
  { id:'CR 3',  bloc:'3', ent:'SGTM', p1tot:4,  p1real:4,  p2tot:9,  p2real:7,  p3tot:1, p3real:0 },
  { id:'CR 4',  bloc:'3', ent:'SGTM', p1tot:4,  p1real:4,  p2tot:9,  p2real:9,  p3tot:1, p3real:0 },
  // ── Bloc 4 — TGCC ──────────────────────────────────
  { id:'CR 5',  bloc:'4', ent:'TGCC', p1tot:3,  p1real:2,  p2tot:9,  p2real:0,  p3tot:1, p3real:0 },
  { id:'CR 6',  bloc:'4', ent:'TGCC', p1tot:3,  p1real:2,  p2tot:9,  p2real:0,  p3tot:2, p3real:0 },
  { id:'CR 7',  bloc:'4', ent:'TGCC', p1tot:3,  p1real:2,  p2tot:9,  p2real:0,  p3tot:3, p3real:0 },
  { id:'CR 8',  bloc:'4', ent:'TGCC', p1tot:2,  p1real:2,  p2tot:9,  p2real:0,  p3tot:3, p3real:0 },
  { id:'CR 9',  bloc:'4', ent:'TGCC', p1tot:2,  p1real:2,  p2tot:11, p2real:4,  p3tot:1, p3real:0 },
  { id:'CR 10', bloc:'4', ent:'TGCC', p1tot:2,  p1real:2,  p2tot:9,  p2real:9,  p3tot:3, p3real:0 },
  { id:'CR 11', bloc:'4', ent:'TGCC', p1tot:2,  p1real:2,  p2tot:9,  p2real:9,  p3tot:3, p3real:0 },
  { id:'CR 12', bloc:'4', ent:'TGCC', p1tot:2,  p1real:2,  p2tot:9,  p2real:9,  p3tot:2, p3real:0 },
  { id:'CR 13', bloc:'4', ent:'TGCC', p1tot:2,  p1real:2,  p2tot:9,  p2real:9,  p3tot:1, p3real:0 },
  // ── Bloc 1 — SGTM ──────────────────────────────────
  { id:'CR 14', bloc:'1', ent:'SGTM', p1tot:2,  p1real:2,  p2tot:9,  p2real:9,  p3tot:1, p3real:0 },
  { id:'CR 15', bloc:'1', ent:'SGTM', p1tot:2,  p1real:2,  p2tot:9,  p2real:9,  p3tot:1, p3real:0 },
  { id:'CR 16', bloc:'1', ent:'SGTM', p1tot:3,  p1real:3,  p2tot:9,  p2real:9,  p3tot:2, p3real:0 },
  { id:'CR 17', bloc:'1', ent:'SGTM', p1tot:3,  p1real:3,  p2tot:9,  p2real:6,  p3tot:1, p3real:0 },
  { id:'CR 18', bloc:'1', ent:'SGTM', p1tot:4,  p1real:4,  p2tot:9,  p2real:3,  p3tot:1, p3real:0 },
  { id:'CR 19', bloc:'1', ent:'SGTM', p1tot:4,  p1real:4,  p2tot:9,  p2real:0,  p3tot:3, p3real:0 },
  { id:'CR 20', bloc:'1', ent:'SGTM', p1tot:4,  p1real:4,  p2tot:9,  p2real:0,  p3tot:1, p3real:0 },
  { id:'CR 21', bloc:'1', ent:'SGTM', p1tot:4,  p1real:3,  p2tot:9,  p2real:0,  p3tot:3, p3real:0 },
  // ── Bloc 2 — SGTM ──────────────────────────────────
  { id:'CR 22', bloc:'2', ent:'SGTM', p1tot:4,  p1real:2,  p2tot:9,  p2real:0,  p3tot:1, p3real:0 },
  { id:'CR 23', bloc:'2', ent:'SGTM', p1tot:4,  p1real:2,  p2tot:9,  p2real:0,  p3tot:1, p3real:0 },
  { id:'CR 24', bloc:'2', ent:'SGTM', p1tot:4,  p1real:4,  p2tot:11, p2real:2,  p3tot:2, p3real:0 },
  { id:'CR 25', bloc:'2', ent:'SGTM', p1tot:4,  p1real:2,  p2tot:13, p2real:0,  p3tot:1, p3real:0 },
  { id:'CR 26', bloc:'2', ent:'SGTM', p1tot:4,  p1real:4,  p2tot:13, p2real:6,  p3tot:1, p3real:0 },
  { id:'CR 27', bloc:'2', ent:'SGTM', p1tot:4,  p1real:4,  p2tot:11, p2real:11, p3tot:2, p3real:0 },
  { id:'CR 28', bloc:'2', ent:'SGTM', p1tot:4,  p1real:4,  p2tot:9,  p2real:9,  p3tot:1, p3real:0 },
  { id:'CR 29', bloc:'2', ent:'SGTM', p1tot:4,  p1real:4,  p2tot:9,  p2real:0,  p3tot:1, p3real:0 },
  { id:'CR 30', bloc:'2', ent:'SGTM', p1tot:4,  p1real:2,  p2tot:9,  p2real:0,  p3tot:3, p3real:0 },
  { id:'CR 31', bloc:'2', ent:'SGTM', p1tot:4,  p1real:2,  p2tot:9,  p2real:0,  p3tot:1, p3real:0 },
  { id:'CR 32', bloc:'2', ent:'SGTM', p1tot:4,  p1real:2,  p2tot:9,  p2real:0,  p3tot:3, p3real:0 },
  { id:'CR 33', bloc:'2', ent:'SGTM', p1tot:4,  p1real:2,  p2tot:9,  p2real:0,  p3tot:1, p3real:0 },
];

// ── Blocs mixtes : CR 23/24/25 ───────────────────────
// Phase 1 (levées 1..p1tot) → Bloc 2  |  Phase 2+ → Bloc 2-11
const LEVEE_BLOC_RULES = {
  'CR 23': (n, phase) => phase === 1 ? '2' : '2-11',
  'CR 24': (n, phase) => phase === 1 ? '2' : '2-11',
  'CR 25': (n, phase) => phase === 1 ? '2' : '2-11',
};

// ── Génération des levées ────────────────────────────
const CHAMBORDS = _RAW.map(c => {
  const tot   = c.p1tot + c.p2tot + c.p3tot;
  const real  = c.p1real + c.p2real + c.p3real;
  const levees = [];
  const blocRule = LEVEE_BLOC_RULES[c.id] || null;

  for (let n = 1; n <= tot; n++) {
    // Phase calculée depuis les bornes par CR (pas de règle globale)
    const phase = n <= c.p1tot ? 1
                : n <= c.p1tot + c.p2tot ? 2
                : 3;
    const bloc  = blocRule ? blocRule(n, phase) : c.bloc;
    levees.push({ num: n, phase, bloc, realisee: n <= real });
  }

  const blocs = [...new Set(levees.map(l => l.bloc))];
  return { ...c, tot, real, levees, blocs };
});

CHAMBORDS.sort((a, b) =>
  parseInt(a.id.replace(/\D/g, '')) - parseInt(b.id.replace(/\D/g, ''))
);

// ── Totaux globaux ───────────────────────────────────
const GRAND_TOTAL = CHAMBORDS.reduce((s, c) => s + c.tot, 0);

function computeGrandReal() {
  return CHAMBORDS.reduce((s, c) =>
    s + c.levees.filter(l => l.realisee).length, 0);
}
