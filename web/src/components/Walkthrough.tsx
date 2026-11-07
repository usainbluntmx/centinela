import { Button } from "./ui";

export type WalkStep = {
  title: string;
  text: string;
  action: string;
  done: boolean;
  onRun: () => void;
};

// Recorrido guiado en tres pasos: lo mínimo para ver todo el producto
export function Walkthrough({ steps, disabled }: { steps: WalkStep[]; disabled: boolean }) {
  return (
    <section className="walk" aria-labelledby="walk-title">
      <h2 id="walk-title" className="walk__title">
        See Centinela work in three steps
      </h2>
      <ol className="walk__list">
        {steps.map((s, i) => (
          <li key={s.title} className={`walk__step ${s.done ? "walk__step--done" : ""}`}>
            <span className="steps__number">{i + 1}</span>
            <h3 className="steps__title">{s.title}</h3>
            <p>{s.text}</p>
            {s.done ? (
              <span className="walk__done">Done</span>
            ) : (
              <Button variant="primary" onClick={s.onRun} disabled={disabled}>
                {s.action}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}