import { useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import type { Finding } from "../lib/api";
import { explorerAddress, shortAddress } from "../lib/format";

// ---------- Botón ----------
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger";
};
export function Button({ variant = "secondary", className = "", ...props }: ButtonProps) {
  return <button className={`btn btn--${variant} ${className}`} {...props} />;
}

// ---------- Hoja de formulario ----------
export function Sheet(props: { title: ReactNode; reference?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`sheet ${props.className ?? ""}`}>
      <header className="sheet__head">
        <h2 className="sheet__title">{props.title}</h2>
        {props.reference && <span className="sheet__ref">{props.reference}</span>}
      </header>
      <div className="sheet__body">{props.children}</div>
    </section>
  );
}

// ---------- Campos ----------
export function Fields({ children }: { children: ReactNode }) {
  return <dl className="fields">{children}</dl>;
}
export function Field(props: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={`field ${props.wide ? "field--wide" : ""}`}>
      <dt className="field__label">{props.label}</dt>
      <dd className="field__value" style={{ margin: 0 }}>
        {props.children}
      </dd>
    </div>
  );
}

// ---------- Dirección de Solana ----------
export function Address({ value, chars = 4 }: { value: string; chars?: number }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* el portapapeles puede no estar disponible */
    }
  };
  return (
    <span className="address" title={value}>
      {shortAddress(value, chars)}
      <button type="button" className="address__action" onClick={copy}>
        {copied ? "Copied" : "Copy"}
      </button>
      <a className="address__action" href={explorerAddress(value)} target="_blank" rel="noreferrer">
        Explorer
      </a>
    </span>
  );
}

// ---------- Hallazgos ----------
const SEVERITY_LABEL = { block: "Blocks", warn: "Warning", info: "Note" } as const;
export function Findings({ items }: { items: Finding[] }) {
  if (items.length === 0) return <p className="muted">No findings.</p>;
  return (
    <ul className="findings">
      {items.map((f) => (
        <li key={f.id} className={`finding finding--${f.severity}`}>
          <span className="finding__severity">{SEVERITY_LABEL[f.severity]}</span>
          <span>
            <span className="finding__title">{f.title}</span>
            <br />
            <span className="finding__detail">{f.detail}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

// ---------- Aviso de error ----------
export function Notice({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="notice" role="alert">
      <p className="notice__title">{title}</p>
      {children && <p>{children}</p>}
    </div>
  );
}

// ---------- Procesando ----------
export function Working({ label }: { label: string }) {
  return (
    <span className="working" role="status">
      {label}
    </span>
  );
}