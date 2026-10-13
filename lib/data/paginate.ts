import "server-only";

/** Satu halaman PostgREST. Sama dengan batas bawaannya. */
export const PAGE = 1000;

type Page<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Mengambil seluruh baris, berapa pun jumlahnya.
 *
 * PostgREST memotong jawaban di batas barisnya TANPA error dan tanpa tanda apa
 * pun. Akibatnya bukan halaman yang gagal, melainkan angka yang diam-diam
 * salah: harga hilang lalu HPP jadi Rp0, atau family hilang dari dropdown
 * filter — keduanya terlihat seperti data yang belum diisi, bukan seperti bug.
 *
 * Dipakai untuk setiap kueri yang jumlah barisnya tumbuh bersama master bahan.
 * Kueri yang hari ini muat belum tentu muat setelah pricelist berikutnya masuk.
 */
export async function fetchAllPages<T>(
  query: (from: number, to: number) => PromiseLike<Page<T>>,
  label = "data",
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await query(from, from + PAGE - 1);
    if (error) throw new Error(`Gagal memuat ${label}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}
