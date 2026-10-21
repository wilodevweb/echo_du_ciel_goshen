import { getServerSession } from "next-auth/next";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/authOptions";
import { HomeScreen } from "@/components/home/HomeScreen";
import { LocalDataCleanup } from "@/components/system/LocalDataCleanup";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const user = session.user as { name?: string | null; role?: string } | undefined;
  return <>
    <LocalDataCleanup />
    <HomeScreen name={user?.name ?? ""} isAdmin={user?.role === "ADMIN"} />
  </>;
}
