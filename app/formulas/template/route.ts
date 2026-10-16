import { formulaTemplateBuffer } from "@/lib/import/formulaWorkbook";

export const dynamic = "force-dynamic";

/** Template formula kosong untuk diisi — sendiri atau oleh AI — lalu diimpor. */
export async function GET() {
  return new Response(await formulaTemplateBuffer(), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="template-formula.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
