// ════════════════════════════════════════════════════
//  dashboard.js  —  Filtres, stats, tableau, chart
//  Multi-select pour Bloc, Chambord, Phase, Levée
//  Logique : OR intra-filtre, AND inter-filtres
//  Bloc+Phase+Levée sont évalués au niveau de la levée
//  (une levée doit satisfaire SIMULTANÉMENT les trois)
// ════════════════════════════════════════════════════

let filtered      = [...CHAMBORDS];
let blocChartInst = null;
let donutChartInst = null;

// ── Init ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setDate();
  populateFilters();
  refresh();

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.ms-wrap')) {
      document.querySelectorAll('.ms-dropdown').forEach(d => d.style.display = 'none');
      document.querySelectorAll('.ms-wrap').forEach(w => w.classList.remove('ms-open'));
    }
  });
});

function setDate() {
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  document.getElementById('dateChip').textContent =
    `📅 ${p(d.getDate())}/${p(d.getMonth()+1)}/${d.getFullYear()}`;
}

// ════════════════════════════════════════════════════
//  MULTI-SELECT HELPERS
// ════════════════════════════════════════════════════

function toggleMs(event, id) {
  event.stopPropagation();
  const wrap = document.getElementById(id);
  const dd   = document.getElementById(id + 'Dropdown');
  const isOpen = dd.style.display !== 'none';
  document.querySelectorAll('.ms-dropdown').forEach(d => d.style.display = 'none');
  document.querySelectorAll('.ms-wrap').forEach(w => w.classList.remove('ms-open'));
  if (!isOpen) {
    dd.style.display = 'block';
    wrap.classList.add('ms-open');
  }
}

function onMsChange(id) {
  const vals = getMsSelectedValues(id);
  const display = document.getElementById(id + 'Display');
  if (display) {
    if (vals.length === 0)       display.textContent = 'Tout';
    else if (vals.length <= 3)   display.textContent = vals.join(', ');
    else                         display.textContent = vals.length + ' sélect.';
  }
  refresh();
}

function getMsSelectedValues(id) {
  const wrap = document.getElementById(id);
  if (!wrap) return [];
  return Array.from(wrap.querySelectorAll('input[type=checkbox]:checked'))
    .map(cb => cb.value);
}

// ── Peupler les selects dynamiques ───────────────────
function populateFilters() {
  // Chambords
  const msC = document.getElementById('msChambordDropdown');
  if (msC) {
    CHAMBORDS.forEach(c => {
      const label = document.createElement('label');
      label.className = 'ms-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = c.id;
      cb.onchange = () => onMsChange('msChambord');
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + c.id));
      msC.appendChild(label);
    });
  }
  // Levées
  const msL = document.getElementById('msLeveeDropdown');
  if (msL) {
    for (let i = 1; i <= MAX_LEVEE; i++) {
      const label = document.createElement('label');
      label.className = 'ms-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = String(i);
      cb.onchange = () => onMsChange('msLevee');
      label.appendChild(cb);
      label.appendChild(document.createTextNode(' ' + i));
      msL.appendChild(label);
    }
  }
}

// ════════════════════════════════════════════════════
//  HELPER : est-ce qu'une levée satisfait les filtres
//  Bloc + Phase + Levée en même temps ?
// ════════════════════════════════════════════════════
function leveeMatchesBlocPhase(l, blocArr, phaseArr, leveeArr) {
  if (blocArr.length  && !blocArr.includes(l.bloc))         return false;
  if (phaseArr.length && !phaseArr.includes(l.phase))       return false;
  if (leveeArr.length && !leveeArr.includes(l.num))         return false;
  return true;
}

