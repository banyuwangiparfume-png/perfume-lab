import { EmptyState } from "@/components/shared/primitives";
import { FileQuestion } from "lucide-react";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-[560px] py-10">
      <EmptyState
        icon={FileQuestion}
        title="Halaman tidak ditemukan"
        description="Link-nya mungkin sudah berubah, atau datanya sudah dihapus."
        action={{ href: "/", label: "Kembali ke dashboard" }}
      />
    </div>
  );
}
