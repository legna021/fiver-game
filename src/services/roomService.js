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
  const player = { id: user.uid, name: playerName, hand: [], isHost: true, isReady: false };
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

// Helper: quita N cartas de un subtipo de la mano y las devuelve
function extractSpecialCards(hand, subtype, amount) {
  const result = [];
  const newHand = [...hand];
  for (let i = 0; i < amount; i++) {
    const idx = newHand.findIndex(c => c.subtype === subtype);
    if (idx !== -1) result.push(...newHand.splice(idx, 1));
  }
  return { newHand, usedCards: result };
}

export async function playRobo(roomCode, playerId, targetId, isCombo = false) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();
  if (room.currentTurn !== playerId) throw new Error("NO_ES_TU_TURNO");

  const attacker = room.players.find(p => p.id === playerId);
  const target = room.players.find(p => p.id === targetId);
  const amount = isCombo ? 3 : 1;
  if (target.hand.length < amount) throw new Error("OBJETIVO_SIN_CARTAS");

  // Robar cartas al azar del objetivo
  const targetHand = [...target.hand];
  const stolen = [];
  for (let i = 0; i < amount; i++) {
    const idx = Math.floor(Math.random() * targetHand.length);
    stolen.push(...targetHand.splice(idx, 1));
  }

  // Quitar carta(s) de Robo de la mano y mandarlas al descarte
  const { newHand: attackerHand, usedCards } = extractSpecialCards(attacker.hand, "robo", isCombo ? 2 : 1);
  attackerHand.push(...stolen);

  const updatedPlayers = room.players.map(p => {
    if (p.id === playerId) return { ...p, hand: attackerHand };
    if (p.id === targetId) return { ...p, hand: targetHand };
    return p;
  });

  await updateDoc(roomRef, {
    players: updatedPlayers,
    discardPile: [...room.discardPile, ...usedCards],
    currentTurn: getNextPlayerId(room.players, playerId),
  });
}

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

  // Quitar carta a dar y cartas de Intercambio → descarte
  let attackerHand = [...attacker.hand];
  const giveIdx = attackerHand.findIndex(c => c.id === giveCardId);
  const [given] = attackerHand.splice(giveIdx, 1);
  const { newHand, usedCards } = extractSpecialCards(attackerHand, "intercambio", isCombo ? 2 : 1);
  attackerHand = newHand;
  attackerHand.push(...stolen);
  targetHand.push(given);

  const updatedPlayers = room.players.map(p => {
    if (p.id === playerId) return { ...p, hand: attackerHand };
    if (p.id === targetId) return { ...p, hand: targetHand };
    return p;
  });

  await updateDoc(roomRef, {
    players: updatedPlayers,
    discardPile: [...room.discardPile, ...usedCards],
    currentTurn: getNextPlayerId(room.players, playerId),
  });
}

export async function playDobleDescarte(roomCode, playerId, cardIds, isCombo = false) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();
  if (room.currentTurn !== playerId) throw new Error("NO_ES_TU_TURNO");

  const maxDiscard = isCombo ? 5 : 2;
  if (cardIds.length > maxDiscard) throw new Error("DEMASIADAS_CARTAS");

  const player = room.players.find(p => p.id === playerId);

  // Las cartas de Doble Descarte también van al descarte
  const { newHand, usedCards } = extractSpecialCards(player.hand, "doble-descarte", isCombo ? 2 : 1);
  const toDiscard = newHand.filter(c => cardIds.includes(c.id));
  const remainingHand = newHand.filter(c => !cardIds.includes(c.id));

  const updatedPlayers = room.players.map(p =>
    p.id === playerId ? { ...p, hand: remainingHand } : p
  );

  await updateDoc(roomRef, {
    players: updatedPlayers,
    discardPile: [...room.discardPile, ...usedCards, ...toDiscard],
    currentTurn: getNextPlayerId(room.players, playerId),
  });
}

export async function playReinicio(roomCode, playerId, targetId, isCombo = false) {
  const roomRef = doc(db, "rooms", roomCode);
  const roomSnap = await getDoc(roomRef);
  const room = roomSnap.data();
  if (room.currentTurn !== playerId) throw new Error("NO_ES_TU_TURNO");

  const attacker = room.players.find(p => p.id === playerId);
  const target = room.players.find(p => p.id === targetId);

  // Quitar carta de Reinicio → descarte
  const { newHand: attackerHand, usedCards } = extractSpecialCards(attacker.hand, "reinicio", isCombo ? 2 : 1);

  const discarded = [...target.hand];
  let newTargetHand = [];
  let newDeck = [...room.deck];

  if (!isCombo) {
    for (let i = 0; i < 5; i++) {
      if (newDeck.length > 0) newTargetHand.push(newDeck.pop());
    }
  }

  const updatedPlayers = room.players.map(p => {
    if (p.id === playerId) return { ...p, hand: attackerHand };
    if (p.id === targetId) return { ...p, hand: newTargetHand };
    return p;
  });

  await updateDoc(roomRef, {
    players: updatedPlayers,
    deck: newDeck,
    discardPile: [...room.discardPile, ...usedCards, ...discarded],
    currentTurn: getNextPlayerId(room.players, playerId),
  });
}