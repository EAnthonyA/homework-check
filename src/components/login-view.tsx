"use client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A11 11 0 0 0 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52Z"
      />
    </svg>
  );
}

export function LoginView({ error }: { error?: string }) {
  return (
    <main className="flex flex-1 flex-col justify-center px-5 py-16">
      <div className="sheet anim-rise w-full p-8 pl-11 sm:p-10 sm:pl-12">
        <p className="font-hand text-2xl leading-none text-pen-deep">šeimos sąsiuvinis</p>
        <h1 className="font-display mt-3 text-[2.6rem] font-black leading-[0.95] tracking-tight text-ink">
          Namų <em className="italic text-pen-deep">darbai</em>
        </h1>
        <p className="mt-4 max-w-[34ch] text-[0.95rem] leading-relaxed text-ink-soft">
          Visi namų darbai vienoje vietoje. Nufotografuok, parodyk tėvams — ir sužinok, ar atlikta
          teisingai.
        </p>

        {error && (
          <p className="font-hand mt-5 text-2xl leading-snug text-pen-deep">
            ✗ {error === "denied" ? "Tik patvirtinti el. pašto adresai gali prisijungti." : "Įvyko klaida — pabandyk dar kartą."}
          </p>
        )}

        <a href="/api/auth/login" className="btn btn-outline mt-8 w-full">
          <GoogleIcon />
          Prisijungti su Google
        </a>

        <p className="mt-5 text-xs leading-relaxed text-ink-faint">
          Prisijungdamas sutinki su privatumo taisyklėmis.
        </p>
      </div>
    </main>
  );
}
