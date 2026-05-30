// ════════════════════════════════════════════════════
//  viewer-aps.js  —  Intégration APS Viewer
//  Charge la maquette depuis ACC via /api/token et /api/model
//  Avec gestion 3-legged OAuth (login ACC obligatoire)
// ════════════════════════════════════════════════════

window.viewerInstance = null;   // accès global
let colorModeActive   = true;

// ── Démarrage ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  checkAuthThenLoad();
});

// ── Vérifier l'état de connexion avant de charger ────
async function checkAuthThenLoad() {
  setStatus('⏳ Vérification connexion...', 'loading');

  // Vérifier les paramètres URL (retour login/erreur)
  const params = new URLSearchParams(window.location.search);
  if (params.get('connected') === '1') {
    // Nettoyer l'URL après connexion réussie
    history.replaceState({}, '', '/');
    updateAccBadge(true);
  }
  if (params.get('error')) {
    const errMsg = decodeURIComponent(params.get('error'));
    console.error('❌ Auth error:', errMsg);
    history.replaceState({}, '', '/');
    showLoginPrompt('Erreur de connexion : ' + errMsg);
    return;
  }

  try {
    const resp = await fetch('/api/auth/status');
    const { logged_in, login_url } = await resp.json();

    if (logged_in) {
      updateAccBadge(true);
      loadApsViewer();
    } else {
      updateAccBadge(false);
      showLoginPrompt(null, login_url);
    }
  } catch (e) {
    console.error('❌ Auth status check:', e.message);
    setStatus('❌ Serveur inaccessible', 'error');
    showLoginPrompt('Serveur inaccessible');
  }
}

// ── Afficher le prompt de connexion dans le viewer ───
function showLoginPrompt(errorMsg, loginUrl) {
  loginUrl = loginUrl || '/api/auth/login';

  setStatus('⚠ Connexion requise', 'warn');

  const ph = document.getElementById('viewerPlaceholder');
  if (ph) {
    ph.style.display = 'flex';
    ph.innerHTML = `
      <div style="text-align:center;padding:30px">
        <div style="font-size:52px;margin-bottom:16px">🔐</div>
        <p style="font-size:15px;font-weight:600;margin:0 0 8px;color:#FFA500">Connexion ACC requise</p>
        <p style="font-size:12px;color:rgba(255,255,255,.55);margin:0 0 24px;max-width:300px;line-height:1.5">
          Pour afficher la maquette 3D, connectez-vous avec votre compte Autodesk (ACC).
        </p>
        ${errorMsg ? `<p style="font-size:11px;color:#e74c3c;margin:0 0 18px">${errorMsg}</p>` : ''}
        <a href="${loginUrl}" style="
          display:inline-block;
          background:#FFA500;
          color:#111;
          font-weight:700;
          font-size:13px;
          padding:10px 28px;
          border-radius:6px;
          text-decoration:none;
          letter-spacing:.3px;
          transition:opacity .15s
        " onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
          🔑 Se connecter avec Autodesk
        </a>
      </div>
    `;
  }
}

// ── Mise à jour du badge ACC en topbar ───────────────
function updateAccBadge(isConnected) {
  const badge = document.getElementById('accBadge');
  const logoutBtn = document.getElementById('logoutBtn');
  if (!badge) return;
  if (isConnected) {
    badge.innerHTML = '<span class="acc-dot"></span>ACC connecté ✓';
    badge.style.color = '#2ECC71';
    if (logoutBtn) logoutBtn.style.display = 'inline-flex';
  } else {
    badge.innerHTML = `<a href="/api/auth/login" style="color:#FFA500;text-decoration:none;font-weight:600">🔑 Connexion ACC requise</a>`;
    badge.style.color = '#FFA500';
    if (logoutBtn) logoutBtn.style.display = 'none';
  }
}

// ── Déconnexion ACC ──────────────────────────────────
async function logoutACC() {
  await fetch('/api/auth/logout');
  window.location.reload();
}

// ── Étape 1 : récupérer token + URN depuis le serveur ──
async function loadApsViewer() {
  setStatus('⏳ Authentification...', 'loading');

  try {
    // Token
    const tokenResp = await fetch(CONFIG.API_TOKEN);
    if (!tokenResp.ok) throw new Error('Token endpoint error ' + tokenResp.status);
    const { access_token, source } = await tokenResp.json();
    if (!access_token) throw new Error('access_token manquant');
    console.log('🔑 Token source:', source);

    // Infos modèle (URN derivative + viewable GUID)
    const modelResp = await fetch(CONFIG.API_MODEL);
    if (!modelResp.ok) throw new Error('Model endpoint error ' + modelResp.status);
    const modelInfo = await modelResp.json();
    if (modelInfo.error) throw new Error(modelInfo.error);

    setStatus('⏳ Chargement du SDK...', 'loading');
    initSdk(access_token, modelInfo);

  } catch (e) {
    console.error('❌ loadApsViewer:', e.message);
    setStatus('❌ ' + e.message, 'error');
    setPlaceholder(`❌ ${e.message}`);
  }
}

