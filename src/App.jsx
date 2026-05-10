import { useState } from "react";
import { createRoom, joinRoom, listenToRoom, startGame, drawCard, discardCard, callFiver, playRobo, playIntercambio, playReinicio, playDobleDescarte } from "./services/roomService";
import CardView from "./components/CardView";

function App() {
  const [screen, setScreen] = useState("home");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [selectedCards, setSelectedCards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionMode, setActionMode] = useState(null); // null | "robo" | "intercambio" | "reinicio" | "doble-descarte"

  async function handleCreate() {
    if (!playerName.trim()) return setError("Escribe tu nombre");
    try {
      const result = await createRoom(playerName);
      setRoomCode(result.code); setPlayerId(result.playerId);
      listenToRoom(result.code, setRoom); setScreen("lobby");
    } catch { setError("Error al crear la sala"); }
  }

  async function handleJoin() {
    if (!playerName.trim()) return setError("Escribe tu nombre");
    if (!joinCode.trim()) return setError("Escribe el código de sala");
    try {
      const result = await joinRoom(joinCode.toUpperCase(), playerName);
      setRoomCode(result.code); setPlayerId(result.playerId);
      listenToRoom(result.code, setRoom); setScreen("lobby");
    } catch (e) {
      const msgs = { SALA_NO_ENCONTRADA: "Sala no encontrada", PARTIDA_EN_CURSO: "La partida ya empezó", SALA_LLENA: "Sala llena" };
      setError(msgs[e.message] || "Error al unirse");
    }
  }

  async function handleStart() {
    if (room.players.length < 3) return setError("Mínimo 3 jugadores");
    await startGame(roomCode);
  }

  async function handleDraw() {
    if (loading) return;
    setLoading(true);
    try { await drawCard(roomCode, playerId); setSelectedCards([]); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleDiscard() {
    if (selectedCards.length === 0) return setError("Selecciona una carta");
    if (loading) return;
    setLoading(true);
    try { await discardCard(roomCode, playerId, selectedCards[0].id); setSelectedCards([]); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleFiver() {
    if (loading) return;
    setLoading(true);
    try { await callFiver(roomCode, playerId); }
    catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleAttackPlayer(targetId) {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const isCombo = selectedCards.length === 2;
      if (actionMode === "robo") await playRobo(roomCode, playerId, targetId, isCombo);
      if (actionMode === "intercambio") {
        const giveCard = selectedCards.find(c => c.subtype !== "intercambio");
        if (!giveCard) { setError("Selecciona también la carta que vas a dar"); setLoading(false); return; }
        await playIntercambio(roomCode, playerId, targetId, giveCard.id, isCombo);
      }
      if (actionMode === "reinicio") await playReinicio(roomCode, playerId, targetId, isCombo);
      setSelectedCards([]); setActionMode(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  async function handleDobleDescarte() {
    if (loading) return;
    setLoading(true);
    try {
      const isCombo = selectedCards.filter(c => c.subtype === "doble-descarte").length === 2;
      const toDiscard = selectedCards.filter(c => c.subtype !== "doble-descarte" || isCombo);
      await playDobleDescarte(roomCode, playerId, toDiscard.map(c => c.id), isCombo);
      setSelectedCards([]); setActionMode(null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  function toggleCard(card) {
    setSelectedCards(prev => {
      const exists = prev.find(c => c.id === card.id);
      if (exists) return prev.filter(c => c.id !== card.id);
      return [...prev, card];
    });
    setError("");

    // Detectar modo de acción automáticamente
    if (card.type === "especial") {
      setActionMode(card.subtype);
    }
  }

  const isHost = room?.players?.find(p => p.id === playerId)?.isHost;
  const myHand = room?.players?.find(p => p.id === playerId)?.hand || [];
  const otherPlayers = room?.players?.filter(p => p.id !== playerId) || [];
  const isMyTurn = room?.currentTurn === playerId;
  const isSiege = room?.status === "siege";
  const isSiegeTarget = room?.siegeTarget === playerId;
  const needsTarget = ["robo", "intercambio", "reinicio"].includes(actionMode);

  // HOME
  if (screen === "home") return (
    <div style={s.container}>
      <div style={s.logo}>🃏</div>
      <h1 style={s.title}>FIVER</h1>
      <p style={s.subtitle}>Fastidiar es más divertido que ganar</p>
      <input style={s.input} placeholder="Tu nombre" value={playerName}
        onChange={e => { setPlayerName(e.target.value); setError(""); }} />
      <button style={s.btnPrimary} onClick={handleCreate}>Crear sala</button>
      <div style={s.divider}>— o únete con un código —</div>
      <input style={s.input} placeholder="Código (ej: KBZR)" value={joinCode}
        onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError(""); }} maxLength={4} />
      <button style={s.btnSecondary} onClick={handleJoin}>Unirse a sala</button>
      {error && <p style={s.error}>{error}</p>}
    </div>
  );

  // LOBBY
  if (screen === "lobby" && room?.status === "waiting") return (
    <div style={s.container}>
      <h2 style={s.title}>Sala: <span style={s.code}>{roomCode}</span></h2>
      <p style={s.subtitle}>Comparte este código con tus amigos</p>
      <h3>Jugadores ({room?.players?.length || 0}/7):</h3>
      <ul style={s.playerList}>
        {room?.players?.map(p => (
          <li key={p.id} style={s.playerItem}>
            {p.isHost ? "👑 " : "👤 "}{p.name}{p.id === playerId ? " (tú)" : ""}
          </li>
        ))}
      </ul>
      {isHost ? <button style={s.btnPrimary} onClick={handleStart}>Iniciar partida</button>
        : <p style={s.waiting}>Esperando al host...</p>}
      {error && <p style={s.error}>{error}</p>}
    </div>
  );

  // JUEGO
  if (room?.status === "playing" || room?.status === "siege") return (
    <div style={s.game}>
      {isSiege && (
        <div style={isSiegeTarget ? s.siegeBannerTarget : s.siegeBanner}>
          {isSiegeTarget ? "⚔️ ¡ESTÁS BAJO ASEDIO! ¡Defiéndete!"
            : `⚔️ ¡ASEDIO! Ataca a ${room.players.find(p => p.id === room.siegeTarget)?.name}`}
        </div>
      )}

      {/* Otros jugadores */}
      <div style={s.otherPlayers}>
        {otherPlayers.map(p => (
          <div key={p.id} style={{
            ...s.otherPlayer,
            border: needsTarget && isMyTurn ? "2px solid #facc15" : room.siegeTarget === p.id ? "2px solid #ef4444" : "2px solid transparent",
            borderRadius: 8, padding: 4, cursor: needsTarget && isMyTurn ? "pointer" : "default",
          }} onClick={() => needsTarget && isMyTurn && handleAttackPlayer(p.id)}>
            <span style={s.playerName}>
              {p.isHost ? "👑" : "👤"} {p.name}
              {room.siegeTarget === p.id ? " 🎯" : ""}
              {room.currentTurn === p.id ? " ⚡" : ""}
              {needsTarget && isMyTurn ? " 👆" : ""}
            </span>
            <div style={s.otherHand}>
              {(p.hand || []).map((_, i) => <CardView key={i} faceDown small />)}
            </div>
          </div>
        ))}
      </div>

      {/* Tablero */}
      <div style={s.board}>
        <div style={s.boardArea}>
          <div style={s.deckZone}>
            <CardView faceDown onClick={isMyTurn && !loading && !actionMode ? handleDraw : null} />
            <span style={s.deckLabel}>{room.deck?.length || 0} cartas</span>
            {isMyTurn && !actionMode && <span style={s.actionHint}>Toca para robar</span>}
          </div>
          <div style={s.deckZone}>
            {room.discardPile?.length > 0
              ? <CardView card={room.discardPile[room.discardPile.length - 1]} />
              : <div style={s.emptyDiscard}>Descarte</div>}
            <span style={s.deckLabel}>Descarte</span>
          </div>
        </div>

        {needsTarget && isMyTurn && (
          <div style={s.targetHint}>👆 Toca a un jugador para atacarle</div>
        )}

        <div style={s.turnInfo}>
          {isMyTurn ? <span style={s.myTurn}>⚡ ¡ES TU TURNO!</span>
            : <span style={s.otherTurn}>Turno de: {room.players?.find(p => p.id === room.currentTurn)?.name}</span>}
        </div>
      </div>

      {/* Tu mano */}
      <div style={s.myArea}>
        <div style={s.myHandHeader}>
          <p style={s.myHandLabel}>Tu mano ({myHand.length})</p>
          {isMyTurn && (
            <div style={s.actions}>
              {actionMode === "doble-descarte" && (
                <button style={s.btnSpecial} onClick={handleDobleDescarte} disabled={loading}>
                  Descartar seleccionadas
                </button>
              )}
              {!actionMode && (
                <>
                  <button style={s.btnDiscard} onClick={handleDiscard} disabled={selectedCards.length === 0 || loading}>
                    Descartar
                  </button>
                  <button style={s.btnFiver} onClick={handleFiver} disabled={loading}>
                    ¡FIVER!
                  </button>
                </>
              )}
              {actionMode && actionMode !== "doble-descarte" && (
                <button style={s.btnCancel} onClick={() => { setActionMode(null); setSelectedCards([]); }}>
                  Cancelar
                </button>
              )}
            </div>
          )}
        </div>

        {selectedCards.length > 0 && (
          <div style={s.cardInfo}>
            <strong>{selectedCards[0].name}</strong>
            {selectedCards[0].description?.simple && (
              <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 8 }}>
                {selectedCards[0].description.simple}
              </span>
            )}
          </div>
        )}

        <div style={s.myHand}>
          {myHand.map(card => (
            <CardView key={card.id} card={card}
              selected={!!selectedCards.find(c => c.id === card.id)}
              onClick={() => isMyTurn && toggleCard(card)}
            />
          ))}
        </div>
        {error && <p style={s.error}>{error}</p>}
      </div>
    </div>
  );
}

const s = {
  container: { maxWidth: 400, margin: "0 auto", padding: 24, fontFamily: "sans-serif", textAlign: "center" },
  logo: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 36, fontWeight: "bold", margin: "0 0 4px" },
  subtitle: { color: "#666", marginBottom: 24, fontSize: 14 },
  input: { width: "100%", padding: 12, fontSize: 16, border: "2px solid #ddd", borderRadius: 8, marginBottom: 12, boxSizing: "border-box" },
  btnPrimary: { width: "100%", padding: 14, fontSize: 16, fontWeight: "bold", background: "#1a1a2e", color: "white", border: "none", borderRadius: 8, cursor: "pointer", marginBottom: 12 },
  btnSecondary: { width: "100%", padding: 14, fontSize: 16, background: "#f3f4f6", color: "#111", border: "2px solid #ddd", borderRadius: 8, cursor: "pointer", marginBottom: 12 },
  divider: { color: "#999", margin: "8px 0", fontSize: 13 },
  error: { color: "#ef4444", marginTop: 8, fontSize: 13 },
  code: { color: "#2563eb", letterSpacing: 4, fontFamily: "monospace" },
  playerList: { listStyle: "none", padding: 0 },
  playerItem: { padding: "10px 16px", margin: "6px 0", background: "#f3f4f6", borderRadius: 8, textAlign: "left" },
  waiting: { color: "#999", fontStyle: "italic" },
  game: { display: "flex", flexDirection: "column", height: "100vh", background: "#0f1923", color: "white", overflow: "hidden" },
  siegeBanner: { background: "#7c3aed", padding: "8px 16px", textAlign: "center", fontWeight: "bold", fontSize: 14 },
  siegeBannerTarget: { background: "#dc2626", padding: "8px 16px", textAlign: "center", fontWeight: "bold", fontSize: 14 },
  otherPlayers: { padding: "8px 12px", display: "flex", gap: 16, overflowX: "auto", background: "#1a2332", minHeight: 90 },
  otherPlayer: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  playerName: { fontSize: 11, color: "#94a3b8" },
  otherHand: { display: "flex", gap: 2 },
  board: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 },
  boardArea: { display: "flex", gap: 32, alignItems: "center" },
  deckZone: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  deckLabel: { fontSize: 12, color: "#64748b" },
  actionHint: { fontSize: 11, color: "#facc15" },
  targetHint: { fontSize: 13, color: "#facc15", fontWeight: "bold", padding: "6px 16px", background: "#1a2332", borderRadius: 12 },
  emptyDiscard: { width: 90, height: 135, border: "2px dashed #334155", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", fontSize: 12 },
  turnInfo: { padding: "8px 20px", borderRadius: 20, background: "#1a2332" },
  myTurn: { color: "#facc15", fontWeight: "bold", fontSize: 16 },
  otherTurn: { color: "#94a3b8", fontSize: 14 },
  myArea: { background: "#1a2332", padding: "10px 12px 20px" },
  myHandHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  myHandLabel: { fontSize: 12, color: "#64748b", margin: 0 },
  actions: { display: "flex", gap: 8 },
  btnDiscard: { padding: "6px 14px", fontSize: 13, background: "#334155", color: "white", border: "none", borderRadius: 6, cursor: "pointer" },
  btnFiver: { padding: "6px 14px", fontSize: 13, fontWeight: "bold", background: "#dc2626", color: "white", border: "none", borderRadius: 6, cursor: "pointer" },
  btnSpecial: { padding: "6px 14px", fontSize: 13, fontWeight: "bold", background: "#7c3aed", color: "white", border: "none", borderRadius: 6, cursor: "pointer" },
  btnCancel: { padding: "6px 14px", fontSize: 13, background: "#334155", color: "#94a3b8", border: "none", borderRadius: 6, cursor: "pointer" },
  myHand: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 },
  cardInfo: { background: "#0f1923", borderRadius: 6, padding: "4px 10px", marginBottom: 6, textAlign: "left", fontSize: 13 },
};

export default App;