// ════════════════════════════════════════════════════
//  FILTRES + REFRESH
// ════════════════════════════════════════════════════
function refresh() {
  const ent    = document.getElementById('fEnt').value;
  const statut = document.getElementById('fStatut').value;

  const blocArr  = getMsSelectedValues('msBloc');
  const chbdArr  = getMsSelectedValues('msChambord');
  const phaseArr = getMsSelectedValues('msPhase').map(Number);
  const leveeArr = getMsSelectedValues('msLevee').map(Number);

  // ── Filtrage ────────────────────────────────────────
  filtered = CHAMBORDS.filter(c => {
    // Entreprise
    if (ent && c.ent !== ent) return false;
    // Chambord
    if (chbdArr.length && !chbdArr.includes(c.id)) return false;

    // Bloc + Phase + Levée : au moins UNE levée du chambord
    // satisfait SIMULTANÉMENT les trois critères cochés
    const needLeveeCheck = blocArr.length || phaseArr.length || leveeArr.length;
    if (needLeveeCheck) {
      const ok = c.levees.some(l => leveeMatchesBlocPhase(l, blocArr, phaseArr, leveeArr));
      if (!ok) return false;
    }

    // Statut basé sur l.realisee (paramètre Revit "levée réalisé") :
    //  "realise"     → AU MOINS une levée avec case cochée dans Revit
    //  "non_realise" → AUCUNE levée cochée dans Revit
    //  ⚠ Utilise l.realisee (Revit) et NON c.real (tableau) → stats non affectées
    if (statut) {
      const hasReal = c.levees.some(l => l.realisee);
      if (statut === 'realise'     && !hasReal) return false;
      if (statut === 'non_realise' &&  hasReal) return false;
    }
    return true;
  });

  // ── Rendu ────────────────────────────────────────────
  renderStats();
  renderBlocChart();
  renderTable(filtered, phaseArr, leveeArr, blocArr);

  // ── Compteur levées filtrées ─────────────────────────
  let cnt = 0;
  filtered.forEach(c => {
    cnt += c.levees.filter(l => leveeMatchesBlocPhase(l, blocArr, phaseArr, leveeArr)).length;
  });
  // Si aucun filtre levée actif → afficher total chambords filtrés
  if (!blocArr.length && !phaseArr.length && !leveeArr.length) {
    cnt = filtered.reduce((s, c) => s + c.tot, 0);
  }
  document.getElementById('fltCount').textContent = cnt + ' levées';

  // ── Sync viewer ──────────────────────────────────────
  syncViewer({ bloc: blocArr, ent, chbd: chbdArr, phase: phaseArr, levee: leveeArr, statut });
}

// ── Filtre rapide Entreprise ──────────────────────────
function filterByEnt(val) {
  const sel = document.getElementById('fEnt');
  sel.value = (sel.value === val) ? '' : val;
  refresh();
}