// ── Étape 2 : charger le SDK APS Viewer ──────────────
function initSdk(token, modelInfo) {
  // Feuille de style APS
  if (!document.getElementById('aps-css')) {
    const link = document.createElement('link');
    link.id   = 'aps-css';
    link.rel  = 'stylesheet';
    link.type = 'text/css';
    link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css';
    document.head.appendChild(link);
  }

  // Script SDK
  if (window.Autodesk) {
    initViewer(token, modelInfo);
    return;
  }

  const script = document.createElement('script');
  script.src   = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js';
  script.onload  = () => { console.log('✅ APS SDK chargé'); initViewer(token, modelInfo); };
  script.onerror = () => { setStatus('❌ SDK APS indisponible', 'error'); };
  document.head.appendChild(script);
}

// ── Étape 3 : initialiser le viewer et charger le modèle ──
function initViewer(token, modelInfo) {
  setStatus('⏳ Initialisation du viewer...', 'loading');

  Autodesk.Viewing.Initializer(
    { env: 'AutodeskProduction2', accessToken: token, api: 'derivativeV2' },
    () => {
      setStatus('⏳ Chargement de la maquette...', 'loading');

      const viewerDiv = document.getElementById('viewer');
      hidePlaceholder();

      const viewer = new Autodesk.Viewing.GuiViewer3D(viewerDiv, {
        extensions: ['Autodesk.DocumentBrowser']
      });
      viewer.start();
      window.viewerInstance = viewer;

      const urnToLoad = 'urn:' + modelInfo.urn;

      Autodesk.Viewing.Document.load(
        urnToLoad,
        (doc) => onDocumentLoaded(doc, viewer, modelInfo),
        (err) => {
          console.error('❌ Document load error:', err);
          setStatus('❌ Erreur chargement modèle (code ' + err + ')', 'error');
        }
      );
    }
  );
}

// ── Étape 4 : modèle chargé → afficher la géométrie ──
function onDocumentLoaded(doc, viewer, modelInfo) {
  console.log('✅ Document ACC chargé');

  // Cherche le viewable par GUID ou prend la géométrie par défaut
  let viewable = null;

  if (modelInfo.viewable_guid) {
    const allViewables = doc.getRoot().search({ type: 'geometry' });
    viewable = allViewables.find(v => v.data.guid === modelInfo.viewable_guid)
             || allViewables[0];
  }

  if (!viewable) {
    viewable = doc.getRoot().getDefaultGeometry();
  }

  if (!viewable) {
    setStatus('❌ Aucune géométrie trouvée', 'error');
    return;
  }

  viewer.loadDocumentNode(doc, viewable).then(() => {
    viewer.fitToView();
    setStatus('✓ Maquette chargée', 'success');
    console.log('✅ Maquette affichée — Projet ACC :', modelInfo.project_id);

    // Appliquer la colorisation statut si activée
    if (colorModeActive) applyStatusColors(viewer);

    // Masquer les RESTE (escaliers, paliers) dès le chargement.
    // Puis lire le paramètre "levée réalisé" depuis Revit pour
    // synchroniser les vraies données de réalisation dans le dashboard.
    _initHideReste(viewer, function() {
      const filters = _getCurrentFilters();
      const hasAny  = _filtersHaveValue(filters);
      if (hasAny) syncViewer(filters);

      // Lecture du paramètre Revit "levée réalisé" (booléen)
      _fetchRealisationStatus(viewer);
    });
  });
}

// ── Colorisation par statut ──────────────────────────
function applyStatusColors(viewer) {
  if (!viewer || !viewer.model) return;
  // Exemple de colorisation basique — à étendre avec vos dbIds réels
  // viewer.setThemingColor(dbId, new THREE.Vector4(r, g, b, a));
  console.log('🎨 Colorisation statut demandée (à implémenter avec vos dbIds)');
}

// ── Bouton Couleurs statut ────────────────────────────
function toggleColorMode(btn) {
  colorModeActive = !colorModeActive;
  btn.classList.toggle('v-btn-active', colorModeActive);
  if (colorModeActive && window.viewerInstance) {
    applyStatusColors(window.viewerInstance);
  } else if (window.viewerInstance) {
    window.viewerInstance.clearThemingColors();
  }
}

// ── Plein écran ──────────────────────────────────────
function toggleFullscreen() {
  const el = document.getElementById('viewer');
  if (!document.fullscreenElement) {
    el.requestFullscreen && el.requestFullscreen();
  } else {
    document.exitFullscreen && document.exitFullscreen();
  }
}

// ════════════════════════════════════════════════════
//  SYNC VIEWER — Liaison filtres → maquette
//  Tous les filtres actifs sont combinés en logique AND.
//  Une seule passe getBulkProperties lit TOUS les paramètres
//  nécessaires + Category → résultat = murs/voiles correspondants.
// ════════════════════════════════════════════════════

