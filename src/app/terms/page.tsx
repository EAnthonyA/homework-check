import type { Metadata } from "next";
import Link from "next/link";
import { PublicList, PublicPage, PublicSection } from "@/components/public-page";

export const metadata: Metadata = {
  title: "Naudojimo sąlygos | Namų darbai",
  description: "Namų darbai programos naudojimo sąlygos.",
};

export default function TermsPage() {
  return (
    <PublicPage
      eyebrow="naudojimo sąlygos"
      title={<>Sutarkime dėl paprastų taisyklių.</>}
      lead="Namų darbai yra privati klasės ar šeimos programa. Ji skirta padėti sekti užduotis, o ne pakeisti oficialią mokyklos informaciją."
    >
      <p className="text-sm text-ink-faint">Atnaujinta 2026 m. rugsėjo 13 d.</p>

      <PublicSection title="Prieiga">
        <PublicList>
          <li>Programa skirta tik pakviestiems ir administratoriaus patvirtintiems naudotojams.</li>
          <li>Prisijungimo prie Google paskyros duomenimis su kitais žmonėmis nesidalinkite.</li>
          <li>Administratorius gali sustabdyti prieigą, jei ji naudojama ne pagal šią paskirtį arba kelia pavojų kitiems naudotojams.</li>
        </PublicList>
      </PublicSection>

      <PublicSection title="Turinys ir kalendorius">
        <p>
          Namų darbų informacija pateikiama patogumui. Prieš atlikdami užduotį ar remdamiesi terminu, patikrinkite
          oficialius mokyklos pranešimus. Google Calendar įvykiai yra priminimai; juos galite bet kada pakeisti ar
          pašalinti savo kalendoriuje.
        </p>
      </PublicSection>

      <PublicSection title="Nuotraukos ir automatinis įvertinimas">
        <p>
          Įkelkite tik su užduotimi susijusias nuotraukas. Automatinis įvertinimas yra pagalbinė nuomonė — jis gali
          suklysti ir nepakeičia mokytojo ar tėvų sprendimo.
        </p>
      </PublicSection>

      <PublicSection title="Pakeitimai ir klausimai">
        <p>
          Šios sąlygos gali būti atnaujintos, kai pasikeičia programos funkcijos ar duomenų tvarkymas. Esminius
          pakeitimus paskelbsime šioje programoje. Klausimus apie duomenis ir prieigą aprašo{" "}
          <Link href="/privacy" className="font-semibold text-ink underline decoration-pen/50 underline-offset-4">privatumo taisyklės</Link>.
        </p>
      </PublicSection>
    </PublicPage>
  );
}
