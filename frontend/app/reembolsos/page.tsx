import LegalPage from "../components/LegalPage";
import { REEMBOLSOS } from "../lib/legalContent";

export const metadata = { title: "Política de Reembolsos y Cancelación · WebPix" };

export default function ReembolsosPage() {
  return <LegalPage content={REEMBOLSOS} />;
}
