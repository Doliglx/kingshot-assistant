import { NextResponse } from "next/server"

// Heure du serveur (synchronisé NTP) pour l'horloge UTC du module March Time,
// version web. L'application Android interroge directement une source externe.
export const dynamic = "force-dynamic"

export function GET() {
  return NextResponse.json(
    { now: Date.now() },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  )
}
