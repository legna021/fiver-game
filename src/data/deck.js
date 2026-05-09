// ==========================================
// FIVER - Mazo completo de 69 cartas
// ==========================================

// --- CARTAS DE COLOR (45) ---
const COLORS = ["amarillo", "azul", "morado", "rojo", "verde"];

const colorCards = [];
COLORS.forEach(color => {
  for (let i = 1; i <= 9; i++) {
    colorCards.push({
      id: `${color}-${i}`,
      type: "color",
      color: color,
      name: color.charAt(0).toUpperCase() + color.slice(1),
    });
  }
});

// --- CARTAS ESPECIALES (24) ---
const specialCards = [
  // ROBO x4
  ...Array(4).fill(null).map((_, i) => ({
    id: `robo-${i + 1}`,
    type: "especial",
    subtype: "robo",
    name: "Robo",
    isCombo: false,
    description: {
      simple: "Roba 1 carta al azar de la mano de otro jugador.",
      combo: "Roba 3 cartas al azar de la mano de otro jugador.",
    }
  })),

  // INTERCAMBIO x4
  ...Array(4).fill(null).map((_, i) => ({
    id: `intercambio-${i + 1}`,
    type: "especial",
    subtype: "intercambio",
    name: "Intercambio",
    isCombo: false,
    description: {
      simple: "Roba 1 carta a otro jugador y dale 1 de las tuyas.",
      combo: "Roba 2 cartas a otro jugador y dale 1 de las tuyas.",
    }
  })),

  // REBOTE x4
  ...Array(4).fill(null).map((_, i) => ({
    id: `rebote-${i + 1}`,
    type: "especial",
    subtype: "rebote",
    name: "Rebote",
    isCombo: false,
    description: {
      simple: "Desvía un ataque al jugador de tu izquierda.",
      combo: "Desvía un ataque combo a cualquier jugador que elijas.",
    }
  })),

  // REFLEJO x4
  ...Array(4).fill(null).map((_, i) => ({
    id: `reflejo-${i + 1}`,
    type: "especial",
    subtype: "reflejo",
    name: "Reflejo",
    isCombo: false,
    description: {
      simple: "Devuelve un ataque al jugador que te lo lanzó.",
      combo: "Devuelve un ataque combo y además roba 2 cartas al atacante.",
    }
  })),

  // DOBLE DESCARTE x3
  ...Array(3).fill(null).map((_, i) => ({
    id: `doble-descarte-${i + 1}`,
    type: "especial",
    subtype: "doble-descarte",
    name: "Doble Descarte",
    isCombo: false,
    description: {
      simple: "Descarta 2 cartas de tu mano.",
      combo: "Descarta hasta 5 cartas de tu mano (máximo 6 en total).",
    }
  })),

  // COLORMODÍN x2
  ...Array(2).fill(null).map((_, i) => ({
    id: `colormodin-${i + 1}`,
    type: "especial",
    subtype: "colormodin",
    name: "Colormodín",
    isCombo: false,
    description: {
      simple: "Se asigna automáticamente al color mayoritario de tu mano.",
      combo: "Cuenta como 3 cartas del color mayoritario de tu mano.",
    }
  })),

  // REINICIO x2
  ...Array(2).fill(null).map((_, i) => ({
    id: `reinicio-${i + 1}`,
    type: "especial",
    subtype: "reinicio",
    name: "Reinicio",
    isCombo: false,
    description: {
      simple: "El objetivo descarta su mano y roba 5 cartas nuevas.",
      combo: "El objetivo descarta su mano y se queda con 0 cartas.",
    }
  })),

  // MEGAMODÍN x1
  {
    id: "megamodin-1",
    type: "especial",
    subtype: "megamodin",
    name: "Megamodín",
    isCombo: false,
    description: {
      simple: "Combínalo con cualquier carta especial para activar su efecto Combo.",
    }
  },
];

// --- MAZO COMPLETO ---
export const fullDeck = [...colorCards, ...specialCards];

// --- FUNCIÓN BARAJAR (Fisher-Yates) ---
export function shuffleDeck(deck) {
  const d = [...deck];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

// --- FUNCIÓN REPARTIR ---
export function dealCards(deck, numPlayers, cardsPerPlayer = 5) {
  const shuffled = shuffleDeck(deck);
  const hands = Array.from({ length: numPlayers }, () => []);

  for (let i = 0; i < cardsPerPlayer; i++) {
    for (let p = 0; p < numPlayers; p++) {
      hands[p].push(shuffled.pop());
    }
  }

  return { hands, remainingDeck: shuffled };
}

// Verificación en consola (puedes borrarlo después)
console.log(`Mazo total: ${fullDeck.length} cartas`);
console.log(`- Colores: ${colorCards.length}`);
console.log(`- Especiales: ${specialCards.length}`);