"use client";

import { useParams } from "next/navigation";
import ProfileView from "../../components/ProfileView";

export default function ProfilePage() {
  const params = useParams();
  const nickname = params.nickname as string;
  return <ProfileView nickname={nickname} />;
}