// ── Reset complet ─────────────────────────────────────
function resetAll() {
  ['fEnt', 'fStatut'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  ['msBloc', 'msChambord', 'msPhase', 'msLevee'].forEach(id => {
    const wrap = document.getElementById(id);
    if (wrap) {
      wrap.querySelectorAll('input[type=checkbox]').forEach(cb => cb.checked = false);
      wrap.classList.remove('ms-open');
    }
    const dd = document.getElementById(id + 'Dropdown');
    if (dd) dd.style.display = 'none';
    const disp = document.getElementById(id + 'Display');
    if (disp) disp.textContent = 'Tout';
  });
  document.getElementById('tblSearch').value = '';
  document.querySelectorAll('#tblBody tr').forEach(r => r.classList.remove('tr-selected'));
  refresh();
}

// ════════════════════════════════════════════════════
//  STATS GLOBALES
// ════════════════════════════════════════════════════
// ── Compter les levées dynamiquement selon filtres actifs ────────────
function _countLevees(chambords, blocArr, phaseArr, leveeArr) {
  // ── Chemin rapide : filtre Phase uniquement (pas de Bloc ni Levée) ──
  // Utilise directement p1real/p2real/p3real → garanti 100% correct
  if (!blocArr.length && !leveeArr.length && phaseArr.length) {
    let total = 0, real = 0;
    chambords.forEach(c => {
      phaseArr.forEach(ph => {
        if (ph === 1) { total += c.p1tot; real += c.p1real; }
        else if (ph === 2) { total += c.p2tot; real += c.p2real; }
        else if (ph === 3) { total += c.p3tot; real += c.p3real; }
      });
    });
    return { total, real };
  }
  // ── Chemin général : itération levée par levée ────────────────────
  let total = 0, real = 0;
  chambords.forEach(c => {
    c.levees.forEach(l => {
      if (!leveeMatchesBlocPhase(l, blocArr, phaseArr, leveeArr)) return;
      total++;
      if (l.realisee) real++;
    });
  });
  return { total, real };
}

function renderStats() {
  const blocArr  = getMsSelectedValues('msBloc');
  const phaseArr = getMsSelectedValues('msPhase').map(Number);
  const leveeArr = getMsSelectedValues('msLevee').map(Number);
  const hasLevelFilter = blocArr.length || phaseArr.length || leveeArr.length;

  let total, real;
  if (hasLevelFilter) {
    // Compter dynamiquement levée par levée selon les filtres
    const counts = _countLevees(filtered, blocArr, phaseArr, leveeArr);
    total = counts.total;
    real  = counts.real;
  } else {
    // Aucun filtre niveau → utiliser les valeurs pré-calculées (plus rapide)
    total = filtered.reduce((s, c) => s + c.tot,  0);
    real  = filtered.reduce((s, c) => s + c.real, 0);
  }

  const pct  = total > 0 ? Math.round(real / total * 100) : 0;
  const rest = total - real;

  renderDonut(pct);
  document.getElementById('gPct').textContent     = pct  + '%';
  document.getElementById('gReal').textContent    = real;
  document.getElementById('gTotal').textContent   = total;
  document.getElementById('gRest').textContent    = rest;
  document.getElementById('levTotal').textContent = total;
  document.getElementById('levReal').textContent  = real;

  _setEnt('SGTM', 'sgtmPct', 'sgtmBar', blocArr, phaseArr, leveeArr, hasLevelFilter);
  _setEnt('TGCC', 'tgccPct', 'tgccBar', blocArr, phaseArr, leveeArr, hasLevelFilter);

  const entActif = document.getElementById('fEnt').value;
  const cardSGTM = document.getElementById('entCardSGTM');
  const cardTGCC = document.getElementById('entCardTGCC');
  if (cardSGTM) cardSGTM.classList.toggle('ent-active', entActif === 'SGTM');
  if (cardTGCC) cardTGCC.classList.toggle('ent-active', entActif === 'TGCC');
}

function _setEnt(ent, pctId, barId, blocArr, phaseArr, leveeArr, hasLevelFilter) {
  const rows = filtered.filter(c => c.ent === ent);
  let tot, real;
  if (hasLevelFilter) {
    const counts = _countLevees(rows, blocArr, phaseArr, leveeArr);
    tot  = counts.total;
    real = counts.real;
  } else {
    tot  = rows.reduce((s, c) => s + c.tot,  0);
    real = rows.reduce((s, c) => s + c.real, 0);
  }
  const pct = tot > 0 ? Math.round(real / tot * 100) : 0;
  document.getElementById(pctId).textContent  = pct + '%';
  document.getElementById(barId).style.width  = pct + '%';
}

// ════════════════════════════════════════════════════
//  DONUT CHART — Avancement Global
// ════════════════════════════════════════════════════
function renderDonut(pct) {
  const canvas = document.getElementById('donutChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const done = pct;
  const rest = 100 - pct;

  if (donutChartInst) {
    donutChartInst.data.datasets[0].data = [done, rest];
    donutChartInst.update('active');
    return;
  }

  donutChartInst = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [done, rest],
        backgroundColor: ['#FFA500', '#EBEBEB'],
        borderWidth: 0,
        hoverOffset: 0,
        hoverBackgroundColor: ['#FFA500', '#EBEBEB']
      }]
    },
    options: {
      responsive: false,
      cutout: '74%',
      animation: { duration: 800, easing: 'easeInOutQuart' },
      plugins: {
        legend:  { display: false },
        tooltip: { enabled: false }
      },
      events: []   // désactiver hover
    }
  });
}

// ════════════════════════════════════════════════════
//  GRAPHIQUE PAR BLOC — 4 blocs (Bloc 2-11 fusionné dans Bloc 2)
// ════════════════════════════════════════════════════
const CHART_BLOCS = ['1', '2', '3', '4'];
let blocChartMode = 'qty';   // Quantités par défaut (Y-axis réel comme référence)

function onBlocModeChange(sel) {
  blocChartMode = sel.value;
  if (blocChartInst) { blocChartInst.destroy(); blocChartInst = null; }
  renderBlocChart();
}

