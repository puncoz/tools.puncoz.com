"use server"

import { signOut } from "@workos-inc/authkit-nextjs"

const signOutAction = async (): Promise<void> => {
  await signOut({ returnTo: "/" })
}

export { signOutAction }
