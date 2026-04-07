const { useState, useEffect, useRef } = React;

function App() {
  const [gameState, setGameState] = useState('welcome');
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false);
  const [gamesList, setGamesList] = useState([]);
  const [currentGame, setCurrentGame] = useState(null);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [playerId, setPlayerId] = useState('');
  const [startTime, setStartTime] = useState(null);

  const [path, setPath] = useState([]);
  const [step, setStep] = useState(0);
  const [maxSteps, setMaxSteps] = useState(6);
  const [expectedPayoff, setExpectedPayoff] = useState(0);
  const [catchProbability, setCatchProbability] = useState(0);

  useEffect(() => {
    setPlayerId('P-' + Math.random().toString(36).substr(2, 9).toUpperCase());

    fetch('games/index.json')
      .then(r => r.json())
      .then(data => setGamesList(data))
      .catch(err => console.error("Błąd wczytywania gier:", err));
  }, []);

  const startGame = async () => {
    if (!gamesList.length) return;

    const gameMeta = gamesList[Math.floor(Math.random() * gamesList.length)];
    const req = await fetch(`games/${gameMeta.filename}`);
    const gameData = await req.json();

    const scens = gameData.scenarios || [];
    const rndScenario = scens.length > 0 ? scens[Math.floor(Math.random() * scens.length)] : null;

    setCurrentGame(gameData.original_game);
    setCurrentScenario(rndScenario);

    const spawnId = gameData.original_game.spawn;
    setPath([spawnId]);
    setStep(0);
    setMaxSteps(gameData.original_game.rounds || 6);

    if (hasSeenTutorial) {
      setStartTime(Date.now());
      setGameState('playing');
    } else {
      setGameState('tutorial');
    }
  };

  const startPlaying = () => {
    setHasSeenTutorial(true);
    setStartTime(Date.now());
    setGameState('playing');
  };

  const submitResults = async (finalPath, expP, cProb, elapsedMs) => {
    const payload = {
      playerId,
      gameId: currentGame.id,
      scenarioId: currentScenario ? currentScenario.id : null,
      path: finalPath,
      decisionTimeMs: elapsedMs,
      expectedPayoff: expP,
      catchProbability: cProb
    };

    console.log("Wysyłanie wyników do Google Sheets...", payload);
    try {
      await fetch("https://script.google.com/macros/s/AKfycbydRp6TFdXdK2_YBHavr5ijzRNoCpeOuwvTGNzMwOCs9ZuxN0F1LR0fW2m914gNcdtD/exec", {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(payload)
      });
      console.log("Zakończono pomyślnie wysyłanie do Sheets.");
    } catch (err) {
      console.error("Błąd sieci podczas wysyłania logów:", err);
    }
  };

  const handleFinish = (finalPath, expP, cProb) => {
    const elapsedMs = Date.now() - startTime;
    setPath(finalPath);
    setExpectedPayoff(expP);
    setCatchProbability(cProb);
    setGameState('summary');
    submitResults(finalPath, expP, cProb, elapsedMs);
  };

  return (
    <div className="app-container">
      {gameState === 'welcome' && (
        <WelcomeScreen onStart={startGame} disabled={!gamesList.length} />
      )}
      {gameState === 'tutorial' && (
        <TutorialScreen onFinish={startPlaying} />
      )}
      {gameState === 'playing' && currentGame && (
        <GameScreen
          game={currentGame}
          scenario={currentScenario}
          path={path}
          step={step}
          maxSteps={maxSteps}
          onStepUpdate={(newPath) => {
            setPath(newPath);
            setStep(newPath.length - 1);
          }}
          onFinish={handleFinish}
        />
      )}
      {gameState === 'summary' && (
        <SummaryScreen
          expPayoff={expectedPayoff}
          catchProb={catchProbability}
          onRestart={startGame}
        />
      )}
    </div>
  );
}