// Lire les filtres actifs depuis le DOM (multi-select → tableaux)
function _getCurrentFilters() {
  // getMsSelectedValues est défini dans dashboard.js (chargé avant)
  var msVals = typeof getMsSelectedValues === 'function' ? getMsSelectedValues : function() { return []; };
  return {
    bloc:   msVals('msBloc'),           // tableau (multi-select)
    ent:    document.getElementById('fEnt')?.value    || '',
    chbd:   msVals('msChambord'),
    phase:  msVals('msPhase').map(Number),
    levee:  msVals('msLevee').map(Number),
    statut: document.getElementById('fStatut')?.value || ''
  };
}

// Vérifier si au moins un filtre est actif
function _filtersHaveValue(filters) {
  if (Array.isArray(filters.bloc) ? filters.bloc.length > 0 : !!filters.bloc) return true;
  if (filters.ent || filters.statut) return true;
  if (Array.isArray(filters.chbd)  && filters.chbd.length)  return true;
  if (Array.isArray(filters.phase) && filters.phase.length) return true;
  if (Array.isArray(filters.levee) && filters.levee.length) return true;
  return false;
}

// ── Point d'entrée appelé par dashboard.js ────────────────────────
// Stratégie fiable pour chaque combinaison de filtres :
//   Bloc sélectionné → on dérive les IDs Chambord depuis CHAMBORDS[]
//   puis on recherche via _findByChambords (paramètre CHAMBORD Revit).
//   Cela garantit le zoom pour tous les blocs (pas uniquement Bloc 3).
function syncViewer(filters) {
  if (!window.viewerInstance || !window.viewerInstance.model) return;
  var viewer = window.viewerInstance;

  var blocs  = _toArr(filters.bloc);
  var ents   = _toArr(filters.ent);
  var chbds  = _toArr(filters.chbd);
  var phases = _toArr(filters.phase).map(Number).filter(Boolean);
  var levees = _toArr(filters.levee).map(Number).filter(Boolean);

  var hasAny = blocs.length || ents.length || chbds.length || phases.length || levees.length;

  // ── Aucun filtre → réafficher les murs/voiles (sans RESTE) ──────
  if (!hasAny) {
    if (window._wallDbIds && window._wallDbIds.length > 0) {
      viewer.showAll();
      viewer.hideAll();
      viewer.show(window._wallDbIds);
    } else {
      viewer.showAll();
      viewer.setGhosting(true);
    }
    setStatus('✓ Maquette chargée', 'success');
    return;
  }

  // ── Résoudre les Chambords cibles ──────────────────────────────
  // Si Bloc(s) sélectionné(s), on dérive les chambords depuis CHAMBORDS[]
  // au lieu de rechercher par le paramètre Revit "Bloc" (valeurs inconsistantes).
  var targetChbds = chbds.slice(); // copie des chambords explicitement sélectionnés

  if (blocs.length > 0 && typeof CHAMBORDS !== 'undefined') {
    CHAMBORDS.forEach(function(c) {
      // Le chambord correspond au filtre bloc si au moins une de ses levées
      // appartient à l'un des blocs sélectionnés (gère les mixtes CR 23/24/25)
      var blocMatch = c.levees.some(function(l) {
        return blocs.indexOf(l.bloc) !== -1;
      });
      if (blocMatch && targetChbds.indexOf(c.id) === -1) {
        targetChbds.push(c.id);
      }
    });
  }

  // ── Filtrer également par entreprise si demandé ─────────────────
  if (ents.length > 0 && typeof CHAMBORDS !== 'undefined') {
    if (targetChbds.length > 0) {
      // Intersection : garder seulement ceux dont l'ent correspond
      targetChbds = targetChbds.filter(function(id) {
        var c = CHAMBORDS.find(function(x) { return x.id === id; });
        return c && ents.indexOf(c.ent) !== -1;
      });
    } else {
      // Aucun bloc sélectionné : tous les chambords de l'entreprise
      CHAMBORDS.forEach(function(c) {
        if (ents.indexOf(c.ent) !== -1 && targetChbds.indexOf(c.id) === -1) {
          targetChbds.push(c.id);
        }
      });
    }
  }

  // ── Lancer la recherche viewer ──────────────────────────────────
  if (targetChbds.length > 0) {
    // Critères supplémentaires (Phase, Levée) en AND avec OR intra
    var extraCriteria = [];
    if (phases.length) extraCriteria.push({ params: ['Phase'], values: phases.map(String) });
    if (levees.length) extraCriteria.push({ params: ['Levée','Levee','Num Levée','NumLevee','Numéro Levée'], values: levees.map(String) });
    _findByChambords(viewer, targetChbds, extraCriteria);
    return;
  }

  // ── Dernier recours : Phase / Levée seuls (sans Bloc ni Chambord) ─
  var criteria = [];
  if (phases.length) criteria.push({ params: ['Phase'], values: phases.map(String) });
  if (levees.length) criteria.push({ params: ['Levée','Levee','Num Levée','NumLevee','Numéro Levée'], values: levees.map(String) });

  if (criteria.length > 0) {
    var label = criteria.map(function(c) {
      return c.params[0] + (c.values.length === 1 ? ' ' + c.values[0] : ' [' + c.values.join(',') + ']');
    }).join(' + ');
    _findByCombinedCriteria(viewer, criteria, label);
  } else {
    // Rien à afficher → vue par défaut
    if (window._wallDbIds && window._wallDbIds.length > 0) {
      viewer.showAll(); viewer.hideAll(); viewer.show(window._wallDbIds);
    } else { viewer.showAll(); }
    setStatus('✓ Maquette chargée', 'success');
  }
}

