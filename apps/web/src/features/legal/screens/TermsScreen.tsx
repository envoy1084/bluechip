import { LegalPage } from "../components/LegalPage.tsx"
import { TERMS } from "../model/documents.ts"

export function TermsScreen() {
  return <LegalPage legal={TERMS} />
}
