import type { Metadata } from "next";
import Link from "next/link";
import { PublicPage, PublicSection } from "@/components/public-page";

export const metadata: Metadata = {
  title: "Apie programą | Namų darbai",
  description: "Namų darbų sąsiuvinis klasei ir šeimai.",
};

export default function AboutPage() {
  return (
    <PublicPage
      eyebrow="klasės sąsiuvinis"
      title={<>Namų darbai, be pamestų lapų.</>}
      lead="Privati programa, padedanti klasei ir šeimai vienoje vietoje matyti užduotis, jų terminus ir atliktus darbus."
    >
      <PublicSection title="Kaip ji veikia">
        <ol className="space-y-5">
          <li className="grid grid-cols-[2rem_1fr] gap-3">
            <span className="font-hand text-3xl leading-6 text-pen-deep">1.</span>
            <p>
              <strong className="font-semibold text-ink">Prisijungimas.</strong> Prieigą gauna tik klasės administratoriaus
              patvirtinti žmonės, kurie prisijungia savo Google paskyra.
            </p>
          </li>
          <li className="grid grid-cols-[2rem_1fr] gap-3">
            <span className="font-hand text-3xl leading-6 text-pen-deep">2.</span>
            <p>
              <strong className="font-semibold text-ink">Užduotys.</strong> Programa surenka namų darbų dalyką, aprašymą ir
              terminą, kad jie būtų aiškiai matomi vienoje vietoje.
            </p>
          </li>
          <li className="grid grid-cols-[2rem_1fr] gap-3">
            <span className="font-hand text-3xl leading-6 text-pen-deep">3.</span>
            <p>
              <strong className="font-semibold text-ink">Kalendorius.</strong> Gavus atskirą naudotojo sutikimą, programa
              sukuria ir atnaujina su namų darbais susijusius visos dienos įvykius jo pagrindiniame Google kalendoriuje.
            </p>
          </li>
          <li className="grid grid-cols-[2rem_1fr] gap-3">
            <span className="font-hand text-3xl leading-6 text-pen-deep">4.</span>
            <p>
              <strong className="font-semibold text-ink">Atlikta.</strong> Mokinys gali įkelti atlikto darbo nuotrauką.
              Jei įjungtas nuotraukų įvertinimas, ji siunčiama Gemini paslaugai, kuri pateikia trumpą įvertinimą.
            </p>
          </li>
        </ol>
      </PublicSection>

      <PublicSection title="Kas valdo duomenis">
        <p>
          Programa skirta ribotai klasei ar šeimai, o ne viešam socialiniam tinklui. Ji nenaudoja duomenų reklamai ir
          neparduoda jų trečiosioms šalims. Daugiau apie konkrečius duomenis ir jų naudojimą —{" "}
          <Link href="/privacy" className="font-semibold text-ink underline decoration-pen/50 underline-offset-4">
            privatumo taisyklėse
          </Link>
          .
        </p>
      </PublicSection>
    </PublicPage>
  );
}