// Convertit une valeur (scalaire ou tableau) en tableau non-vide
function _toArr(v) {
  if (!v && v !== 0) return [];
  if (Array.isArray(v)) return v.filter(function(x) { return x !== '' && x !== 0 && x !== null && x !== undefined; });
  if (v === '' || v === 0) return [];
  return [v];
}

// ════════════════════════════════════════════════════════════════════
//  _findByChambords
//  Recherche pour un ou plusieurs Chambords (tableau).
//  Logique OR entre les Chambords sélectionnés.
//  Critères extra (Phase, Levée) en AND, avec OR intra-critère (values[]).
//  Filtre final : garder uniquement les Murs/Voiles (exclure escaliers/paliers).
// ════════════════════════════════════════════════════════════════════
function _findByChambords(viewer, chambordIds, extraCriteria) {
  var labelChbd = chambordIds.length === 1
    ? 'Chambord ' + chambordIds[0]
    : 'Chambords [' + chambordIds.join(', ') + ']';
  var label = labelChbd;
  if (extraCriteria && extraCriteria.length > 0) {
    label += ' + ' + extraCriteria.map(function(c) {
      return c.params[0] + (c.values.length === 1 ? ' ' + c.values[0] : ' [' + c.values.join(',') + ']');
    }).join(' + ');
  }
  setStatus('⏳ Recherche ' + label + '...', 'loading');

  var tree = viewer.model.getData().instanceTree;
  if (!tree) { setStatus('⚠ Maquette non prête', 'warn'); return; }

  var allDbIds = [];
  tree.enumNodeChildren(tree.getRootId(), function(dbId) {
    allDbIds.push(dbId);
  }, true);
  if (!allDbIds.length) { setStatus('⚠ Maquette vide', 'warn'); return; }

  // Construire la liste des noms de paramètres à lire
  var paramNames = ['CHAMBORD', 'Chambord'];
  if (extraCriteria) {
    extraCriteria.forEach(function(c) {
      c.params.forEach(function(p) {
        if (paramNames.indexOf(p) === -1) paramNames.push(p);
      });
    });
  }

  // Préparer les valeurs Chambord en minuscules pour la comparaison
  var chambordLowers = chambordIds.map(function(id) { return id.trim().toLowerCase(); });

  viewer.model.getBulkProperties(
    allDbIds,
    { propFilter: paramNames },

    function(results) {
      var matching = [];

      for (var i = 0; i < results.length; i++) {
        var props = results[i].properties;
        var hasChambord = false;
        var extraSatisfied = (extraCriteria || []).map(function() { return false; });

        for (var j = 0; j < props.length; j++) {
          var pName = String(props[j].displayName || props[j].attributeName || '').toLowerCase();
          var pVal  = String(props[j].displayValue !== undefined ? props[j].displayValue : '').trim().toLowerCase();

          // Vérifier CHAMBORD (OR entre chambordIds)
          if (!hasChambord && pName === 'chambord') {
            if (chambordLowers.indexOf(pVal) !== -1) hasChambord = true;
          }

          // Vérifier critères extra (Phase, Levée…) — OR intra-critère
          for (var k = 0; k < extraSatisfied.length; k++) {
            if (!extraSatisfied[k]) {
              var ec = extraCriteria[k];
              var isParam = ec.params.some(function(n) { return pName === n.toLowerCase(); });
              if (isParam) {
                // OR : la valeur est-elle dans le tableau des valeurs autorisées ?
                var valuesLower = ec.values.map(function(v) { return String(v).toLowerCase(); });
                if (valuesLower.indexOf(pVal) !== -1) extraSatisfied[k] = true;
              }
            }
          }
        }

        if (hasChambord && extraSatisfied.every(function(s) { return s; })) {
          matching.push(results[i].dbId);
        }
      }

      console.log('[APS] ' + labelChbd + ' : ' + matching.length + ' éléments trouvés');

      if (matching.length > 0) {
        // Garder uniquement les Murs / Voiles (exclure escaliers, paliers RESTE)
        viewer.model.getBulkProperties(
          matching,
          { propFilter: ['Category', 'Catégorie'] },
          function(catResults) {
            var wallsOnly = [];
            var nonWalls  = [];

            for (var i = 0; i < catResults.length; i++) {
              var props  = catResults[i].properties;
              var isWall = false;
              for (var j = 0; j < props.length; j++) {
                var cv = String(props[j].displayValue || '').toLowerCase();
                if (cv.indexOf('mur') !== -1 || cv.indexOf('wall') !== -1 || cv.indexOf('voile') !== -1) {
                  isWall = true; break;
                }
              }
              if (isWall) wallsOnly.push(catResults[i].dbId);
              else        nonWalls.push(catResults[i].dbId);
            }

            console.log('[APS] ' + label + ' → murs: ' + wallsOnly.length +
                        ' | exclus (escaliers/paliers): ' + nonWalls.length);

            _isolate(viewer, wallsOnly.length > 0 ? wallsOnly : matching, label);
          },
          function() { _isolate(viewer, matching, label); }
        );
      } else {
        // Dernier recours : viewer.search direct sur le premier chambord
        var firstId = chambordIds[0];
        viewer.search(firstId,
          function(ids) {
            if (ids && ids.length > 0) {
              console.log('[APS] Fallback search : ' + ids.length + ' éléments');
              _isolate(viewer, ids, label);
            } else {
              if (window._wallDbIds && window._wallDbIds.length > 0) {
                viewer.showAll(); viewer.hideAll(); viewer.show(window._wallDbIds);
              } else { viewer.showAll(); }
              setStatus('⚠ ' + label + ' : introuvable dans la maquette', 'warn');
            }
          },
          function() {
            if (window._wallDbIds && window._wallDbIds.length > 0) {
              viewer.showAll(); viewer.hideAll(); viewer.show(window._wallDbIds);
            } else { viewer.showAll(); }
            setStatus('⚠ ' + label + ' : introuvable', 'warn');
          },
          ['CHAMBORD', 'Chambord']
        );
      }
    },

    function(err) {
      console.error('[APS] _findByChambords erreur :', err);
      setStatus('❌ Erreur recherche', 'error');
    }
  );
}

