import { useState } from "react";
import { createRoom, joinRoom, listenToRoom, startGame } from "./services/roomService";
import CardView from "./components/CardView";

function App() {
  const [screen, setScreen] = useState("home");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [selectedCard, setSelectedCard] = useState(null);

  async function handleCreate() {
    if (!playerName.trim()) return setError("Escribe tu nombre");
    try {
      const result = await createRoom(playerName);
      setRoomCode(result.code);
      setPlayerId(result.playerId);
      listenToRoom(result.code, setRoom);
      setScreen("lobby");
    } catch { setError("Error al crear la sala"); }
  }

  async function handleJoin() {
    if (!playerName.trim()) return setError("Escribe tu nombre");
    if (!joinCode.trim()) return setError("Escribe el código de sala");
    try {
      const result = await joinRoom(joinCode.toUpperCase(), playerName);
      setRoomCode(result.code);
      setPlayerId(result.playerId);
      listenToRoom(result.code, setRoom);
      setScreen("lobby");
    } catch (e) {
      const msgs = { SALA_NO_ENCONTRADA: "Sala no encontrada", PARTIDA_EN_CURSO: "La partida ya empezó", SALA_LLENA: "Sala llena" };
      setError(msgs[e.message] || "Error al unirse");
    }
  }

  async function handleStart() {
    if (room.players.length < 3) return setError("Mínimo 3 jugadores");
    await startGame(roomCode);
  }

  const isHost = room?.players?.find(p => p.id === playerId)?.isHost;
  const myHand = room?.players?.find(p => p.id === playerId)?.hand || [];
  const otherPlayers = room?.players?.filter(p => p.id !== playerId) || [];

  // PANTALLA HOME
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

  // PANTALLA LOBBY
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
      {isHost
        ? <button style={s.btnPrimary} onClick={handleStart}>Iniciar partida</button>
        : <p style={s.waiting}>Esperando al host...</p>}
      {error && <p style={s.error}>{error}</p>}
    </div>
  );

  // PANTALLA JUEGO
  if (room?.status === "playing") return (
    <div style={s.game}>

      {/* Otros jugadores arriba */}
      <div style={s.otherPlayers}>
        {otherPlayers.map(p => (
          <div key={p.id} style={s.otherPlayer}>
            <span style={s.playerName}>{p.isHost ? "👑" : "👤"} {p.name}</span>
            <div style={s.otherHand}>
              {(p.hand || []).map((_, i) => (
                <CardView key={i} faceDown small />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tablero central */}
      <div style={s.board}>
        <div style={s.boardArea}>
          {/* Mazo de robo */}
          <div style={s.deckZone}>
            <CardView faceDown />
            <span style={s.deckLabel}>{room.deck?.length || 0} cartas</span>
          </div>
          {/* Pila de descartes */}
          <div style={s.deckZone}>
            {room.discardPile?.length > 0
              ? <CardView card={room.discardPile[room.discardPile.length - 1]} />
              : <div style={s.emptyDiscard}>Descartes</div>}
            <span style={s.deckLabel}>Descarte</span>
          </div>
        </div>

        {/* Turno actual */}
        <div style={s.turnInfo}>
          {room.currentTurn === playerId
            ? <span style={s.myTurn}>⚡ ¡ES TU TURNO!</span>
            : <span style={s.otherTurn}>Turno de: {room.players?.find(p => p.id === room.currentTurn)?.name}</span>}
        </div>
      </div>

      {/* Tu mano abajo */}
      <div style={s.myArea}>
        <p style={s.myHandLabel}>Tu mano ({myHand.length} cartas)</p>
        <div style={s.myHand}>
          {myHand.map((card, i) => (
            <CardView
              key={card.id}
              card={card}
              selected={selectedCard?.id === card.id}
              onClick={() => setSelectedCard(selectedCard?.id === card.id ? null : card)}
            />
          ))}
        </div>
        {selectedCard && (
          <div style={s.cardInfo}>
            <strong>{selectedCard.name}</strong>
            {selectedCard.description && (
              <p style={{ margin: "4px 0", fontSize: 12 }}>
                {selectedCard.description.simple}
              </p>
            )}
          </div>
        )}
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
  error: { color: "red", marginTop: 8 },
  code: { color: "#2563eb", letterSpacing: 4, fontFamily: "monospace" },
  playerList: { listStyle: "none", padding: 0 },
  playerItem: { padding: "10px 16px", margin: "6px 0", background: "#f3f4f6", borderRadius: 8, textAlign: "left" },
  waiting: { color: "#999", fontStyle: "italic" },
  // Juego
  game: { display: "flex", flexDirection: "column", height: "100vh", background: "#0f1923", color: "white", overflow: "hidden" },
  otherPlayers: { padding: "8px 12px", display: "flex", gap: 16, overflowX: "auto", background: "#1a2332", minHeight: 80 },
  otherPlayer: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 },
  playerName: { fontSize: 11, color: "#94a3b8" },
  otherHand: { display: "flex", gap: 4 },
  board: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 },
  boardArea: { display: "flex", gap: 32, alignItems: "center" },
  deckZone: { display: "flex", flexDirection: "column", alignItems: "center", gap: 6 },
  deckLabel: { fontSize: 12, color: "#64748b" },
  emptyDiscard: { width: 90, height: 135, border: "2px dashed #334155", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", fontSize: 12 },
  turnInfo: { padding: "8px 20px", borderRadius: 20, background: "#1a2332" },
  myTurn: { color: "#facc15", fontWeight: "bold", fontSize: 16 },
  otherTurn: { color: "#94a3b8", fontSize: 14 },
  myArea: { background: "#1a2332", padding: "12px 12px 24px", minHeight: 180 },
  myHandLabel: { fontSize: 12, color: "#64748b", margin: "0 0 8px" },
  myHand: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8 },
  cardInfo: { marginTop: 8, background: "#0f1923", borderRadius: 8, padding: "8px 12px", textAlign: "left", fontSize: 13 },
};

export default App;