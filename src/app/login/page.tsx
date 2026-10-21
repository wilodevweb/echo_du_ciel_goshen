"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";

type LoginStep = "name" | "password";

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("name");
  const [lastName, setLastName] = useState("");
  const [postName, setPostName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const stepRef = useRef<HTMLDivElement>(null);
  const lastStep = useRef<LoginStep>("name");
  const direction = useRef(1);

  const fullName = useMemo(
    () => [lastName, postName, firstName].map(value => value.trim()).filter(Boolean).join(" "),
    [firstName, lastName, postName],
  );

  useEffect(() => {
    if (lastStep.current === step) return;
    lastStep.current = step;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = stepRef.current?.animate(
      [
        { opacity: 0, transform: `translateX(${direction.current * 18}px)` },
        { opacity: 1, transform: "translateX(0)" },
      ],
      { duration: 320, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    return () => animation?.cancel();
  }, [step]);

  const continueWithName = () => {
    const hasSingleIdentifier = Boolean(lastName.trim()) && !postName.trim() && !firstName.trim();
    const hasCompleteName = Boolean(lastName.trim() && postName.trim() && firstName.trim());
    if (!hasSingleIdentifier && !hasCompleteName) {
      setError("Saisissez votre identifiant dans le premier champ ou complétez les trois champs du nom.");
      return;
    }
    setError("");
    direction.current = 1;
    setStep("password");
  };

  const goBack = () => {
    setError("");
    direction.current = -1;
    setStep("name");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password) {
      setError("Saisissez votre mot de passe.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const result = await signIn("credentials", {
        redirect: false,
        username: fullName,
        password,
      });
      if (result?.ok && !result.error) {
        router.push("/");
        router.refresh();
      } else {
        if (result?.error === "CredentialsSignin") {
          setError("Identifiant ou mot de passe incorrect.");
        } else if (result?.error === "DatabaseUnavailable") {
          setError("La base de données est injoignable. Vérifiez votre connexion et réessayez plus tard.");
        } else {
          setError("Connexion impossible. Réessayez.");
        }
      }
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau et réessayez.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-[#0d1410] px-6 text-[#e7ece8]">
      <div className="mx-auto w-full max-w-[520px] pt-10 pb-8">
        <section ref={stepRef} className="relative w-full">
          {step === "password" ? (
            <button
              type="button"
              aria-label="Retour à la saisie du nom"
              onClick={goBack}
              className="absolute -left-1 -top-2 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-[#39463e] bg-[#17201b] text-[#e7ece8] transition-colors hover:bg-[#202c24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#91dfac]"
            >
              <ArrowLeft size={23} strokeWidth={2.4} />
            </button>
          ) : null}

          <Image
            src="/goshen-auth-logo.png"
            alt="Logo Écho du Ciel · Goshen"
            width={192}
            height={192}
            priority
            className="mx-auto mb-[14px] h-24 w-24 rounded-full object-cover"
          />
          <p className="text-center text-xs font-bold tracking-[1.5px] text-[#91a197]">ÉCHO DU CIEL · GOSHEN</p>
          <h1 className="mt-[9px] text-center text-[36px] leading-[43px] font-bold tracking-[-0.8px]">
            {step === "name" ? "Connexion" : "Mot de passe"}
          </h1>
          <p className="mt-2 text-center text-[15px] leading-[22px] text-[#a7b2aa]">
            {step === "name" ? "Entrez votre nom complet ou votre identifiant." : "Saisissez votre mot de passe pour continuer."}
          </p>

          {step === "name" ? (
            <form
              className="mt-[27px]"
              onSubmit={event => { event.preventDefault(); continueWithName(); }}
            >
              <NameField label="Nom ou identifiant" placeholder="Nom ou identifiant" value={lastName} onChange={setLastName} />
              <NameField label="Postnom" placeholder="Postnom" value={postName} onChange={setPostName} />
              <NameField label="Prénom" placeholder="Prénom" value={firstName} onChange={setFirstName} />
              {error ? <p role="alert" className="mb-2 mx-1 text-[13px] leading-[18px] text-[#ff8a80]">{error}</p> : null}
              <PrimaryButton label="Continuer" />
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={goBack}
                aria-label={`Nom sélectionné : ${fullName}. Modifier`}
                className="mt-[27px] flex min-h-[52px] w-full items-center gap-[13px] rounded-full border border-[#39463e] bg-[#19231d] px-[22px] text-left transition-colors hover:bg-[#202c24] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#91dfac]"
              >
                <UserRound size={22} className="shrink-0 text-[#91dfac]" />
                <span className="min-w-0 flex-1 truncate text-base font-medium">{fullName}</span>
                <span className="ml-1 shrink-0 text-sm font-semibold text-[#91dfac]">Modifier</span>
              </button>

              <form className="mt-3" onSubmit={submit}>
                <label htmlFor="login-password" className="mb-[7px] ml-1 block text-[13px] leading-[19px] font-semibold text-[#c3ccc6]">
                  Mot de passe
                </label>
                <div className="flex h-[52px] items-center gap-[14px] rounded-full border border-[#39463e] bg-[#19231d] px-[22px] focus-within:border-[#91dfac]">
                  <LockKeyhole size={21} className="shrink-0 text-[#a7b2aa]" />
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    autoCapitalize="none"
                    required
                    value={password}
                    onChange={event => { setPassword(event.target.value); if (error) setError(""); }}
                    placeholder="••••••••"
                    className="h-full min-w-0 flex-1 bg-transparent text-base text-[#e7ece8] outline-none placeholder:text-[#a7b2aa]"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                    onClick={() => setShowPassword(value => !value)}
                    className="flex min-h-10 min-w-8 items-center justify-center text-[#a7b2aa] hover:text-[#e7ece8]"
                  >
                    {showPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => window.alert("Contactez un administrateur Goshen pour réinitialiser le mot de passe de votre compte.")}
                  className="mt-[5px] mb-2 flex min-h-10 w-full items-center justify-end px-1 text-sm font-semibold text-[#91dfac] hover:text-[#b2efc4]"
                >
                  Mot de passe oublié ?
                </button>
                {error ? <p role="alert" className="mb-2 mx-1 text-[13px] leading-[18px] text-[#ff8a80]">{error}</p> : null}
                <PrimaryButton label="Se connecter" loading={isLoading} />
              </form>
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function NameField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="mb-[13px]">
      <label htmlFor={`login-${label.toLocaleLowerCase("fr")}`} className="mb-[7px] ml-1 block text-[13px] leading-[19px] font-semibold text-[#c3ccc6]">
        {label}
      </label>
      <div className="flex h-[52px] items-center gap-[14px] rounded-full border border-[#39463e] bg-[#19231d] px-[22px] focus-within:border-[#91dfac]">
        <UserRound size={22} className="shrink-0 text-[#a7b2aa]" />
        <input
          id={`login-${label.toLocaleLowerCase("fr")}`}
          type="text"
          autoComplete="off"
          autoCapitalize="words"
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent text-base text-[#e7ece8] outline-none placeholder:text-[#91a097]"
        />
      </div>
    </div>
  );
}

function PrimaryButton({ label, loading = false }: { label: string; loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-1 flex h-14 w-full items-center justify-center rounded-full border border-[#4b9b66] bg-[#2e814b] text-[17px] leading-[23px] font-bold text-white transition-colors hover:bg-[#359357] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#91dfac] disabled:cursor-wait disabled:opacity-65"
    >
      {loading ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-label="Connexion en cours" /> : label}
    </button>
  );
}
