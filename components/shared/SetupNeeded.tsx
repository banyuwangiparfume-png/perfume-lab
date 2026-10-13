import { AlertTriangle } from "lucide-react";

/**
 * Layar yang muncul selama kredensial Supabase belum diisi.
 *
 * Menyebutkan persis variabel apa yang kosong dan langkah berikutnya —
 * bukan "terjadi kesalahan".
 */
export function SetupNeeded({ missing }: { missing: string[] }) {
  return (
    <div className="mx-auto max-w-[640px] px-4 py-16">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow)]">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--warn-soft)] text-[var(--warn)]">
            <AlertTriangle className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold">Supabase belum terhubung</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Aplikasinya sudah siap, databasenya belum. Tiga langkah di bawah
              dan semuanya jalan.
            </p>
          </div>
        </div>

        {missing.length > 0 && (
          <div className="mt-5 rounded-lg bg-[var(--surface-muted)] p-4">
            <p className="text-[13px] font-medium text-[var(--text-muted)]">
              Variabel yang belum terisi di{" "}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[12px]">
                .env.local
              </code>
            </p>
            <ul className="mt-2 space-y-1 font-mono text-[13px]">
              {missing.map((key) => (
                <li key={key} className="text-[var(--danger)]">
                  {key}
                </li>
              ))}
            </ul>
          </div>
        )}

        <ol className="mt-6 space-y-4 text-sm">
          <Step n={1} title="Bikin project Supabase">
            Buka{" "}
            <a
              className="font-medium text-[var(--brand)] underline"
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noreferrer"
            >
              supabase.com/dashboard
            </a>
            , buat project baru, pilih region Singapore (paling dekat).
          </Step>
          <Step n={2} title="Jalankan migrasi dan seed">
            Di SQL Editor, tempel dan jalankan berurutan:{" "}
            <code className="font-mono text-[12px]">
              supabase/migrations/0001 … 0006
            </code>
            , lalu{" "}
            <code className="font-mono text-[12px]">
              supabase/seed/seed.sql
            </code>
            .
          </Step>
          <Step n={3} title="Isi .env.local lalu restart dev server">
            Salin dari{" "}
            <code className="font-mono text-[12px]">.env.example</code>. URL dan
            key ada di Project Settings → API.
          </Step>
        </ol>

        <p className="mt-6 border-t border-[var(--border)] pt-4 text-[12px] text-[var(--text-subtle)]">
          Langkah lengkapnya ada di{" "}
          <code className="font-mono">README.md</code>.
        </p>
      </div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[var(--cta)] text-[12px] font-semibold text-white">
        {n}
      </span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-[var(--text-muted)]">{children}</p>
      </div>
    </li>
  );
}
