"use client";

import { useParams } from "next/navigation";
import PublicationView from "../../components/PublicationView";

export default function PublicationPage() {
  const params = useParams();
  const id = params.id as string;
  return <PublicationView id={id} />;
}