// ════════════════════════════════════════════════════════════════════
//  _findByCombinedCriteria
//  Deux étapes distinctes et fiables :
//   1. viewer.search() sur Category → dbIds des Murs / Voiles uniquement
//   2. getBulkProperties sur ces murs → filtrage AND de tous les critères
//
//  viewer.search est plus fiable que propFilter pour la Category car
//  il interroge directement la base de propriétés interne d'APS.
// ════════════════════════════════════════════════════════════════════
function _findByCombinedCriteria(viewer, criteria, label) {
  setStatus('⏳ Recherche ' + label + '...', 'loading');

  var tree = viewer.model.getData().instanceTree;
  if (!tree) { setStatus('⚠ Maquette non prête', 'warn'); return; }

  var allDbIds = [];
  tree.enumNodeChildren(tree.getRootId(), function(dbId) {
    allDbIds.push(dbId);
  }, true);
  if (!allDbIds.length) { setStatus('⚠ Maquette vide', 'warn'); return; }

  // ── ÉTAPE 1 : récupérer les dbIds des Murs / Voiles ─────────────
  // On lance viewer.search() pour chaque mot-clé de catégorie.
  // viewer.search avec attributeNames=['Category'] cherche DANS la catégorie.
  var wallSet = {};   // set pour dédoublonner
  var terms   = ['Mur', 'Wall', 'Voile'];  // sous-chaînes valides pour catégorie mur
  var done    = 0;

  terms.forEach(function(term) {
    viewer.search(
      term,
      function(ids) {
        if (ids && ids.length) {
          ids.forEach(function(id) { wallSet[id] = true; });
        }
        done++;
        if (done === terms.length) _step2FilterCriteria(viewer, wallSet, allDbIds, criteria, label);
      },
      function() {
        done++;
        if (done === terms.length) _step2FilterCriteria(viewer, wallSet, allDbIds, criteria, label);
      },
      ['Category', 'Catégorie']   // chercher uniquement dans l'attribut Category
    );
  });
}

