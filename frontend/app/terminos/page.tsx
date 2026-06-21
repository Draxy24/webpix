import LegalPage from "../components/LegalPage";
import { TERMINOS } from "../lib/legalContent";

export const metadata = { title: "Términos de Servicio · WebPix" };

export default function TerminosPage() {
  return <LegalPage content={TERMINOS} />;
}
