import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listChecklistsStore as listChecklists, deleteChecklistStore, type Checklist } from "@/lib/store";
import { isAuthenticated, clearSession, getSession } from "@/lib/session";
import { InstallAppButton } from "@/components/InstallAppButton";
import { ClearAllButton } from "@/components/ClearAllButton";
import { toast } from "sonner";
import {
  Upload, ClipboardList, CheckCircle2, LogOut, Clock, Shield,
  FileSpreadsheet, BarChart3, Trash2, X, Search, FileText, Download as DownloadIcon, Smartphone, Calendar, Hash, Check
} from "lucide-react";
import { exportChecklistToExcel } from "@/lib/excel-export";
import { shareViaWhatsApp } from "@/lib/whatsapp";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Prudêncio" }] }),
});

function Dashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const sessionName = getSession()?.name ?? "";

  function loadData() {
    setLoading(true);
    listChecklists().then(setItems).finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!isAuthenticated()) { navigate({ to: "/" }); return; }
    loadData();
  }, [navigate]);

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await deleteChecklistStore(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      toast.success("🗑 Documento apagado com sucesso");
    } catch (e: unknown) {
      toast.error("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }



  const pendentes = items.filter((i) => i.status === "pendente");
  const concluidas = items.filter((i) => i.status === "concluida");
  const totalArtigos = items.reduce((s, c) => s + (c.items?.length || 0), 0);

  return (
    <main className="min-h-[100dvh] bg-background pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary via-primary to-[oklch(0.22_0.07_255)] text-primary-foreground px-5 pt-8 pb-10 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/icon-512.png" alt="Prudêncio" className="size-11 rounded-xl shadow ring-2 ring-white/10" />
            <div>
              <p className="text-xs uppercase tracking-wider text-primary-foreground/50 flex items-center gap-1">
                <Shield className="size-3" /> Sistema protegido
              </p>
              <h1 className="text-xl font-bold">Prudêncio</h1>
            </div>
          </div>
          <button onClick={() => { clearSession(); navigate({ to: "/" }); }}
            className="size-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition" aria-label="Sair">
            <LogOut className="size-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-6">
          <StatCard label="Pendentes" value={pendentes.length} icon={<Clock className="size-4" />} accent />
          <StatCard label="Concluídas" value={concluidas.length} icon={<CheckCircle2 className="size-4" />} />
          <StatCard label="Total" value={items.length} icon={<ClipboardList className="size-4" />} />
          <StatCard label="Artigos" value={totalArtigos} icon={<BarChart3 className="size-4" />} />
        </div>
      </header>

      {/* Upload CTA */}
      <section className="px-5 -mt-6">
        <Link to="/upload"
          className="flex items-center gap-3 bg-gradient-to-r from-secondary to-[oklch(0.65_0.20_180)] text-secondary-foreground rounded-2xl p-5 shadow-lg active:scale-[0.99] transition hover:shadow-xl">
          <div className="size-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
            <Upload className="size-6" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-base">Carregar Guia (PDF)</p>
            <p className="text-sm opacity-80">OCR avançado + QR Code + Excel profissional</p>
          </div>
          <FileSpreadsheet className="size-5 opacity-60" />
        </Link>
      </section>

      {/* Install App Button */}
      <section className="px-5 mt-4">
        <InstallAppButton variant="full" />
      </section>

      {/* Clean all data — só o chef vê este botão (3 camadas de segurança) */}
      <section className="px-5 mt-4">
        <ClearAllButton
          nomeUtilizador={sessionName}
          onClearComplete={() => listChecklists().then(setItems)}
        />
      </section>

      {/* Search and History */}
      <section className="px-5 mt-8">
        <div className="flex flex-col gap-3 mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ClipboardList className="size-5 text-primary" /> Histórico de Documentos
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Procurar guia, ATCUD, data..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-10 pr-4 rounded-xl border bg-card text-sm focus:ring-2 focus:ring-primary/20 outline-none transition"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center border border-dashed animate-fade-in-up">
            <FileText className="size-10 text-muted-foreground mx-auto opacity-50" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhum documento encontrado.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {items
              .filter((c) => {
                if (!searchQuery) return true;
                const q = searchQuery.toLowerCase();
                return (
                  c.numero_guia?.toLowerCase().includes(q) ||
                  c.codigo_at?.toLowerCase().includes(q) ||
                  c.pdf_metadata?.atcud?.toLowerCase().includes(q) ||
                  c.data_documento?.includes(q) ||
                  c.pdf_name?.toLowerCase().includes(q)
                );
              })
              .map((c, idx) => {
                const date = c.data_documento || new Date(c.created_at).toLocaleDateString("pt-PT");
                const time = new Date(c.created_at).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" });
                
                return (
                  <div key={c.id} className="bg-card rounded-2xl border shadow-sm overflow-hidden animate-fade-in-up" style={{ animationDelay: `${idx * 50}ms` }}>
                    {/* Header: PDF Name */}
                    <div className="bg-muted/30 px-4 py-3 border-b flex items-center gap-3">
                      <FileText className="size-4 text-primary shrink-0" />
                      <p className="font-semibold text-sm truncate">{c.pdf_name || `Guia_${c.numero_guia || "Sem_Numero"}.pdf`}</p>
                      {c.status === "concluida" ? (
                        <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-green-100 text-green-700 rounded-full">Validado</span>
                      ) : (
                        <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full">Pendente</span>
                      )}
                    </div>
                    
                    <Link to={c.status === "concluida" ? "/completed/$id" : "/checklist/$id"} params={{ id: c.id }}>
                      {/* Body: Details */}
                      <div className="p-4 grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="size-4 shrink-0" /> <span className="truncate">{date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="size-4 shrink-0" /> <span>{time}</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground font-medium">
                          <Hash className="size-4 text-muted-foreground shrink-0" /> <span className="truncate">{c.numero_guia || "—"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                          <Shield className="size-4 text-muted-foreground shrink-0" /> <span className="truncate font-mono">{c.pdf_metadata?.atcud || "—"}</span>
                        </div>
                        <div className="col-span-2 flex items-center gap-2 text-green-600 font-medium text-xs mt-1">
                          <CheckCircle2 className="size-4 shrink-0" /> {c.codigo_at ? "QR Detetado" : "Sem QR"}
                          <span className="text-muted/30 mx-1">•</span>
                          <CheckCircle2 className="size-4 shrink-0" /> {c.status === "concluida" ? "Excel Gerado" : "Aguarda Excel"}
                        </div>
                      </div>
                    </Link>

                    {/* Actions */}
                    <div className="px-4 py-3 bg-muted/10 border-t grid grid-cols-3 gap-2">
                      <button onClick={() => exportChecklistToExcel(c)} className="h-9 rounded-lg bg-blue-50 text-blue-600 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-100 transition">
                        <DownloadIcon className="size-3.5" /> Excel
                      </button>
                      <button onClick={() => shareViaWhatsApp(c)} className="h-9 rounded-lg bg-green-50 text-green-600 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-green-100 transition">
                        <Smartphone className="size-3.5" /> WhatsApp
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteId(c.id); }} className="h-9 rounded-lg border border-red-100 bg-red-50 text-red-600 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-red-100 transition">
                        <Trash2 className="size-3.5" /> Apagar
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* ═══ DELETE SINGLE CONFIRMATION MODAL ═══ */}
      {deleteId && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-5" onClick={() => setDeleteId(null)}>
          <div className="bg-card rounded-2xl w-full max-w-sm p-6 shadow-2xl border animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Trash2 className="size-5 text-red-500" /> Apagar Documento
              </h3>
              <button onClick={() => setDeleteId(null)} className="size-8 rounded-full bg-muted flex items-center justify-center">
                <X className="size-4" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-1">Tem a certeza que deseja apagar este documento?</p>
            <p className="text-xs text-red-500 mb-5">⚠️ Esta ação não pode ser revertida. O PDF, dados extraídos, QR Code, Excel e checklist serão apagados.</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteId(null)}
                className="h-11 rounded-xl bg-muted font-semibold text-sm transition hover:bg-muted/80">Cancelar</button>
              <button onClick={() => handleDelete(deleteId)} disabled={deleting}
                className="h-11 rounded-xl bg-red-600 text-white font-semibold text-sm transition hover:bg-red-500 disabled:opacity-60 flex items-center justify-center gap-2">
                {deleting ? <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 className="size-4" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}


    </main>
  );
}

function StatCard({ label, value, icon, accent }: { label: string; value: number; icon?: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 text-center ${accent ? "bg-secondary text-secondary-foreground" : "bg-primary-foreground/10 text-primary-foreground"}`}>
      <div className="flex items-center justify-center gap-1 mb-1 opacity-70">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
    </div>
  );
}
