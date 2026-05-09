import {
  doc, setDoc, getDoc, updateDoc, arrayUnion, onSnapshot
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { db, auth } from "../firebase";
import { shuffleDeck, dealCards } from "../data/deck";
import { fullDeck } from "../data/deck";

// Genera un código de sala de 4 letras
function generateRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 4 }, () =>
    letters[Math.floor(Math.random() * letters.length)]
  ).join("");
}

// Login anónimo automático
export async function loginAnonymously() {
  const result = await signInAnonymously(auth);
  return result.user;
}

// Crear una sala nueva
export async function createRoom(playerName) {
  const user = await loginAnonymously();
  const code = generateRoomCode();

  const player = {
    id: user.uid,
    name: playerName,
    hand: [],
    isHost: true,
    isReady: false,
  };

  await setDoc(doc(db, "rooms", code), {
    code,
    status: "waiting",       // waiting | playing | siege
    hostId: user.uid,
    currentTurn: null,
    siegeTarget: null,
    deck: [],
    discardPile: [],
    pendingReaction: null,
    players: [player],
    createdAt: Date.now(),
  });

  return { code, playerId: user.uid, playerName };
}

// Unirse a una sala existente
export async function joinRoom(code, playerName) {
  const user = await loginAnonymously();
  const roomRef = doc(db, "rooms", code);
  const roomSnap = await getDoc(roomRef);

  if (!roomSnap.exists()) throw new Error("SALA_NO_ENCONTRADA");

  const room = roomSnap.data();
  if (room.status !== "waiting") throw new Error("PARTIDA_EN_CURSO");
  if (room.players.length >= 7) throw new Error("SALA_LLENA");

  const player = {
    id: user.uid,
    name: playerName,
    hand: [],
    isHost: false,
    isReady: false,
  };

  await updateDoc(roomRef, {
    players: arrayUnion(player),
  });

  return { code, playerId: user.uid, playerName };
}

// Iniciar la partida (solo el host)
export async function startGame(code) {
  const roomRef = doc(db, "rooms", code);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();

  const numPlayers = room.players.length;
  const { hands, remainingDeck } = dealCards(fullDeck, numPlayers);

  // Asignar manos a cada jugador
  const updatedPlayers = room.players.map((p, i) => ({
    ...p,
    hand: hands[i],
  }));

  await updateDoc(roomRef, {
    status: "playing",
    players: updatedPlayers,
    deck: remainingDeck,
    discardPile: [],
    currentTurn: room.players[0].id,
  });
}

// Escuchar cambios en la sala en tiempo real
export function listenToRoom(code, callback) {
  const roomRef = doc(db, "rooms", code);
  return onSnapshot(roomRef, (snap) => {
    if (snap.exists()) callback(snap.data());
  });
}