function renderBlocChart() {
  const activeBlocs = getMsSelectedValues('msBloc');

  // Bloc 2 absorbe Bloc 2-11
  const blocStats = CHART_BLOCS.map(b => {
    const match = l => b === '2'
      ? (l.bloc === '2' || l.bloc === '2-11')
      : l.bloc === b;
    const tot  = CHAMBORDS.reduce((s,c) => s + c.levees.filter(match).length, 0);
    const real = CHAMBORDS.reduce((s,c) => s + c.levees.filter(l => match(l) && l.realisee).length, 0);
    const pct  = tot > 0 ? Math.round(real / tot * 100) : 0;
    return { tot, real, pct };
  });

  // Actif si sélectionné dans le filtre (Bloc 2-11 → active aussi Bloc 2)
  const isActive = b => {
    if (!activeBlocs.length) return true;
    if (b === '2') return activeBlocs.includes('2') || activeBlocs.includes('2-11');
    return activeBlocs.includes(b);
  };

  const labels     = CHART_BLOCS.map(b => 'Bloc ' + b);
  const realData   = blocStats.map(s => blocChartMode === 'pct' ? s.pct  : s.real);
  const totalData  = blocStats.map(s => blocChartMode === 'pct' ? 100   : s.tot);

  const realColors  = CHART_BLOCS.map(b => isActive(b) ? '#F5A623'            : 'rgba(245,166,35,0.18)');
  const totalColors = CHART_BLOCS.map(b => isActive(b) ? 'rgba(175,175,175,0.85)' : 'rgba(175,175,175,0.15)');

  if (blocChartInst) {
    blocChartInst.data.datasets[0].data            = realData;
    blocChartInst.data.datasets[0].backgroundColor = realColors;
    blocChartInst.data.datasets[1].data            = totalData;
    blocChartInst.data.datasets[1].backgroundColor = totalColors;
    blocChartInst.options.scales.y.max             = blocChartMode === 'pct' ? 100 : undefined;
    blocChartInst.options.scales.y.ticks.callback  = v => blocChartMode === 'pct' ? v + '%' : v;
    blocChartInst.update('active');
    return;
  }

  const ctx = document.getElementById('blocChart').getContext('2d');
  blocChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Réalisé',
          data: realData,
          backgroundColor: realColors,
          borderRadius: [3, 3, 0, 0],
          borderSkipped: false,
          barPercentage: 1.0,
          categoryPercentage: 0.6,
          maxBarThickness: 16
        },
        {
          label: 'Total',
          data: totalData,
          backgroundColor: totalColors,
          borderRadius: [3, 3, 0, 0],
          borderSkipped: false,
          barPercentage: 1.0,
          categoryPercentage: 0.6,
          maxBarThickness: 16
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 500, easing: 'easeInOutQuart' },
      onClick(evt, elements) {
        if (!elements.length) return;
        const blocVal = CHART_BLOCS[elements[0].index];
        const dd = document.getElementById('msBlocDropdown');
        if (dd) {
          const cb = dd.querySelector(`input[value="${blocVal}"]`);
          if (cb) { cb.checked = !cb.checked; onMsChange('msBloc'); }
        }
      },
      plugins: {
        legend: {
          display: true,
          position: 'bottom',
          labels: {
            color: '#444',
            font: { size: 10, weight: '600' },
            boxWidth: 14,
            boxHeight: 10,
            padding: 12,
            usePointStyle: false
          }
        },
        tooltip: {
          backgroundColor: 'rgba(255,255,255,0.97)',
          titleColor: '#111',
          titleFont: { size: 11, weight: '700' },
          bodyColor: '#555',
          bodyFont: { size: 10 },
          borderColor: '#e0e0e0',
          borderWidth: 1,
          padding: 10,
          callbacks: {
            title: items => 'Bloc ' + CHART_BLOCS[items[0].dataIndex],
            label: item => {
              const s = blocStats[item.dataIndex];
              if (item.datasetIndex === 0)
                return `  Réalisé : ${s.real} levées (${s.pct}%)`;
              return `  Total : ${s.tot} levées`;
            }
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#555', font: { size: 9, weight: '500' }, maxRotation: 0 },
          grid:  { display: false },
          border:{ display: false }
        },
        y: {
          beginAtZero: true,
          max: blocChartMode === 'pct' ? 100 : undefined,
          ticks: {
            color: '#888',
            font: { size: 8.5 },
            maxTicksLimit: 5,
            callback: v => blocChartMode === 'pct' ? v + '%' : v
          },
          grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
          border: { display: false }
        }
      }
    }
  });
}

