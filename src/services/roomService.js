import {
  doc, setDoc, getDoc, updateDoc, arrayUnion, onSnapshot
} from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";
import { db, auth } from "../firebase";
import { fullDeck, dealCards } from "../data/deck";

function generateRoomCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 4 }, () =>
    letters[Math.floor(Math.random() * letters.length)]
  ).join("");
}

function getNextPlayerId(players, currentId) {
  const idx = players.findIndex(p => p.id === currentId);
  return players[(idx + 1) % players.length].id;
}

export async function loginAnonymously() {
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function createRoom(playerName) {
  const user = await loginAnonymously();
  const code = generateRoomCode();
  const player = {
    id: user.uid, name: playerName,
    hand: [], isHost: true, isReady: false,
  };
  await setDoc(doc(db, "rooms", code), {
    code, status: "waiting", hostId: user.uid,
    currentTurn: null, siegeTarget: null,
    deck: [], discardPile: [], pendingReaction: null,
    players: [player], createdAt: Date.now(),
  });
  return { code, playerId: user.uid, playerName };
}

export async function joinRoom(code, playerName) {
  const user = await loginAnonymously();
  const roomRef = doc(db, "rooms", code);
  const roomSnap = await getDoc(roomRef);
  if (!roomSnap.exists()) throw new Error("SALA_NO_ENCONTRADA");
  const room = roomSnap.data();
  if (room.status !== "waiting") throw new Error("PARTIDA_EN_CURSO");
  if (room.players.length >= 7) throw new Error("SALA_LLENA");
  const player = { id: user.uid, name: playerName, hand: [], isHost: false, isReady: false };
  await updateDoc(roomRef, { players: arrayUnion(player) });
  return { code, playerId: user.uid, playerName };
}

export async function startGame(code) {
  const roomRef = doc(db, "rooms", code);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();
  const { hands, remainingDeck } = dealCards(fullDeck, room.players.length);
  const updatedPlayers = room.players.map((p, i) => ({ ...p, hand: hands[i] }));
  await updateDoc(roomRef, {
    status: "playing", players: updatedPlayers,
    deck: remainingDeck, discardPile: [],
    currentTurn: room.players[0].id,
  });
}

export function listenToRoom(code, callback) {
  const roomRef = doc(db, "rooms", code);
  return onSnapshot(roomRef, snap => {
    if (snap.exists()) callback(snap.data());
  });
}

export async function drawCard(roomCode, playerId) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();
  if (room.currentTurn !== playerId) throw new Error("NO_ES_TU_TURNO");
  if (room.deck.length === 0) throw new Error("MAZO_VACIO");
  const newDeck = [...room.deck];
  const drawnCard = newDeck.pop();
  const updatedPlayers = room.players.map(p =>
    p.id === playerId ? { ...p, hand: [...p.hand, drawnCard] } : p
  );
  await updateDoc(roomRef, {
    deck: newDeck, players: updatedPlayers,
    currentTurn: getNextPlayerId(room.players, playerId),
  });
}

export async function discardCard(roomCode, playerId, cardId) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();
  if (room.currentTurn !== playerId) throw new Error("NO_ES_TU_TURNO");
  const player = room.players.find(p => p.id === playerId);
  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) throw new Error("CARTA_NO_ENCONTRADA");
  const newHand = [...player.hand];
  const [discarded] = newHand.splice(cardIndex, 1);
  const updatedPlayers = room.players.map(p =>
    p.id === playerId ? { ...p, hand: newHand } : p
  );
  await updateDoc(roomRef, {
    players: updatedPlayers,
    discardPile: [...room.discardPile, discarded],
    currentTurn: getNextPlayerId(room.players, playerId),
  });
}

export async function callFiver(roomCode, playerId) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();
  if (room.currentTurn !== playerId) throw new Error("NO_ES_TU_TURNO");
  await updateDoc(roomRef, {
    status: "siege", siegeTarget: playerId,
    currentTurn: getNextPlayerId(room.players, playerId),
  });
}
// ==========================================
// CARTAS ESPECIALES
// ==========================================

// Robar carta al azar de otro jugador (simple: 1 carta, combo: 3 cartas)
export async function playRobo(roomCode, playerId, targetId, isCombo = false) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();

  if (room.currentTurn !== playerId) throw new Error("NO_ES_TU_TURNO");

  const attacker = room.players.find(p => p.id === playerId);
  const target = room.players.find(p => p.id === targetId);
  const amount = isCombo ? 3 : 1;

  if (target.hand.length < amount) throw new Error("OBJETIVO_SIN_CARTAS");

  // Robar cartas al azar
  const targetHand = [...target.hand];
  const stolen = [];
  for (let i = 0; i < amount; i++) {
    const idx = Math.floor(Math.random() * targetHand.length);
    stolen.push(...targetHand.splice(idx, 1));
  }

  // Quitar carta(s) de Robo de la mano del atacante
  const attackerHand = [...attacker.hand];
  const roboIdx = attackerHand.findIndex(c => c.subtype === "robo");
  attackerHand.splice(roboIdx, isCombo ? 2 : 1, ...stolen);

  const updatedPlayers = room.players.map(p => {
    if (p.id === playerId) return { ...p, hand: attackerHand };
    if (p.id === targetId) return { ...p, hand: targetHand };
    return p;
  });

  await updateDoc(roomRef, {
    players: updatedPlayers,
    discardPile: [...room.discardPile],
    pendingReaction: null,
    currentTurn: getNextPlayerId(room.players, playerId),
  });
}

