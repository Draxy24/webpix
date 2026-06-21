import LegalPage from "../components/LegalPage";
import { PRIVACIDAD } from "../lib/legalContent";

export const metadata = { title: "Política de Privacidad · WebPix" };

export default function PrivacidadPage() {
  return <LegalPage content={PRIVACIDAD} />;
}