function WelcomeScreen({ onStart, disabled }) {
  return (
    <div className="screen-container">
      <div className="card">
        <h1>Gra Magazynowa</h1>
        <p>
          Witaj w eksperymencie. Wcielasz się w rolę <strong>Atakującego</strong>, który potajemnie przemieszcza się po korytarzach magazynu reprezentowanego przez graf. Twoim przeciwnikiem jest <strong>Obrońca</strong>.
        </p>

        <div className="instruction-list">
          <ul>
            <li><strong>Twój start:</strong> Gra rozpoczyna się w punkcie oznaczonym <strong>Start Atakującego</strong>. Zawsze będziesz stąd ruszać.</li>
            <li><strong>Start przeciwnika:</strong> Twój przeciwnik rozpoczyna z punktu <strong>Start Obrońcy</strong>. Jesteś bezpieczny, o ile nie wejdziecie na to samo pole w tym samym kroku.</li>
            <li><strong>Cele:</strong> W magazynie rozrzucone są cele. Twoim celem jest osiągnięcie wybranego miejsca (nagroda za dotarcie). W grze wykonasz w sumie określoną z góry liczbę kroków. Obrońca przed rozpoczęciem gry przydzielił prawdopodobieństwa ochrony każdego z nich! Będą one wyświetlone na mapie.</li>
            <li><strong>Prawdopodobieństwa:</strong> Na każdej ścieżce Obrońcy znajduje się wartość % prawdopodobieństwa, że obrońca wybierze właśnie tę ścieżkę. Nie znasz dokładnych ruchów Obrońcy, a jedynie rozkład prawdopodobieństwa jego decyzji. Przeanalizuj zyski i kary oraz szanse powodzenia i wybierz najlepszą według Ciebie drogę do jednego z Celów.</li>
          </ul>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <button onClick={onStart} disabled={disabled} className="btn">
            {disabled ? 'Wczytywanie gier...' : 'Zobacz instruktaż i zagraj!'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TutorialScreen({ onFinish }) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: "Na czym polega gra?",
      text: "Jesteś Atakującym - zaczyna w wierzchołku zaznaczonym na pomarańczowo na dole ekranu. Twoim zadaniem jest przekradnięcie się do jednego z zielonych Celów. Przeciwnik (Obrońca) zaczyna u góry.",
      animMode: 'basics'
    },
    {
      title: "Obrona i Prawdopodobieństwo",
      text: "Obrońca nie może zatrzymać Cię wszędzie naraz. Ustawił on swoje patrole i ubezpieczył ścieżki do celów z pewnym prawdopodobieństwem. Jeżeli wejdziecie w tym samym kroku na to samo pole, zostajesz złapany (dostajesz karę 🩸), jeśli uda Ci się dotrzeć do celu, który nie jest broniony, zdobywasz nagrodę 🏆 widoczną na grafie.",
      animMode: 'probs'
    },
    {
      title: "Twój Ruch",
      text: "Kiedy rozpoczniesz rozgrywkę i spojrzysz na graf, sąsiadujące dostępne dla Ciebie wierzchołki podświetlą się jasnoniebieską obwódką. Klikaj je, aby przejść do wybranego z nich w kolejnym kroku. Gra kończy się w momencie osiągnięcia celu lub upływu dostępnego czasu. \n\nW tym przykładzie możesz osiągnąć Cel A w dwóch krokach, a Cel B w jednym kroku. Obrońca oba cele może osiągnąć w jednym kroku. Cel A jest cenniejszy (+0.90), ale też lepiej broniony (90%), cel B natomiast jest słabiej broniony (10%), mniej cenny (+0.40), ale za to z wysoką karą za bycie złapanym (-0.70). \n\nGra polega na oszacowaniu zysków, strat i prawdopodobieństw. Powodzenia!",
      animMode: 'moves'
    }
  ];

  return (
    <div className="screen-container">
      <div className="card" style={{ maxWidth: '700px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', textAlign: 'center' }}>{steps[step].title}</h1>
        <div style={{ height: '240px', background: 'rgba(5, 8, 15, 0.5)', borderRadius: '15px', position: 'relative', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: '2rem' }}>

          {/* Animated SVG/CSS elements representing game states */}
          <div className="tutorial-map">
            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
              {/* Obrońca edges */}
              <line x1="350" y1="40" x2="150" y2="110" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
              <line x1="350" y1="40" x2="550" y2="110" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />

              {/* Atakujący edges */}
              <line x1="350" y1="200" x2="250" y2="155" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
              <line x1="350" y1="200" x2="550" y2="110" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />

              <line x1="250" y1="155" x2="150" y2="110" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />

              {/* Edge probabilities (shown only or animated in probs state) */}
              {['probs', 'moves'].includes(steps[step].animMode) && (
                <>
                  <rect x="230" y="65" width="40" height="20" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(255,255,255,0.1)" />
                  <text x="250" y="79" fill="#fef08a" fontSize="12" fontWeight="bold" textAnchor="middle">90%</text>

                  <rect x="430" y="65" width="40" height="20" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(255,255,255,0.1)" />
                  <text x="450" y="79" fill="#fef08a" fontSize="12" fontWeight="bold" textAnchor="middle">10%</text>
                </>
              )}
            </svg>

            <div className={`t-node t-def ${steps[step].animMode === 'basics' ? 'pulse' : ''}`} style={{ top: 40, left: 350 }}>Start<br />Obrońcy</div>
            <div className={`t-node t-att ${steps[step].animMode === 'basics' ? 'pulse-y' : ''}`} style={{ top: 200, left: 350 }}>Twój<br />Start</div>

            <div className={`t-node t-target t-target-left ${steps[step].animMode === 'probs' ? 'pulse-danger' : ''}`} style={{ top: 110, left: 150, backgroundColor: '#047857' }}>
              <div>Cel A<br /><span style={{ fontSize: '0.6em', lineHeight: '1.2' }}>🏆 +0.90<br />🩸 -0.50</span></div>
            </div>

            <div className={`t-node t-target t-target-right ${steps[step].animMode === 'probs' ? 'pulse-safe' : ''} ${steps[step].animMode === 'moves' ? 'node-reachable' : ''}`} style={{ top: 110, left: 550, backgroundColor: '#047857' }}>
              <div>Cel B<br /><span style={{ fontSize: '0.6em', lineHeight: '1.2' }}>🏆 +0.40<br />🩸 -0.70</span></div>
            </div>

            <div className={`t-node t-mid ${steps[step].animMode === 'moves' ? 'node-reachable' : ''}`} style={{ top: 155, left: 250 }}>vX</div>
          </div>
          {steps[step].animMode === 'moves' && <div className="t-cursor" />}

        </div>
        <p style={{ minHeight: '80px', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}>{steps[step].text}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
          <button className="btn" disabled={step === 0} onClick={() => setStep(step - 1)} style={{ background: 'rgba(255,255,255,0.1)', boxShadow: 'none' }}>Wstecz</button>
          {step < steps.length - 1 ? (
            <button className="btn" onClick={() => setStep(step + 1)}>Dalej</button>
          ) : (
            <button className="btn" onClick={onFinish} style={{ background: 'var(--success)' }}>Zrozumiałem, grajmy!</button>
          )}
        </div>
      </div>
    </div>
  );
}

function GameScreen({ game, scenario, path, step, maxSteps, onStepUpdate, onFinish }) {
  const cyRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !game) return;

    const edgeProbs = {};
    if (scenario && scenario.defender_strategy) {
      scenario.defender_strategy.forEach(strat => {
        for (let i = 0; i < strat.path.length - 1; i++) {
          let u = strat.path[i];
          let v = strat.path[i + 1];
          let edgeKey = u < v ? u + "-" + v : v + "-" + u;
          if (!edgeProbs[edgeKey]) edgeProbs[edgeKey] = 0;
          edgeProbs[edgeKey] += strat.prob;
        }
      });
    }

    const targets = game.targets;
    const attackerSpawn = game.spawn;
    const defenderSpawn = 0;

    // Obliczanie sztywnych pozycji układu (preset)
    const posMap = {};
    const SPACING = 300;
    const startX = -((targets.length - 1) * SPACING) / 2;

    targets.forEach((t, i) => {
      posMap[t] = { x: startX + i * SPACING, y: 0 };
    });
    posMap[defenderSpawn] = { x: 0, y: -600 };
    posMap[attackerSpawn] = { x: 0, y: 600 };

    // Obliczanie sąsiedztwa
    const adj = {};
    for (let i = 0; i < game.graphConfig.vertexCount; i++) adj[i] = [];
    game.graphConfig.edges.forEach(e => {
      adj[e.from].push(e.to);
      adj[e.to].push(e.from);
    });

    // BFS by umiejscowic pośrednie węzły
    function assignIntermediatePositions(startNode, startY) {
      targets.forEach(t => {
        let q = [[startNode]];
        let visited = new Set([startNode]);
        let targetPath = null;
        while (q.length > 0) {
          let p = q.shift();
          let curr = p[p.length - 1];
          if (curr === t) { targetPath = p; break; }
          adj[curr].forEach(nxt => {
            if (!visited.has(nxt) && (!targets.includes(nxt) || nxt === t)) {
              visited.add(nxt);
              q.push([...p, nxt]);
            }
          });
        }
        if (targetPath) {
          let numSteps = targetPath.length - 1;
          for (let i = 1; i < targetPath.length - 1; i++) {
            let v = targetPath[i];
            let fraction = i / numSteps;
            posMap[v] = {
              x: posMap[t].x * fraction,
              y: startY + (0 - startY) * fraction
            };
          }
        }
      });
    }

    assignIntermediatePositions(defenderSpawn, -600);
    assignIntermediatePositions(attackerSpawn, 600);

    const elements = [];

    for (let i = 0; i < game.graphConfig.vertexCount; i++) {
      const isTarget = game.targets.includes(i);
      const isAttackerSpawn = game.spawn === i;
      const isDefenderSpawn = 0 === i; // defender typically starts at 0

      let label = "v" + i;
      let attackerPenalty = game.vertexAttackerPenalties[i];
      let attackerReward = 0;
      if (isTarget) {
        let targetIdx = game.targets.indexOf(i);
        attackerReward = game.targetAttackerRewards[targetIdx];
      }

      let extendedLabel = label;
      if (isAttackerSpawn) extendedLabel += "\n[Twój start]";
      if (isDefenderSpawn) extendedLabel += "\n[Start Obrońcy]";

      if (isTarget) {
        extendedLabel += "\n\n🏆 Nagroda: +" + attackerReward.toFixed(2);
        extendedLabel += "\n\n🩸 Kara: " + attackerPenalty.toFixed(2);
      }

      elements.push({
        data: {
          id: i.toString(),
          label: extendedLabel,
          isTarget,
          isAttackerSpawn,
          isDefenderSpawn,
          isIntermediate: (!isTarget && !isAttackerSpawn && !isDefenderSpawn),
          attackerPenalty,
          attackerReward
        },
        position: posMap[i]
      });
    }

    game.graphConfig.edges.forEach((e) => {
      if (e.from < e.to) {
        let edgeKey = e.from + "-" + e.to;
        let p = edgeProbs[edgeKey] || 0;
        let edgeLabel = p > 0 ? (p * 100).toFixed(1) + "%" : "";

        elements.push({
          data: {
            id: "e" + edgeKey,
            source: e.from.toString(),
            target: e.to.toString(),
            label: edgeLabel
          }
        });
      }
    });

    const cy = cytoscape({
      container: containerRef.current,
      elements: elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'rgba(30, 41, 59, 0.9)',
            'border-width': 2,
            'border-color': 'rgba(255,255,255,0.1)',
            'label': 'data(label)',
            'text-wrap': 'wrap',
            'text-valign': 'center',
            'text-halign': 'center',
            'color': '#f8fafc',
            'font-size': '14px',
            'font-weight': '600',
            'width': 130,
            'height': 130,
            'font-family': 'Inter',
            'text-outline-color': '#000',
            'text-outline-width': '2px',
          }
        },
        {
          selector: 'node[?isAttackerSpawn]',
          style: {
            'border-color': '#f59e0b',
            'border-width': 4,
            'background-color': '#d97706',
            'shape': 'round-rectangle',
            'width': 120,
            'height': 90
          }
        },
        {
          selector: 'node[?isDefenderSpawn]',
          style: {
            'border-color': '#a78bfa',
            'border-width': 4,
            'background-color': '#6d28d9',
            'shape': 'round-rectangle',
            'width': 120,
            'height': 90
          }
        },
        {
          selector: 'node[?isIntermediate]',
          style: {
            'width': 70,
            'height': 70,
            'font-size': '13px'
          }
        },
        {
          selector: 'node[?isTarget]',
          style: {
            'border-color': '#10b981',
            'border-width': 4,
            'shape': 'ellipse',
            'background-color': '#047857',
            'font-size': '15px',
            'width': 160,
            'height': 160
          }
        },
        {
          selector: 'node.highlighted',
          style: {
            'background-color': '#f59e0b',
            'border-color': '#ffffff',
            'border-width': 5,
            'box-shadow': '0 0 30px #f59e0b'
          }
        },
        {
          selector: 'node.reachable',
          style: {
            'border-style': 'solid',
            'border-color': '#60a5fa',
            'border-width': 5,
            'opacity': 0.9
          }
        },
        {
          selector: 'edge',
          style: {
            'width': 4,
            'line-color': 'rgba(255, 255, 255, 0.15)',
            'curve-style': 'bezier',
            'target-arrow-shape': 'none',
            'label': 'data(label)',
            'color': '#fef08a',
            'font-family': 'Inter',
            'font-size': '16px',
            'font-weight': 'bold',
            'text-background-color': 'rgba(15, 23, 42, 0.95)',
            'text-background-opacity': 1,
            'text-background-shape': 'roundrectangle',
            'text-background-padding': '6px',
            'edge-text-rotation': 'autorotate',
            'text-border-width': 1,
            'text-border-color': 'rgba(255,255,255,0.1)'
          }
        }
      ],
      layout: {
        name: 'preset',
        padding: 50
      },
      userZoomingEnabled: true,
      userPanningEnabled: true
    });

    cyRef.current = cy;

    return () => { cy.destroy(); }
  }, [game, scenario]);

  useEffect(() => {
    if (!cyRef.current || !game) return;
    const cy = cyRef.current;

    cy.elements().removeClass('highlighted').removeClass('reachable');
    path.forEach(v => cy.getElementById(v.toString()).addClass('highlighted'));

    const currentNode = path[path.length - 1];
    const isTarget = game.targets.includes(currentNode);

    if (step >= maxSteps || (isTarget && step > 0)) {
      setTimeout(() => evaluateEnd(path), 500);
      return;
    }

    cy.getElementById(currentNode.toString()).addClass('reachable');
    const edges = cy.getElementById(currentNode.toString()).connectedEdges();
    edges.forEach(e => {
      const u = e.source().id();
      const v = e.target().id();
      cy.getElementById(u === currentNode.toString() ? v : u).addClass('reachable');
    });

    const tapHandler = (e) => {
      const node = e.target;
      if (node === cy) return;
      if (node.hasClass('reachable')) {
        const newV = parseInt(node.id());
        onStepUpdate([...path, newV]);
      } else {
        alert(`Jesteś w wierzchołku v${currentNode}, który nie jest bezpośrednio połączony z wybranym wierzchołkiem. Wybierz inny wierzchołek do przemieszczenia się (jeden z tych z niebieską obwódką).`);
      }
    };

    cy.on('tap', 'node', tapHandler);
    return () => cy.off('tap', 'node', tapHandler);
  }, [path, step, maxSteps, game]);

  const evaluateEnd = (finalPath) => {
    let expectedPayoff = 0;
    let catchProbability = 0;

    if (scenario && scenario.defender_strategy) {
      let u_a_expected = 0;
      let caught_prob = 0;

      for (let strat of scenario.defender_strategy) {
        const defPath = strat.path;
        const prob = strat.prob;

        let caught = false;
        let u_a = 0;

        for (let i = 0; i < finalPath.length; i++) {
          let v_a = finalPath[i];
          let v_d = i < defPath.length ? defPath[i] : defPath[defPath.length - 1];

          if (v_a === v_d) {
            caught = true;
            u_a = game.vertexAttackerPenalties[v_a] || -0.01;
            break;
          }

          if (game.targets.includes(v_a)) {
            let targetIdx = game.targets.indexOf(v_a);
            u_a = game.targetAttackerRewards[targetIdx];
            break;
          }
        }

        u_a_expected += prob * u_a;
        if (caught) caught_prob += prob;
      }
      expectedPayoff = u_a_expected;
      catchProbability = caught_prob;
    }

    onFinish(finalPath, expectedPayoff, catchProbability);
  };

  return (
    <div className="game-layout">
      <div className="sidebar">
        <div className="sidebar-section">
          <h2>Monitor rozgrywki</h2>
          <div className="stats-row"><span className="stats-label">Twój Krok:</span><span className="stats-value">{step} / {maxSteps}</span></div>

          <div className="path-box">
            <div style={{ color: 'var(--text-muted)', marginBottom: '0.75rem', fontSize: '0.9rem' }}>Odwiedzone wierzchołki:</div>
            <div className="path-nodes">
              {path.map((n, i) => (
                <div key={i} className="path-node">v{n}</div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: '2.5rem' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', color: 'var(--text-main)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>Legenda Mapy</h3>
            <div className="legend-item"><div className="legend-color att"></div>Start Atakującego (Twój)</div>
            <div className="legend-item"><div className="legend-color def"></div>Start Obrońcy</div>
            <div className="legend-item"><div className="legend-color target"></div>Cel strategiczny</div>
            <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              Klikaj na wierzchołki z jasnoniebieską obwódką, aby wykonać ruch.
            </p>
          </div>
        </div>
      </div>
      <div className="graph-container">
        <div id="cy" ref={containerRef}></div>
      </div>
    </div>
  );
}

function SummaryScreen({ expPayoff, catchProb, onRestart }) {
  return (
    <div className="screen-container">
      <div className="card" style={{ textAlign: 'center' }}>
        <h1>Koniec rozgrywki!</h1>
        <p style={{ marginBottom: '0' }}>Przeanalizowaliśmy wybraną przez Ciebie ścieżkę w zestawieniu z ukrytą strategią rozkładu ochrony celów Obrońcy.</p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '2.5rem', margin: '3rem 0' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '2rem', borderRadius: '1.25rem', minWidth: '220px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Oczekiwana Wypłata</div>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', textShadow: '0 5px 15px rgba(0,0,0,0.5)', color: expPayoff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {expPayoff > 0 ? "+" : ""}{expPayoff.toFixed(3)}
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '2rem', borderRadius: '1.25rem', minWidth: '220px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Ryzyko złapania</div>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', textShadow: '0 5px 15px rgba(0,0,0,0.5)', color: catchProb > 0.5 ? 'var(--danger)' : 'var(--success)' }}>
              {(catchProb * 100).toFixed(1)}%
            </div>
          </div>
        </div>

        <button onClick={onRestart} className="btn" style={{ padding: '1.25rem 3rem', fontSize: '1.2rem' }}>Kolejny scenariusz</button>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
