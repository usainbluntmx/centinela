export const shortAddress = (addr: string, chars = 4) =>
    addr.length > chars * 2 + 1 ? `${addr.slice(0, chars)}…${addr.slice(-chars)}` : addr;
  
  export const sol = (value: number) => `${Number(value.toFixed(6))} SOL`;
  
  export const explorerAddress = (addr: string) =>
    `https://explorer.solana.com/address/${addr}?cluster=devnet`;
  
  export const time = (iso: string | number) =>
    new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  
  export const caseRef = (no: number) => `C-${String(no).padStart(4, "0")}`;