// ── ÉTAPE 2 : filtrer les murs par tous les critères (AND, OR intra) ──
//  + exiger la présence du paramètre CHAMBORD (éléments colorés/trackés uniquement)
//    → les éléments blanc/gris sans CHAMBORD (non trackés) sont exclus automatiquement
function _step2FilterCriteria(viewer, wallSet, allDbIds, criteria, label) {
  var wallDbIds = Object.keys(wallSet).map(Number);
  console.log('[APS] Étape 1 — Murs/Voiles (search) : ' + wallDbIds.length + ' / ' + allDbIds.length);

  var baseIds = wallDbIds.length > 0 ? wallDbIds : allDbIds;

  // Toujours inclure CHAMBORD pour filtrer les éléments non-trackés (blancs/gris)
  var paramNames = ['CHAMBORD', 'Chambord'];
  criteria.forEach(function(c) {
    c.params.forEach(function(p) {
      if (paramNames.indexOf(p) === -1) paramNames.push(p);
    });
  });

  viewer.model.getBulkProperties(
    baseIds,
    { propFilter: paramNames },

    function(results) {
      var matching = [];

      for (var i = 0; i < results.length; i++) {
        var props       = results[i].properties;
        var hasChambord = false;   // présence CHAMBORD = élément coloré/tracké
        var satisfied   = criteria.map(function() { return false; });

        for (var j = 0; j < props.length; j++) {
          var pName = String(props[j].displayName || props[j].attributeName || '').toLowerCase();
          var pVal  = String(props[j].displayValue !== undefined
                            ? props[j].displayValue : '').trim().toLowerCase();

          // Vérifier présence CHAMBORD (valeur non vide = élément coloré)
          if (!hasChambord && pName === 'chambord' && pVal !== '') {
            hasChambord = true;
          }

          for (var k = 0; k < criteria.length; k++) {
            if (!satisfied[k]) {
              var isParam = criteria[k].params.some(function(n) {
                return pName === n.toLowerCase();
              });
              if (isParam) {
                // Support format values[] (multi) ET value (rétro-compat)
                var allowed = criteria[k].values
                  ? criteria[k].values.map(function(v) { return String(v).toLowerCase(); })
                  : [String(criteria[k].value || '').toLowerCase()];
                if (allowed.indexOf(pVal) !== -1) satisfied[k] = true;
              }
            }
          }
        }

        // Inclure uniquement si : CHAMBORD présent (coloré) ET tous critères satisfaits
        if (hasChambord && satisfied.every(function(s) { return s; })) {
          matching.push(results[i].dbId);
        }
      }

      console.log('[APS] Étape 2 — ' + label + ' : ' + matching.length + ' éléments trouvés');

      if (matching.length > 0) {
        // Filtre TYPE VO pour exclure escaliers (ES), paliers (PL), etc.
        _filterByTypeVO(viewer, matching, label);

      } else if (baseIds !== allDbIds) {
        console.warn('[APS] Retry sur tous les éléments (Category non filtrante)...');
        _step2FilterCriteria(viewer, {}, allDbIds, criteria, label);

      } else {
        var sample = results.slice(0, 4).map(function(r) {
          return r.properties.map(function(p) {
            return '"' + (p.displayName || p.attributeName) + '"="' + p.displayValue + '"';
          }).join(' | ');
        });
        console.warn('[APS] Aucun résultat — critères :', JSON.stringify(criteria));
        console.warn('[APS] Exemples de props reçues :', sample);
        // Reset : réafficher les murs connus (masquer les RESTE)
        if (window._wallDbIds && window._wallDbIds.length > 0) {
          viewer.showAll(); viewer.hideAll(); viewer.show(window._wallDbIds);
        } else {
          viewer.setGhosting(true); viewer.showAll();
        }
        setStatus('⚠ ' + label + ' : introuvable (F12 pour détails)', 'warn');
      }
    },

    function(err) {
      console.error('[APS] getBulkProperties erreur :', err);
      setStatus('❌ Erreur recherche APS', 'error');
    }
  );
}

// ── Filtre final : ne garder que les éléments TYPE VO ───────────────
// Utilise viewer.search('VO') sur les attributs de type Revit.
// Exclut les escaliers (ES), paliers de repos (PL), etc.
// Si aucun élément "VO" trouvé → affiche tout le matching (sécurité).
function _filterByTypeVO(viewer, matchingDbIds, label) {
  // Construire un set des dbIds matching pour l'intersection
  var matchingSet = {};
  matchingDbIds.forEach(function(id) { matchingSet[id] = true; });

  // viewer.search('VO') dans les attributs de type Revit
  viewer.search(
    'VO',
    function(voIds) {
      if (voIds && voIds.length > 0) {
        // Intersection : éléments qui sont à la fois dans matching ET de type VO
        var voFiltered = voIds.filter(function(id) { return matchingSet[id]; });
        console.log('[APS] Filtre VO : ' + voFiltered.length + ' / ' + matchingDbIds.length + ' éléments');

        if (voFiltered.length > 0) {
          _isolate(viewer, voFiltered, label);
        } else {
          // Aucun élément VO dans le matching → afficher tout le matching quand même
          console.warn('[APS] Aucun élément TYPE VO dans la sélection, affichage sans filtre VO');
          _isolate(viewer, matchingDbIds, label);
        }
      } else {
        // viewer.search n'a rien trouvé pour 'VO' → afficher tout le matching
        console.warn('[APS] viewer.search("VO") : 0 résultats, affichage sans filtre VO');
        _isolate(viewer, matchingDbIds, label);
      }
    },
    function(err) {
      console.warn('[APS] Erreur search VO :', err);
      _isolate(viewer, matchingDbIds, label);
    },
    ['Type Name', 'Nom du type', 'Family and Type', 'Famille et type', 'Name']
  );
}

function _isolate(viewer, dbIds, label) {
  // Cacher TOUT puis afficher SEULEMENT les éléments voulus.
  // Cette approche (hideAll + show) est plus fiable qu'isolate+ghosting
  // car elle ne laisse aucun élément "transparent/grisé" visible.
  viewer.showAll();          // reset d'abord pour repartir d'un état propre
  viewer.hideAll();          // cacher tout
  viewer.show(dbIds);        // afficher uniquement les éléments filtrés
  viewer.fitToView(dbIds);   // zoom sur la sélection
  setStatus('🔍 ' + label + ' — ' + dbIds.length + ' élément(s)', 'success');
  console.log('[APS] ✅ ' + label + ' → ' + dbIds.length + ' dbIds visibles');
}

