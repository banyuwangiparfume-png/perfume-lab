"use client";

import Link from "next/link";
import { ErrorBanner } from "@/components/shared/primitives";
import { Button } from "@/components/ui/button";

/**
 * Error boundary global. Menampilkan pesan teknis yang sebenarnya — halaman
 * kosong tanpa penjelasan atau "terjadi kesalahan" tidak membantu siapa pun
 * memperbaiki keadaan.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-[640px] py-10">
      <ErrorBanner title="Halaman ini gagal dimuat" message={error.message}>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={reset}>
            Coba lagi
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/">Kembali ke dashboard</Link>
          </Button>
        </div>
        {error.digest && (
          <p className="mt-3 font-mono text-[11px] text-[var(--text-subtle)]">
            digest {error.digest}
          </p>
        )}
      </ErrorBanner>
    </div>
  );
}
