import { useState } from "react";
import { createRoom, joinRoom, listenToRoom, startGame } from "./services/roomService";

function App() {
  const [screen, setScreen] = useState("home"); // home | lobby
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");

  // Crear sala
  async function handleCreate() {
    if (!playerName.trim()) return setError("Escribe tu nombre");
    try {
      const result = await createRoom(playerName);
      setRoomCode(result.code);
      setPlayerId(result.playerId);
      // Escuchar cambios en tiempo real
      listenToRoom(result.code, setRoom);
      setScreen("lobby");
    } catch (e) {
      setError("Error al crear la sala");
    }
  }

  // Unirse a sala
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
      const msgs = {
        SALA_NO_ENCONTRADA: "Sala no encontrada",
        PARTIDA_EN_CURSO: "La partida ya empezó",
        SALA_LLENA: "Sala llena",
      };
      setError(msgs[e.message] || "Error al unirse");
    }
  }

  // Iniciar partida
  async function handleStart() {
    if (room.players.length < 3) return setError("Mínimo 3 jugadores");
    await startGame(roomCode);
  }

  const isHost = room?.players?.find(p => p.id === playerId)?.isHost;
  const myHand = room?.players?.find(p => p.id === playerId)?.hand || [];

  // PANTALLA: HOME
  if (screen === "home") return (
    <div style={styles.container}>
      <h1 style={styles.title}>🃏 FIVER</h1>
      <p style={styles.subtitle}>El juego donde fastidiar es más divertido que ganar</p>

      <input
        style={styles.input}
        placeholder="Tu nombre"
        value={playerName}
        onChange={e => { setPlayerName(e.target.value); setError(""); }}
      />

      <button style={styles.btnPrimary} onClick={handleCreate}>
        Crear sala
      </button>

      <div style={styles.divider}>— o únete con un código —</div>

      <input
        style={styles.input}
        placeholder="Código de sala (ej: KBZR)"
        value={joinCode}
        onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError(""); }}
        maxLength={4}
      />

      <button style={styles.btnSecondary} onClick={handleJoin}>
        Unirse a sala
      </button>

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );

  // PANTALLA: LOBBY
  if (screen === "lobby") return (
    <div style={styles.container}>
      <h2 style={styles.title}>Sala: <span style={styles.code}>{roomCode}</span></h2>
      <p style={styles.subtitle}>Comparte este código con tus amigos</p>

      <h3>Jugadores ({room?.players?.length || 0}/7):</h3>
      <ul style={styles.playerList}>
        {room?.players?.map(p => (
          <li key={p.id} style={styles.playerItem}>
            {p.isHost ? "👑 " : "👤 "}{p.name}
            {p.id === playerId ? " (tú)" : ""}
          </li>
        ))}
      </ul>

      {room?.status === "playing" ? (
        <div>
          <h3>¡Partida iniciada!</h3>
          <h4>Tu mano:</h4>
          <ul>
            {myHand.map(card => (
              <li key={card.id}>
                {card.name} {card.color ? `(${card.color})` : "(especial)"}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <>
          {isHost ? (
            <button style={styles.btnPrimary} onClick={handleStart}>
              Iniciar partida
            </button>
          ) : (
            <p style={styles.waiting}>Esperando a que el host inicie...</p>
          )}
        </>
      )}

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 400, margin: "0 auto", padding: 24,
    fontFamily: "sans-serif", textAlign: "center",
  },
  title: { fontSize: 36, fontWeight: "bold", marginBottom: 4 },
  subtitle: { color: "#666", marginBottom: 24 },
  input: {
    width: "100%", padding: "12px", fontSize: 16,
    border: "2px solid #ddd", borderRadius: 8,
    marginBottom: 12, boxSizing: "border-box",
  },
  btnPrimary: {
    width: "100%", padding: 14, fontSize: 16, fontWeight: "bold",
    background: "#2563eb", color: "white", border: "none",
    borderRadius: 8, cursor: "pointer", marginBottom: 12,
  },
  btnSecondary: {
    width: "100%", padding: 14, fontSize: 16,
    background: "#f3f4f6", color: "#111", border: "2px solid #ddd",
    borderRadius: 8, cursor: "pointer", marginBottom: 12,
  },
  divider: { color: "#999", margin: "8px 0", fontSize: 13 },
  error: { color: "red", marginTop: 8 },
  code: { color: "#2563eb", letterSpacing: 4, fontFamily: "monospace" },
  playerList: { listStyle: "none", padding: 0 },
  playerItem: {
    padding: "10px 16px", margin: "6px 0",
    background: "#f3f4f6", borderRadius: 8, textAlign: "left",
  },
  waiting: { color: "#999", fontStyle: "italic" },
};

export default App;