// ════════════════════════════════════════════════════════════════════
//  _initHideReste
//  Masquage permanent des éléments "RESTE" (escaliers, paliers, rampes…)
//  dès le chargement de la maquette.
//  Stratégie : rechercher tous les éléments dont la Category contient
//  "Mur" / "Wall" / "Voile", les stocker dans window._wallDbIds, puis
//  afficher UNIQUEMENT ces éléments (hideAll + show).
//  callback() est appelé une fois terminé pour ré-appliquer les filtres.
// ════════════════════════════════════════════════════════════════════
function _initHideReste(viewer, callback) {
  console.log('[APS] _initHideReste — recherche des murs/voiles...');

  var wallSet = {};
  var terms   = ['Mur', 'Wall', 'Voile'];
  var done    = 0;

  terms.forEach(function(term) {
    viewer.search(
      term,
      function(ids) {
        if (ids && ids.length) ids.forEach(function(id) { wallSet[id] = true; });
        done++;
        if (done === terms.length) _applyReste();
      },
      function() {
        done++;
        if (done === terms.length) _applyReste();
      },
      ['Category', 'Catégorie']
    );
  });

  function _applyReste() {
    var wallIds = Object.keys(wallSet).map(Number);
    console.log('[APS] _initHideReste — ' + wallIds.length + ' murs/voiles identifiés');

    window._wallDbIds = wallIds;

    if (wallIds.length > 0) {
      viewer.showAll();
      viewer.hideAll();
      viewer.show(wallIds);
      console.log('[APS] ✅ RESTE masqués — seuls les murs/voiles sont visibles');
    } else {
      console.warn('[APS] ⚠ _initHideReste : aucun mur trouvé, maquette affichée entière');
    }

    if (typeof callback === 'function') callback();
  }
}