// ════════════════════════════════════════════════════
//  TABLEAU CHAMBORDS
// ════════════════════════════════════════════════════
function renderTable(data, phaseArr, leveeArr, blocArr) {
  const tbody = document.getElementById('tblBody');
  const thead = document.querySelector('#mainTable thead tr');
  tbody.innerHTML = '';

  const singleLevee = (leveeArr && leveeArr.length === 1) ? leveeArr[0] : null;

  thead.innerHTML = singleLevee
    ? `<th>Chambord</th><th>Total</th><th>Réa.</th><th style="color:#F5A623">Ph.1</th><th style="color:#888">Ph.2</th><th>L.${singleLevee}</th><th>%</th>`
    : `<th>Chambord</th><th>Total</th><th>Réa.</th><th style="color:#F5A623">Ph.1</th><th style="color:#888">Ph.2</th><th>%</th>`;

  data.forEach(c => {
    // ── Totaux selon filtres actifs ──────────────────
    let dispTot, dispReal;
    const hasFilter = (phaseArr && phaseArr.length) || (leveeArr && leveeArr.length) || (blocArr && blocArr.length);
    if (hasFilter) {
      const counts = _countLevees([c], blocArr || [], phaseArr || [], leveeArr || []);
      dispTot  = counts.total;
      dispReal = counts.real;
    } else {
      dispTot  = c.tot;
      dispReal = c.real;
    }

    const pct   = dispTot > 0 ? Math.round(dispReal / dispTot * 100) : 0;
    const color = pctColor(pct);

    // Afficher les blocs réels (ex: "2/2-11" pour CR 23/24/25)
    const blocDisplay = (c.blocs && c.blocs.length > 1) ? c.blocs.join('/') : c.bloc;

    let levCell = '';
    if (singleLevee) {
      const lv = c.levees.find(l => l.num === singleLevee);
      levCell = `<td style="text-align:center;font-weight:700;color:${lv?.realisee?'#2ECC71':'#e74c3c'}">
        ${lv ? (lv.realisee ? '✓' : '✗') : '—'}</td>`;
    }

    // ── Colonnes Phase 1 et Phase 2 ─────────────────
    const p1Done = c.p1real === c.p1tot;
    const p2Done = c.p2real === c.p2tot && c.p2tot > 0;
    const p1Color = p1Done ? '#2ECC71' : (c.p1real > 0 ? '#F5A623' : '#e74c3c');
    const p2Color = p2Done ? '#2ECC71' : (c.p2real > 0 ? '#F5A623' : '#bbb');
    const p1Cell = `<td style="font-size:9.5px;text-align:center;font-weight:700;color:${p1Color}">${c.p1real}/${c.p1tot}</td>`;
    const p2Cell = `<td style="font-size:9.5px;text-align:center;font-weight:700;color:${p2Color}">${c.p2real}/${c.p2tot}</td>`;

    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td><strong>${c.id}</strong> <span style="font-size:9px;color:#888">${blocDisplay}</span></td>` +
      `<td>${dispTot}</td>` +
      `<td style="color:#2ECC71;font-weight:700">${dispReal}</td>` +
      p1Cell + p2Cell +
      levCell +
      `<td><div class="pct-cell">
        <span class="pct-dot" style="background:${color}"></span>
        <div class="pct-tr"><div class="pct-fl" style="width:${pct}%;background:${color}"></div></div>
        <span class="pct-lbl" style="color:${color}">${pct}%</span>
      </div></td>`;

    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => {
      document.querySelectorAll('#tblBody tr').forEach(r => r.classList.remove('tr-selected'));
      tr.classList.add('tr-selected');
      syncViewer({
        bloc:   getMsSelectedValues('msBloc'),
        ent:    document.getElementById('fEnt').value,
        chbd:   [c.id],
        phase:  phaseArr || [],
        levee:  leveeArr || [],
        statut: document.getElementById('fStatut').value
      });
    });

    tbody.appendChild(tr);
  });

  document.getElementById('tblFooter').textContent =
    `${data.length} chambord${data.length > 1 ? 's' : ''} sur ${CHAMBORDS.length}`;
}

function filterTable() {
  const q        = document.getElementById('tblSearch').value.toLowerCase().trim();
  const phaseArr = getMsSelectedValues('msPhase').map(Number);
  const leveeArr = getMsSelectedValues('msLevee').map(Number);
  const blocArr  = getMsSelectedValues('msBloc');
  renderTable(
    q ? filtered.filter(c => c.id.toLowerCase().includes(q)) : filtered,
    phaseArr, leveeArr, blocArr
  );
}

// Seuils d'avancement :
//  ≥ 75% → vert   (très avancé, proche de 100%)
//  ≥ 35% → orange (avancement moyen)
//  < 35% → rouge  (en retard)
function pctColor(pct) {
  if (pct >= 75) return CONFIG.COLORS.green;
  if (pct >= 35) return CONFIG.COLORS.orange;
  return CONFIG.COLORS.red;
}

function exportPDF() { window.print(); }
