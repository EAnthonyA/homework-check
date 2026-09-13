import type { Metadata } from "next";
import Link from "next/link";
import { PublicList, PublicPage, PublicSection } from "@/components/public-page";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Privatumo taisyklės | Namų darbai",
  description: "Kaip Namų darbai tvarko naudotojų ir Google Calendar duomenis.",
};

function supportContact() {
  const email = process.env.SUPPORT_EMAIL?.trim();
  return email ? <a className="font-semibold text-ink underline decoration-pen/50 underline-offset-4" href={"mailto:" + email}>{email}</a> : "klasės administratoriui, iš kurio gavote prieigą";
}

export default function PrivacyPage() {
  return (
    <PublicPage
      eyebrow="privatumas"
      title={<>Duomenys tvarkomi tik tam, kad darbai būtų padaryti.</>}
      lead="Šios taisyklės paaiškina, kokius duomenis tvarko Namų darbai, kodėl jų reikia ir kaip galima paprašyti juos pašalinti."
    >
      <p className="text-sm text-ink-faint">Atnaujinta 2026 m. rugsėjo 13 d.</p>

      <PublicSection title="Kokius duomenis tvarkome">
        <PublicList>
          <li>Google paskyros unikalų identifikatorių, vardą, el. pašto adresą ir profilio nuotrauką, kad būtų galima sukurti bei apsaugoti paskyrą.</li>
          <li>Namų darbų dalyką, aprašymą, terminą ir atlikimo būseną.</li>
          <li>Įkeltų atliktų darbų nuotraukas, pastabas ir, jei įjungtas vertinimas, automatinio įvertinimo rezultatą.</li>
          <li>Su programos sukurtais Google Calendar įvykiais susietus identifikatorius ir sinchronizavimo laiką.</li>
        </PublicList>
      </PublicSection>

      <PublicSection title="Google Calendar duomenys">
        <p>
          Programa prašo Google Calendar leidimo tam, kad naudotojo pagrindiniame kalendoriuje galėtų sukurti, atnaujinti
          arba pašalinti tik su namų darbais susijusius įvykius. Įgyvendinime programa neskaito kitų kalendoriaus įvykių;
          ji pasiekia tik savo sukurtus įvykius, kurių identifikatorius yra išsaugotas programoje.
        </p>
        <p>
          Google suteiktas atnaujinimo raktas saugomas užšifruotas programos duomenų bazėje ir naudojamas tik šiai
          sinchronizacijai. Leidimą bet kada galite panaikinti savo Google paskyros trečiųjų šalių prieigų nustatymuose.
        </p>
        <p className="border-l-2 border-pen/60 pl-4 text-ink">
          „Namų darbai“ naudojimasis iš Google API gauta informacija atitinka „Google API Services User Data Policy“,
          įskaitant „Limited Use“ reikalavimus.
        </p>
      </PublicSection>

      <PublicSection title="Kur ir kam duomenys perduodami">
        <p>
          Duomenys saugomi privačiame programos serveryje. Jie nėra parduodami, naudojami reklamai ar perduodami kitoms
          šalims šiais tikslais. Google paskyros ir Calendar duomenys perduodami Google tik tiek, kiek būtina
          prisijungimui ir kalendoriaus sinchronizavimui.
        </p>
        <p>
          Jei programos administratorius įjungia nuotraukų vertinimą, įkelta darbo nuotrauka ir su ja susijęs užduoties
          tekstas perduodami Google Gemini paslaugai, kad būtų nustatyta, ar darbas atliktas. Ši funkcija nėra būtina
          prisijungimui ar kalendoriaus sinchronizavimui.
        </p>
      </PublicSection>

      <PublicSection title="Saugumas, saugojimas ir ištrynimas">
        <p>
          Prieiga prie programos ir įkeltų nuotraukų reikalauja prisijungimo. Paskyros sesija saugoma tik HTTP slapuke,
          o Google atnaujinimo raktas — šifruotas. Duomenys saugomi, kol paskyra ir jos namų darbų istorija reikalinga
          šios programos paskirčiai.
        </p>
        <p>
          Norėdami atšaukti Calendar prieigą, ištrinti paskyrą, nuotraukas ar su paskyra susijusius duomenis, kreipkitės į {supportContact()}.
        </p>
      </PublicSection>

      <p className="text-sm text-ink-faint">
        Naudodamiesi programa taip pat sutinkate su{" "}
        <Link href="/terms" className="underline decoration-rule underline-offset-4 hover:text-ink">naudojimo sąlygomis</Link>.
      </p>
    </PublicPage>
  );
}