// Intercambio: roba 1 carta y da 1 (simple) o roba 2 y da 1 (combo)
export async function playIntercambio(roomCode, playerId, targetId, giveCardId, isCombo = false) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();

  if (room.currentTurn !== playerId) throw new Error("NO_ES_TU_TURNO");

  const attacker = room.players.find(p => p.id === playerId);
  const target = room.players.find(p => p.id === targetId);
  const amount = isCombo ? 2 : 1;

  if (target.hand.length < amount) throw new Error("OBJETIVO_SIN_CARTAS");

  // Robar cartas al azar del objetivo
  const targetHand = [...target.hand];
  const stolen = [];
  for (let i = 0; i < amount; i++) {
    const idx = Math.floor(Math.random() * targetHand.length);
    stolen.push(...targetHand.splice(idx, 1));
  }

  // Quitar la carta que el atacante va a dar
  const attackerHand = [...attacker.hand];
  const giveIdx = attackerHand.findIndex(c => c.id === giveCardId);
  const [given] = attackerHand.splice(giveIdx, 1);

  // Quitar carta(s) de Intercambio de la mano del atacante
  const intercambioIdx = attackerHand.findIndex(c => c.subtype === "intercambio");
  attackerHand.splice(intercambioIdx, isCombo ? 2 : 1);

  // Añadir cartas robadas al atacante y carta dada al objetivo
  attackerHand.push(...stolen);
  targetHand.push(given);

  const updatedPlayers = room.players.map(p => {
    if (p.id === playerId) return { ...p, hand: attackerHand };
    if (p.id === targetId) return { ...p, hand: targetHand };
    return p;
  });

  await updateDoc(roomRef, {
    players: updatedPlayers,
    pendingReaction: null,
    currentTurn: getNextPlayerId(room.players, playerId),
  });
}

// Lanzar un ataque con reacción pendiente (para Rebote/Reflejo)
export async function launchAttack(roomCode, playerId, targetId, attackCard, comboCard = null) {
  const roomRef = doc(db, "rooms", roomCode);
  await updateDoc(roomRef, {
    pendingReaction: {
      attackerId: playerId,
      targetId,
      card: attackCard,
      comboCard,
      isCombo: !!comboCard,
      expiresAt: Date.now() + 10000, // 10 segundos para reaccionar
    }
  });
}

// Usar Rebote: desvía el ataque al jugador de la izquierda (simple) o a cualquiera (combo)
export async function playRebote(roomCode, playerId, newTargetId = null) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();

  const reaction = room.pendingReaction;
  if (!reaction || reaction.targetId !== playerId) throw new Error("NO_HAY_ATAQUE");

  // Simple: al jugador de la izquierda. Combo: al elegido
  const target = newTargetId || getNextPlayerId(room.players, playerId);

  await updateDoc(roomRef, {
    pendingReaction: {
      ...reaction,
      targetId: target,
      rebotedBy: playerId,
    }
  });
}

// Usar Reflejo: devuelve el ataque al atacante
export async function playReflejo(roomCode, playerId) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();

  const reaction = room.pendingReaction;
  if (!reaction || reaction.targetId !== playerId) throw new Error("NO_HAY_ATAQUE");
  if (reaction.rebotedBy) throw new Error("NO_SE_PUEDE_REFLEJAR_REBOTE");

  // El ataque vuelve al atacante
  await updateDoc(roomRef, {
    pendingReaction: {
      ...reaction,
      targetId: reaction.attackerId,
      reflectedBy: playerId,
    }
  });
}

// Usar Doble Descarte
export async function playDobleDescarte(roomCode, playerId, cardIds, isCombo = false) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();

  if (room.currentTurn !== playerId) throw new Error("NO_ES_TU_TURNO");

  const maxDiscard = isCombo ? 5 : 2;
  if (cardIds.length > maxDiscard) throw new Error("DEMASIADAS_CARTAS");

  const player = room.players.find(p => p.id === playerId);
  const newHand = player.hand.filter(c => !cardIds.includes(c.id));
  const discarded = player.hand.filter(c => cardIds.includes(c.id));

  const updatedPlayers = room.players.map(p =>
    p.id === playerId ? { ...p, hand: newHand } : p
  );

  await updateDoc(roomRef, {
    players: updatedPlayers,
    discardPile: [...room.discardPile, ...discarded],
    currentTurn: getNextPlayerId(room.players, playerId),
  });
}

// Usar Reinicio sobre un jugador
export async function playReinicio(roomCode, playerId, targetId, isCombo = false) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();

  if (room.currentTurn !== playerId) throw new Error("NO_ES_TU_TURNO");

  const target = room.players.find(p => p.id === targetId);
  const discarded = [...target.hand];

  let newHand = [];
  let newDeck = [...room.deck];

  if (!isCombo) {
    // Simple: descarta todo y roba 5
    for (let i = 0; i < 5; i++) {
      if (newDeck.length > 0) newHand.push(newDeck.pop());
    }
  }
  // Combo: se queda con 0 cartas

  const updatedPlayers = room.players.map(p =>
    p.id === targetId ? { ...p, hand: newHand } : p
  );

  await updateDoc(roomRef, {
    players: updatedPlayers,
    deck: newDeck,
    discardPile: [...room.discardPile, ...discarded],
    currentTurn: getNextPlayerId(room.players, playerId),
  });
}