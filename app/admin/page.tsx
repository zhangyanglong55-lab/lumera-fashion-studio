import { cookies } from "next/headers";
import AdminConsole from "./AdminConsole";
import AdminLogin from "./AdminLogin";
import { isAdminAuthorized, ADMIN_COOKIE_NAME } from "../../lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const authorized = await isAdminAuthorized((await cookies()).get(ADMIN_COOKIE_NAME)?.value);
  return authorized ? <AdminConsole /> : <AdminLogin />;
}
