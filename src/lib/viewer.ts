import { headers } from "next/headers";
import { getIdentity, requireIdentity } from "../../cursor/identity";

export { requireIdentity };

export async function requireViewer() {
  const identity = await getIdentity(await headers());
  if (!identity.verified) return null;
  return identity;
}
