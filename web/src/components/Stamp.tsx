// Sello de veredicto: el momento clave de Centinela
export function Stamp(props: { outcome: "approved" | "denied"; code?: string | null; date?: string }) {
    const denied = props.outcome === "denied";
    return (
      <div className={`stamp ${denied ? "" : "stamp--cleared"}`} role="img" aria-label={denied ? `Denied by Solana: ${props.code ?? ""}` : "Cleared on-chain"}>
        <span className="stamp__line">{denied ? "Rejected by the Solana program" : "Settled on Solana"}</span>
        <span className="stamp__word">{denied ? "Denied" : "Cleared"}</span>
        {props.code && <span className="stamp__line">{props.code}</span>}
        {props.date && <span className="stamp__line">{props.date}</span>}
      </div>
    );
  }
  
  // Filtro SVG que imita la tinta irregular de un sello de goma. Se monta una vez en la app.
  export function StampInkFilter() {
    return (
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
        <filter id="stamp-ink">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" xChannelSelector="R" yChannelSelector="G" result="displaced" />
          <feTurbulence type="fractalNoise" baseFrequency="0.35" numOctaves="1" seed="3" result="blotch" />
          <feColorMatrix in="blotch" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.9" result="mask" />
          <feComposite in="displaced" in2="mask" operator="in" />
        </filter>
      </svg>
    );
  }