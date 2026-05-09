const cardImages = {
  // Colores
  amarillo: "/cards/fiver/Cartas/Colores/Carta amarilla.png",
  azul:     "/cards/fiver/Cartas/Colores/Carta azul.png",
  morado:   "/cards/fiver/Cartas/Colores/Carta morada.png",
  rojo:     "/cards/fiver/Cartas/Colores/Carta roja.png",
  verde:    "/cards/fiver/Cartas/Colores/Carta verde.png",

  // Especiales
  robo:             "/cards/fiver/Cartas/Especiales/Carta de ataque de robo.png",
  intercambio:      "/cards/fiver/Cartas/Especiales/Carta de ataque de intercambio.png",
  rebote:           "/cards/fiver/Cartas/Especiales/Carta de defensa de rebote.png",
  reflejo:          "/cards/fiver/Cartas/Especiales/Carta de defensa de reflejo.png",
  reinicio:         "/cards/fiver/Cartas/Especiales/Carta de destruccion de reinicio.png",
  colormodin:       "/cards/fiver/Cartas/Especiales/Carta de utilidad de colormodin.png",
  "doble-descarte": "/cards/fiver/Cartas/Especiales/Carta de utilidad de doble descarte.png",
  megamodin:        "/cards/fiver/Cartas/Especiales/Carta de megamodin.png",

  // Reverso
  reverso: "/cards/fiver/Cartas/atras/reverso.png",
};

export function getCardImage(card) {
  if (!card) return cardImages.reverso;
  if (card.type === "color") return cardImages[card.color] || cardImages.reverso;
  if (card.type === "especial") return cardImages[card.subtype] || cardImages.reverso;
  return cardImages.reverso;
}

export default function CardView({ card, faceDown = false, onClick, selected = false, small = false }) {
  const imgSrc = faceDown ? cardImages.reverso : getCardImage(card);

  return (
    <div
      onClick={onClick}
      style={{
        width: small ? 60 : 90,
        height: small ? 90 : 135,
        borderRadius: 8,
        overflow: "hidden",
        cursor: onClick ? "pointer" : "default",
        border: selected ? "3px solid #facc15" : "2px solid transparent",
        boxShadow: selected ? "0 0 12px #facc15" : "0 2px 8px rgba(0,0,0,0.3)",
        transform: selected ? "translateY(-8px)" : "none",
        transition: "all 0.15s ease",
        flexShrink: 0,
      }}
    >
      <img
        src={imgSrc}
        alt={faceDown ? "carta" : card?.name}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  );
}