// ════════════════════════════════════════════════════════════════════
//  _fetchRealisationStatus
//  Lit le paramètre booléen Revit "levée réalisé" sur TOUS les éléments
//  du modèle chargé, puis met à jour CHAMBORDS[] avec les vraies valeurs.
//
//  Pour chaque élément mur/voile :
//    - CHAMBORD  → quel chambord (ex: "CR 14")
//    - Levée     → numéro de levée (ex: 7)
//    - levée réalisé → booléen (1/0, Oui/Non, Yes/No, true/false)
//
//  Après mise à jour : refresh() est appelé pour re-render le dashboard.
//  Le filtre Statut utilise ensuite c.real (count levées réalisées) :
//    "Réalisé"     → c.real > 0  (au moins une levée cochée)
//    "Non réalisé" → c.real === 0 (aucune levée cochée)
// ════════════════════════════════════════════════════════════════════
function _fetchRealisationStatus(viewer) {
  console.log('[APS] _fetchRealisationStatus — lecture paramètre "levée réalisé"...');
  setStatus('⏳ Lecture statuts Revit...', 'loading');

  var tree = viewer.model && viewer.model.getData().instanceTree;
  if (!tree) {
    console.warn('[APS] _fetchRealisationStatus : maquette non prête');
    setStatus('✓ Maquette chargée', 'success');
    return;
  }

  // Collecter tous les dbIds
  var allDbIds = [];
  tree.enumNodeChildren(tree.getRootId(), function(dbId) {
    allDbIds.push(dbId);
  }, true);
  if (!allDbIds.length) { setStatus('✓ Maquette chargée', 'success'); return; }

  // ── Noms possibles dans Revit (accents, casse, espaces variables) ──
  var CHAMBORD_PARAMS = ['CHAMBORD', 'Chambord'];

  var LEVEE_PARAMS = [
    'Levée', 'Levee', 'levée', 'levee',
    'Num Levée', 'NumLevee', 'Numéro Levée', 'N° Levée',
    'Num levée', 'num levée', 'numéro levée'
  ];

  var REALISE_PARAMS = [
    // Noms les plus courants en français/anglais
    'levée réalisé',   'Levée réalisé',   'levée réalisée',  'Levée réalisée',
    'Levée Réalisée',  'Levée Réalisé',   'LEVEE REALISE',
    'levee realise',   'Levee Realise',   'levee réalisée',
    'réalisé',         'Réalisé',         'realise',         'Realise',
    'Réalisée',        'réalisée',
    'levée_réalisé',   'levee_realise'
  ];

  var paramNames = [].concat(CHAMBORD_PARAMS, LEVEE_PARAMS, REALISE_PARAMS);

  // Précomputer les sets en minuscules pour la comparaison
  var chambordSet  = CHAMBORD_PARAMS.map(function(s) { return s.toLowerCase(); });
  var leveeSet     = LEVEE_PARAMS.map(function(s)    { return s.toLowerCase(); });
  var realiseSet   = REALISE_PARAMS.map(function(s)  { return s.toLowerCase(); });
  // Valeurs booléennes "vrai"
  var TRUTHY = ['1', 'true', 'yes', 'oui', 'vrai', 'checked', 'coché'];

  viewer.model.getBulkProperties(
    allDbIds,
    { propFilter: paramNames },

    function(results) {
      // ── Construire la map : { 'CR 14': { 7: true, 8: false, … }, … } ──
      var map = {};

      for (var i = 0; i < results.length; i++) {
        var props      = results[i].properties;
        var chambordId = null;   // ex: "CR 14"
        var leveeNum   = null;   // ex: 7
        var realise    = null;   // true / false

        for (var j = 0; j < props.length; j++) {
          var rawName = String(props[j].displayName || props[j].attributeName || '').trim();
          var pName   = rawName.toLowerCase();
          var rawVal  = props[j].displayValue;
          var pVal    = String(rawVal !== undefined && rawVal !== null ? rawVal : '').trim();
          var pValLow = pVal.toLowerCase();

          // ── CHAMBORD ──
          if (chambordId === null && chambordSet.indexOf(pName) !== -1) {
            if (pVal !== '') chambordId = pVal; // garder la casse d'origine (ex: "CR 14")
          }

          // ── Numéro de levée ──
          if (leveeNum === null && leveeSet.indexOf(pName) !== -1) {
            var n = parseInt(pVal, 10);
            if (!isNaN(n) && n > 0) leveeNum = n;
          }

          // ── levée réalisé (booléen) ──
          if (realise === null && realiseSet.indexOf(pName) !== -1) {
            realise = TRUTHY.indexOf(pValLow) !== -1;
          }
        }

        // Stocker si les 3 champs sont présents
        if (chambordId !== null && leveeNum !== null && realise !== null) {
          if (!map[chambordId]) map[chambordId] = {};
          // OR logique : si au moins un élément dit "réalisé" → réalisé
          map[chambordId][leveeNum] = (map[chambordId][leveeNum] || realise);
        }
      }

      var nbChambords = Object.keys(map).length;
      console.log('[APS] _fetchRealisationStatus — ' + nbChambords + ' chambord(s) lus dans Revit');

      if (nbChambords === 0) {
        // Paramètre non trouvé — afficher les noms de paramètres présents pour debug
        var sample = results.slice(0, 3).map(function(r) {
          return r.properties.map(function(p) {
            return '"' + (p.displayName || p.attributeName) + '"';
          }).join(', ');
        });
        console.warn('[APS] Paramètre "levée réalisé" non trouvé. Paramètres présents (3 premiers) :', sample);
        setStatus('✓ Maquette chargée', 'success');
        return;
      }

      // ── Mettre à jour l.realisee UNIQUEMENT (pas c.real ni GRAND_REAL) ──
      //  • c.real / GRAND_REAL → restent ceux du tableau (data.js) = 211
      //  • l.realisee          → mis à jour depuis Revit pour le filtre Statut
      var updatedLevees = 0;
      if (typeof CHAMBORDS !== 'undefined') {
        CHAMBORDS.forEach(function(c) {
          var chbdMap = map[c.id];
          if (!chbdMap) {
            var keyLow = c.id.toLowerCase();
            Object.keys(map).forEach(function(k) {
              if (k.toLowerCase() === keyLow) chbdMap = map[k];
            });
          }
          if (!chbdMap) return;

          c.levees.forEach(function(l) {
            if (chbdMap[l.num] !== undefined) {
              l.realisee = chbdMap[l.num];   // ← Revit drive le booléen
              updatedLevees++;
            }
          });
          // NE PAS toucher c.real — les statistiques restent sur le tableau
        });

        // NE PAS recalculer GRAND_REAL — reste à 211 (valeur tableau)
        console.log('[APS] ✅ ' + updatedLevees + ' levées synchronisées depuis Revit (stats tableau conservées)');
        setStatus('✓ Statuts Revit chargés', 'success');

        // Re-render le filtre Statut uniquement (pas les stats globales)
        if (typeof refresh === 'function') refresh();
      }
    },

    function(err) {
      console.error('[APS] _fetchRealisationStatus erreur :', err);
      setStatus('✓ Maquette chargée', 'success');
    }
  );
}

// Alias pour la compatibilité avec les appels existants
function highlightByFilters(filters) {
  // Convertit l'ancien format { levee, phase, chambord } vers le nouveau
  syncViewer({
    levee:  filters.levee   || 0,
    phase:  filters.phase   || 0,
    chbd:   filters.chambord || '',
    bloc:   filters.bloc    || '',
    ent:    filters.ent     || ''
  });
}

// ── Utilitaires UI ───────────────────────────────────
function setStatus(msg, type) {
  const badge = document.getElementById('vBadge');
  if (!badge) return;
  badge.textContent = msg;
  badge.className   = 'vbadge vbadge-' + type;
}

function hidePlaceholder() {
  const ph = document.getElementById('viewerPlaceholder');
  if (ph) ph.style.display = 'none';
}

function setPlaceholder(msg) {
  const el = document.getElementById('placeholderMsg');
  if (el) el.textContent = msg;
}
