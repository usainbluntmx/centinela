import { useEffect, useState } from "react";
import { StampInkFilter } from "./components/Stamp";
import { Landing } from "./pages/Landing";
import { Workspace } from "./pages/Workspace";

function useRoute(): string {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash.replace(/^#/, "") || "/";
}

export function App() {
  const route = useRoute();
  return (
    <>
      <StampInkFilter />
      {route.startsWith("/vault") ? <Workspace /> : <Landing />}
    </>
  );
}