import { Link } from "react-router-dom";

export const Footer = () => (
  <footer className="w-full py-6 text-center text-sm text-muted-foreground">
    <span>Developed By </span>
    <Link to="/" className="romjan-glow text-base">Romjan</Link>
  </footer>
);
