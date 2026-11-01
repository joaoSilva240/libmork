import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

export default async function ProfileMePage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect("/login");
  }

  redirect(`/master/community/profile/${session.user.id}`);
}
