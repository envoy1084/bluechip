import { LegalPage } from "../components/LegalPage.tsx"
import { PRIVACY } from "../model/documents.ts"

export function PrivacyScreen() {
  return <LegalPage legal={PRIVACY} />
}
