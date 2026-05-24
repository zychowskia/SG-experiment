const { useState, useEffect, useRef } = React;

function App() {
  const [gameState, setGameState] = useState('welcome');
  const [hasSeenTutorial, setHasSeenTutorial] = useState(false);
  const [gamesList, setGamesList] = useState([]);
  const [currentGame, setCurrentGame] = useState(null);
  const [currentScenario, setCurrentScenario] = useState(null);
  const [playerId, setPlayerId] = useState('');
  const [playerEmail, setPlayerEmail] = useState('');
  const [startTime, setStartTime] = useState(null);

  const [path, setPath] = useState([]);
  const [step, setStep] = useState(0);
  const [maxSteps, setMaxSteps] = useState(6);
  const [expectedPayoff, setExpectedPayoff] = useState(0);
  const [catchProbability, setCatchProbability] = useState(0);
  const [isTimeout, setIsTimeout] = useState(false);

  const [currentGameIndex, setCurrentGameIndex] = useState(0);
  const [totalPayoffs, setTotalPayoffs] = useState(0);
  const [totalOptimalPayoffs, setTotalOptimalPayoffs] = useState(0);

  useEffect(() => {
    fetch('games/index.json')
      .then(r => r.json())
      .then(data => setGamesList(data))
      .catch(err => console.error("Błąd wczytywania gier:", err));
  }, []);

  const onStartWelcome = async () => {
    setCurrentGameIndex(0);
    setTotalPayoffs(0);
    setTotalOptimalPayoffs(0);
    await loadGame(0);
  };

  const loadGame = async (index) => {
    if (!gamesList.length || index >= gamesList.length) return;

    const gameMeta = gamesList[index];
    const req = await fetch(`games/${gameMeta.filename}`);
    const gameData = await req.json();

    const scens = gameData.scenarios || [];
    const chosenScenario = scens.length > 0 ? scens[0] : null;

    setCurrentGame(gameData.original_game);
    setCurrentScenario(chosenScenario);

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

  const handleNextGame = async () => {
    const nextIdx = currentGameIndex + 1;
    if (nextIdx >= gamesList.length) {
      setGameState('final-summary');
    } else {
      setCurrentGameIndex(nextIdx);
      await loadGame(nextIdx);
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
      playerEmail,
      gameId: currentGame.id,
      scenarioId: currentScenario ? currentScenario.id : null,
      path: finalPath,
      decisionTimeMs: elapsedMs,
      expectedPayoff: expP,
      catchProbability: cProb
    };

    console.log("Wysyłanie wyników do Google Sheets...", payload);
    try {
      await fetch("https://script.google.com/macros/s/AKfycbxx--uoG7IIqClG93SxyoyhlQuVilN1RwzaBiRfQL-72-t32qsUhP9mOMTt7d-SSzTa/exec", {
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

  const handleFinish = (finalPath, expP, cProb, timeout = false) => {
    const elapsedMs = Date.now() - startTime;
    setPath(finalPath);
    setExpectedPayoff(timeout ? 0 : expP);
    setCatchProbability(timeout ? 0 : cProb);
    setTotalPayoffs(prev => prev + (timeout ? 0 : expP));

    const optP = currentScenario && currentScenario.solutions && currentScenario.solutions.Rational ? currentScenario.solutions.Rational.eu_rational : 0;
    setTotalOptimalPayoffs(prev => prev + optP);

    setIsTimeout(timeout);
    setGameState('summary');
    submitResults(finalPath, timeout ? 0 : expP, timeout ? 0 : cProb, elapsedMs);
  };

  return (
    <div className="app-container">
      {gameState === 'welcome' && (
        <WelcomeScreen onStart={(nickname, email) => {
          setPlayerId(nickname);
          setPlayerEmail(email);
          onStartWelcome();
        }} disabled={!gamesList.length} gamesCount={gamesList.length} />
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
          currentGameIndex={currentGameIndex}
          totalGames={gamesList.length}
          totalPayoffs={totalPayoffs}
          totalOptimalPayoffs={totalOptimalPayoffs}
        />
      )}
      {gameState === 'summary' && (
        <SummaryScreen
          expPayoff={expectedPayoff}
          optPayoff={currentScenario && currentScenario.solutions && currentScenario.solutions.Rational ? currentScenario.solutions.Rational.eu_rational : 0}
          catchProb={catchProbability}
          totalPayoffs={totalPayoffs}
          totalOptimalPayoffs={totalOptimalPayoffs}
          onRestart={handleNextGame}
          isTimeout={isTimeout}
        />
      )}
      {gameState === 'final-summary' && (
        <FinalSummaryScreen
          totalPayoffs={totalPayoffs}
          totalOptimalPayoffs={totalOptimalPayoffs}
          count={gamesList.length}
          playerId={playerId}
        />
      )}
    </div>
  );
}

function WelcomeScreen({ onStart, disabled, gamesCount }) {
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');

  return (
    <div className="screen-container">
      <div className="card">
        <h1>Gry Obronne</h1>
        <p>
          Witaj w eksperymencie. Przed Tobą <strong>{gamesCount}</strong> zadań. Wcielasz się w rolę <strong>Atakującego</strong>, który potajemnie przemieszcza się po polu gry reprezentowanym w postaci grafu. Twoim przeciwnikiem jest <strong>Obrońca</strong>.
        </p>

        <div className="instruction-list">
          <ul>
            <li><strong>Twój start:</strong> Rozpoczynasz zawsze punkcie oznaczonym <strong>Start Atakującego</strong>.</li>
            <li><strong>Start przeciwnika:</strong> Twój przeciwnik rozpoczyna z punktu <strong>Start Obrońcy</strong>. Jesteś bezpieczny, o ile nie wejdziecie na to samo pole w tym samym kroku gry.</li>
            <li><strong>Cel gry:</strong> Niektore, wyróżnione wierzchołki grafu stanowią <string>Cele</string>. Twoim zadaniem jest wybór jednego z nich i bezpiecznie dotarcie do niego. W takiej sytuacji otrzymasz nagrode. Jeżeli w drodze do Celu zostaniesz złapany przez Obrońcę (tzn. znajdziecie się w tym samym wierzchołku w tym samym kroku gry) otrzymasz karę. Nagrody i kary opisane sa liczbowo w wyróżnionych wierzchołkach - Celach.</li>
            <li>Obrońca przed rozpoczęciem gry przydzielił prawdopodobieństwa ochrony każdego z Celów! Będą one wyświetlone na mapie gry.</li>
            <li><strong>Prawdopodobieństwa:</strong> Na każdej ścieżce Obrońcy znajduje się wartość % prawdopodobieństwa, że Obrońca wybierze właśnie tę ścieżkę. Nie znasz dokładnych ruchów Obrońcy, a jedynie rozkład prawdopodobieństwa jego decyzji. Przeanalizuj zyski i kary oraz szanse powodzenia i wybierz najlepszą według Ciebie drogę do jednego z Celów.</li>
            <li>W każdej grze wykonasz określoną z góry liczbę kroków, która jest wyświetlana w panelu informacyjnym (po lewej stronie ekranu).</li>
            <li><strong>Limit czasu:</strong> Na analizę i wykonanie każdego ruchu masz zawsze <strong>30</strong> lub <strong>60 sekund</strong> (w zależności od złożoności gry). Jeżeli nie zdążysz, runda zostaje przerwana i przejdziesz do następnej (planszy) gry.</li>
          </ul>
        </div>

        <div style={{ textAlign: 'center', marginTop: '1rem' }}>
          <input
            type="text"
            placeholder="Wpisz swój pseudonim..."
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            style={{ padding: '0.75rem', fontSize: '1.2rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.5)', color: '#fff', marginBottom: '1rem', width: '80%', maxWidth: '300px', display: 'block', margin: '0 auto 1rem auto', textAlign: 'center' }}
          />
          <input
            type="email"
            placeholder="Adres e-mail (opcjonalnie)"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ padding: '0.75rem', fontSize: '1.2rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(0,0,0,0.5)', color: '#fff', marginBottom: '1rem', width: '80%', maxWidth: '300px', display: 'block', margin: '0 auto 1rem auto', textAlign: 'center' }}
          />
          <button onClick={() => onStart(nickname.trim(), email.trim())} disabled={disabled || !nickname.trim()} className="btn">
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
      text: "Jesteś Atakującym - zaczynasz w wierzchołku zaznaczonym na pomarańczowo na dole ekranu. Twoim zadaniem jest dotarcie do jednego z zielonych Celów. Przeciwnik (Obrońca) zaczyna u góry.",
      animMode: 'basics'
    },
    {
      title: "Obrona i Prawdopodobieństwo",
      text: "Obrońca nie ma wystarczających zasobów, żeby w pełni kontrolować wszystkie ścieżki w grafie. Ustawił on swoje patrole i ubezpieczył ścieżki do celów z pewnym prawdopodobieństwem. Jeżeli wejdziecie w tym samym kroku na to samo pole, zostajesz złapany (dostajesz karę 🩸), jeśli uda Ci się dotrzeć do celu (i nie będzie w nim patrolu Obrońcy), zdobywasz nagrodę 🏆 widoczną na grafie.",
      animMode: 'probs'
    },
    {
      title: "Twój Ruch",
      text: "Kiedy rozpoczniesz rozgrywkę i spojrzysz na graf, sąsiadujące dostępne dla Ciebie wierzchołki podświetlą się jasnoniebieską obwódką. Klikaj je, aby przejść do wybranego z nich w kolejnym kroku. Gra kończy się w momencie osiągnięcia celu lub upływu dostępnego czasu na dany ruch (30 lub 60 sekund). \n\nW tym przykładzie możesz osiągnąć Cel A w dwóch krokach (przechodząc w pierwszym kroku do wierzchołka v1), a Cel B w jednym kroku. Obrońca oba cele może osiągnąć w jednym kroku. Cel A jest cenniejszy (+0.90), ale też lepiej broniony (90%), cel B natomiast jest słabiej broniony (10%), mniej cenny (+0.40), ale za to z wyższą karą za bycie złapanym (-0.70 w celu B, -0.5 w celu A). \n\nGra polega na oszacowaniu zysków, strat i prawdopodobieństw oraz wybraniu optymalnej decyzji (ścieżki do celu). Powodzenia!",
      animMode: 'moves'
    }
  ];

  return (
    <div className="screen-container">
      <div className="card">
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', textAlign: 'center' }}>{steps[step].title}</h1>
        <div style={{ height: '240px', background: 'rgba(5, 8, 15, 0.5)', borderRadius: '15px', position: 'relative', border: '1px solid rgba(255,255,255,0.1)', overflow: 'hidden', marginBottom: '2rem' }}>

          {/* Animated SVG/CSS elements representing game states */}
          <div style={{ width: '600px', height: '100%', margin: '0 auto', position: 'relative' }}>
            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
              {/* Obrońca edges */}
              <line x1="300" y1="40" x2="100" y2="110" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
              <line x1="300" y1="40" x2="500" y2="110" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />

              {/* Atakujący edges */}
              <line x1="300" y1="200" x2="200" y2="155" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
              <line x1="300" y1="200" x2="500" y2="110" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />

              <line x1="200" y1="155" x2="100" y2="110" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />

              {/* Edge probabilities (shown only or animated in probs state) */}
              {['probs', 'moves'].includes(steps[step].animMode) && (
                <>
                  <rect x="180" y="65" width="40" height="20" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(255,255,255,0.1)" />
                  <text x="200" y="79" fill="#fef08a" fontSize="12" fontWeight="bold" textAnchor="middle">90%</text>

                  <rect x="380" y="65" width="40" height="20" rx="4" fill="rgba(15, 23, 42, 0.95)" stroke="rgba(255,255,255,0.1)" />
                  <text x="400" y="79" fill="#fef08a" fontSize="12" fontWeight="bold" textAnchor="middle">10%</text>
                </>
              )}
            </svg>

            <div className={`t-node t-def ${steps[step].animMode === 'basics' ? 'pulse' : ''}`} style={{ top: 40, left: 300 }}>Start<br />Obrońcy</div>
            <div className={`t-node t-att ${steps[step].animMode === 'basics' ? 'pulse-y' : ''}`} style={{ top: 200, left: 300 }}>Twój<br />Start</div>

            <div className={`t-node t-target t-target-left ${steps[step].animMode === 'probs' ? 'pulse-danger' : ''}`} style={{ top: 110, left: 100, backgroundColor: '#047857' }}>
              <div>Cel A<br /><span style={{ fontSize: '0.6em', lineHeight: '1.2' }}>🏆 +0.90<br />🩸 -0.50</span></div>
            </div>

            <div className={`t-node t-target t-target-right ${steps[step].animMode === 'probs' ? 'pulse-safe' : ''} ${steps[step].animMode === 'moves' ? 'node-reachable' : ''}`} style={{ top: 110, left: 500, backgroundColor: '#047857' }}>
              <div>Cel B<br /><span style={{ fontSize: '0.6em', lineHeight: '1.2' }}>🏆 +0.40<br />🩸 -0.70</span></div>
            </div>

            <div className={`t-node t-mid ${steps[step].animMode === 'moves' ? 'node-reachable' : ''}`} style={{ top: 155, left: 200 }}>v1</div>

            {steps[step].animMode === 'moves' && <div className="t-cursor" />}
          </div>

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

function GameScreen({ game, scenario, path, step, maxSteps, onStepUpdate, onFinish, currentGameIndex, totalGames, totalPayoffs, totalOptimalPayoffs }) {
  const cyRef = useRef(null);
  const containerRef = useRef(null);
  const pathRef = useRef(path);
  const isComplex = game ? (game.targets.length >= 7 || game.rounds > 2) : false;
  const initialTime = isComplex ? 60 : 30;
  const [timeLeft, setTimeLeft] = useState(initialTime);

  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    setTimeLeft(initialTime);
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onFinishRef.current(pathRef.current, 0, 0, true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [game, initialTime]);

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
        extendedLabel += "\n\n🏆: +" + attackerReward.toFixed(2);
        extendedLabel += "\n🩸: " + attackerPenalty.toFixed(2);
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
            'font-size': '18px',
            'font-weight': '600',
            'width': 140,
            'height': 140,
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
            'width': 80,
            'height': 80,
            'font-size': '16px'
          }
        },
        {
          selector: 'node[?isTarget]',
          style: {
            'border-color': '#10b981',
            'border-width': 4,
            'shape': 'ellipse',
            'background-color': '#047857',
            'font-size': '36px',
            'width': 260,
            'height': 260,
            'text-wrap': 'wrap'
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
            'font-size': '28px',
            'font-weight': 'bold',
            'text-background-color': 'rgba(15, 23, 42, 0.95)',
            'text-background-opacity': 1,
            'text-background-shape': 'roundrectangle',
            'text-background-padding': '10px',
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

          <div style={{ textAlign: 'center', background: 'rgba(0,0,0,0.4)', padding: '1.5rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '2rem' }}>
            <div style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Pozostały czas</div>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: timeLeft <= 10 ? '#ef4444' : '#f8fafc', textShadow: timeLeft <= 10 ? '0 0 15px rgba(239, 68, 68, 0.8)' : 'none' }}>
              00:{timeLeft.toString().padStart(2, '0')}
            </div>
          </div>

          <div className="stats-row"><span className="stats-label">Zadanie:</span><span className="stats-value">{currentGameIndex + 1} / {totalGames}</span></div>
          <div className="stats-row" style={{ marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}><span className="stats-label">Twój Krok w grze:</span><span className="stats-value">{step} / {maxSteps}</span></div>

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
            <div className="legend-item"><div className="legend-color target"></div>Cel</div>
            <p style={{ marginTop: '1.5rem', color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.5', background: 'rgba(255,255,255,0.05)', padding: '1rem', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.05)' }}>
              Klikaj na wierzchołki z jasnoniebieską obwódką, aby wykonać ruch.
            </p>
          </div>
        </div>
      </div>
      <div className="graph-container">
        <div id="cy" ref={containerRef} style={{ width: '100%', height: '100%' }}></div>
      </div>
    </div>
  );
}

function SummaryScreen({ expPayoff, optPayoff, catchProb, totalPayoffs, totalOptimalPayoffs, onRestart, isTimeout }) {
  return (
    <div className="screen-container">
      <div className="card" style={{ textAlign: 'center', maxWidth: '800px' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem', color: isTimeout ? 'var(--danger)' : 'var(--text-main)' }}>
          {isTimeout ? "Koniec Czasu ⏳" : "Scenariusz ukończony"}
        </h1>

        {isTimeout && (
          <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)', marginBottom: '2rem' }}>
            Niestety, nie zdążyłeś przekraść się do celu! Twój wynik to 0.
          </p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '1.25rem' }}>
            <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Twoja {isTimeout ? "wypłata" : "oczekiwana wypłata"}:</div>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: expPayoff >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {expPayoff > 0 ? "+" : ""}{expPayoff.toFixed(3)}
            </div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Optymalna wypłata w tej grze: <strong style={{ color: 'var(--text-main)' }}>{optPayoff > 0 ? "+" : ""}{optPayoff.toFixed(3)}</strong>
            </div>
          </div>

          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '1.5rem', borderRadius: '1.25rem' }}>
            <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Prawdopodobieństwo złapania:</div>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--warning)' }}>
              {(catchProb * 100).toFixed(1)}%
            </div>
          </div>

          <div style={{ gridColumn: 'span 2', background: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around' }}>
              <div>
                <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Twój skumulowany wynik:</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: totalPayoffs >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {totalPayoffs > 0 ? "+" : ""}{totalPayoffs.toFixed(3)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>Skumulowany optymalny wynik:</div>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
                  {totalOptimalPayoffs > 0 ? "+" : ""}{totalOptimalPayoffs.toFixed(3)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <button onClick={onRestart} className="btn" style={{ padding: '1.25rem 3rem', fontSize: '1.2rem' }}>Kolejny scenariusz</button>
      </div>
    </div>
  );
}

function FinalSummaryScreen({ totalPayoffs, totalOptimalPayoffs, count, playerId }) {

  const [leaderboard, setLeaderboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pobieranie tablicy wyników - backend musi obsługiwać GET i zwracać tablicę np: [{"playerId": "Jan", "score": 12.3}, ...]
    fetch("https://script.google.com/macros/s/AKfycbxx--uoG7IIqClG93SxyoyhlQuVilN1RwzaBiRfQL-72-t32qsUhP9mOMTt7d-SSzTa/exec?action=getLeaderboard")
      .then(r => r.json())
      .then(data => {
        let list = Array.isArray(data) ? data : [];
        // Aktualizujemy wynik gracza na liście lub dodajemy go
        const existing = list.find(p => p.playerId === playerId);
        if (existing) {
          existing.score = totalPayoffs;
        } else {
          list.push({ playerId, score: totalPayoffs });
        }
        list.sort((a, b) => b.score - a.score);
        setLeaderboard(list);
        setLoading(false);
      })
      .catch(err => {
        console.error("Leaderboard fetch error:", err);
        setLeaderboard([{ playerId, score: totalPayoffs }]);
        setLoading(false);
      });
  }, [totalPayoffs, playerId]);

  const getLeaderboardRows = () => {
    if (!leaderboard) return [];
    const playerIndex = leaderboard.findIndex(p => p.playerId === playerId);

    let indicesToShow = new Set();
    for (let i = 0; i < 3 && i < leaderboard.length; i++) indicesToShow.add(i);
    for (let i = playerIndex - 3; i <= playerIndex + 3; i++) {
      if (i >= 0 && i < leaderboard.length) indicesToShow.add(i);
    }

    let sortedIndices = Array.from(indicesToShow).sort((a, b) => a - b);
    let rows = [];
    let lastIdx = -1;

    for (let idx of sortedIndices) {
      if (lastIdx !== -1 && idx > lastIdx + 1) {
        rows.push({ type: 'ellipsis', key: 'e' + idx });
      }
      rows.push({ type: 'row', rank: idx + 1, ...leaderboard[idx], isCurrent: idx === playerIndex, key: 'r' + idx });
      lastIdx = idx;
    }
    return rows;
  };

  return (
    <div className="screen-container" style={{ padding: '2rem 0' }}>
      <div className="card" style={{ textAlign: 'center', maxWidth: '800px', width: '90%' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Eksperyment Zakończony!</h1>
        <p style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Gratulacje {playerId}, ukończyłeś wszystkie {count} przygotowanych scenariuszy.</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', margin: '2rem 0' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '2rem', borderRadius: '1.25rem' }}>
            <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Twoja ostateczna skumulowana wypłata:</div>
            <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: totalPayoffs >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {totalPayoffs > 0 ? "+" : ""}{totalPayoffs.toFixed(3)}
            </div>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '2rem', borderRadius: '1.25rem' }}>
            <div style={{ fontSize: '1.1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Optymalna skumulowana wypłata:</div>
            <div style={{ fontSize: '3.5rem', fontWeight: 'bold', color: 'var(--text-main)' }}>
              {totalOptimalPayoffs > 0 ? "+" : ""}{totalOptimalPayoffs.toFixed(3)}
            </div>
          </div>
        </div>

        {/* Tabela Rankingowa */}
        <div style={{ marginTop: '2rem', background: 'rgba(0,0,0,0.4)', borderRadius: '1rem', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Ranking Graczy</h2>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Ładowanie rankingu...</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '1.1rem' }}>
              <thead>
                <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <th style={{ padding: '0.75rem' }}>Miejsce</th>
                  <th style={{ padding: '0.75rem' }}>Gracz</th>
                  <th style={{ padding: '0.75rem' }}>Suma wypłat</th>
                </tr>
              </thead>
              <tbody>
                {getLeaderboardRows().map((row) => {
                  if (row.type === 'ellipsis') {
                    return <tr key={row.key}>
                      <td colSpan="3" style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>...</td>
                    </tr>;
                  }
                  return (
                    <tr key={row.key} style={{
                      background: row.isCurrent ? 'rgba(255,255,255,0.1)' : 'transparent',
                      fontWeight: row.isCurrent ? 'bold' : 'normal',
                      borderBottom: '1px solid rgba(255,255,255,0.05)'
                    }}>
                      <td style={{ padding: '0.75rem' }}>{row.rank}</td>
                      <td style={{ padding: '0.75rem', color: row.isCurrent ? 'var(--text-main)' : '#fff' }}>{row.playerId}</td>
                      <td style={{ padding: '0.75rem', color: row.score >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                        {row.score > 0 ? '+' : ''}{row.score.toFixed(3)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ fontSize: '1.1rem', marginTop: '2rem' }}>Dziękujemy bardzo za Twój czas i uczestnictwo w badaniu.</p>
        <p style={{ fontSize: '1.1rem', marginTop: '1rem', color: 'var(--text-muted)' }}>Dane zostały pomyślnie zapisane. Możesz bezpiecznie zamknąć tę stronę.</p>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
