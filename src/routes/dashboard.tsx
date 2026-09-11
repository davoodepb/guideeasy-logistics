import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listChecklistsStore as listChecklists,
  deleteChecklistStore,
  listObrasStore,
  type Checklist,
  type Obra,
} from "@/lib/store";
import { useAuth } from "@/lib/session";
import { InstallAppButton } from "@/components/InstallAppButton";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload,
  CheckCircle2,
  LogOut,
  Clock,
  Shield,
  FileSpreadsheet,
  BarChart3,
  Trash2,
  Search,
  FileText,
  Download as DownloadIcon,
  Smartphone,
  Calendar,
  Hash,
  Building2,
  ChevronRight,
} from "lucide-react";
import { exportChecklistToExcel } from "@/lib/excel-export";
import { shareViaWhatsApp } from "@/lib/whatsapp";
import { formatarDataParaPT } from "@/lib/utils";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
  head: () => ({ meta: [{ title: "Dashboard — Prudêncio" }] }),
});

function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, logout } = useAuth();
  const [items, setItems] = useState<Checklist[]>([]);
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  function loadData() {
    setLoading(true);
    Promise.all([listChecklists(), listObrasStore()])
      .then(([guias, o]) => {
        setItems(guias);
        setObras(o);
      })
      .catch((err: any) => {
        console.warn("Erro ao carregar dados do dashboard:", err);
        let msg = "Não foi possível carregar os dados das guias e obras.";
        if (err.message && err.message.toLowerCase().includes("permission_denied")) {
          msg = "Acesso recusado: Não tem permissão para aceder aos dados de guias/obras.";
        }
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!user) {
      navigate({ to: "/" });
      return;
    }
    loadData();
  }, [user, navigate]);

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await deleteChecklistStore(id);
      setItems((prev) => prev.filter((c) => c.id !== id));
      toast.success("Guia apagada com sucesso");
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
  const obrasAtivas = obras.filter((o) => o.status === "ativa");

  const filtered = items.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.numero_guia?.toLowerCase().includes(q) ||
      c.codigo_at?.toLowerCase().includes(q) ||
      c.pdf_metadata?.atcud?.toLowerCase().includes(q) ||
      c.data_documento?.includes(q) ||
      c.pdf_name?.toLowerCase().includes(q) ||
      c.obra_nome?.toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-[100dvh] bg-background pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary via-primary to-[oklch(0.22_0.07_255)] text-primary-foreground px-5 pt-8 pb-10 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/icon-512.png"
              alt="Prudêncio"
              className="size-11 rounded-xl shadow ring-2 ring-white/10"
            />
            <div>
              <p className="text-xs uppercase tracking-wider text-primary-foreground/50 flex items-center gap-1">
                <Shield className="size-3" /> Sistema protegido
              </p>
              <h1 className="text-xl font-bold">Prudêncio</h1>
            </div>
          </div>
          <button
            onClick={async () => {
              await logout();
              navigate({ to: "/" });
            }}
            className="size-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition"
            aria-label="Sair"
          >
            <LogOut className="size-5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-6">
          <StatCard
            label="Pendentes"
            value={pendentes.length}
            icon={<Clock className="size-4" />}
            accent
          />
          <StatCard
            label="Validadas"
            value={concluidas.length}
            icon={<CheckCircle2 className="size-4" />}
          />
          <StatCard label="Total" value={items.length} icon={<FileText className="size-4" />} />
          <StatCard label="Artigos" value={totalArtigos} icon={<BarChart3 className="size-4" />} />
        </div>
      </header>

      {/* Acções principais */}
      <section className="px-5 -mt-6 space-y-3">
        <Link
          to="/upload"
          search={{ obra_id: undefined, obra_nome: undefined }}
          className="flex items-center gap-3 bg-gradient-to-r from-secondary to-[oklch(0.65_0.20_180)] text-secondary-foreground rounded-2xl p-5 shadow-lg active:scale-[0.99] transition hover:shadow-xl"
        >
          <div className="size-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-md">
            <Upload className="size-6" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-base">Carregar Guia (PDF)</p>
            <p className="text-sm opacity-80">OCR avançado — QR Code — Excel profissional</p>
          </div>
          <FileSpreadsheet className="size-5 opacity-60" />
        </Link>

        <Link
          to="/obras"
          className="flex items-center gap-3 bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition"
        >
          <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center">
            <Building2 className="size-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">Gestão de Obras</p>
            <p className="text-xs text-muted-foreground">
              {obrasAtivas.length} obra{obrasAtivas.length !== 1 ? "s" : ""} em curso
            </p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground" />
        </Link>

        {profile?.role === "admin" && (
          <Link
            to="/historico"
            className="flex items-center gap-3 bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition"
          >
            <div className="size-11 rounded-xl bg-amber-500/10 flex items-center justify-center">
              <Clock className="size-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Histórico de Atividades</p>
              <p className="text-xs text-muted-foreground">
                Auditoria, exportação e gestão de registos
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        )}
      </section>

      {/* Instalar App */}
      <section className="px-5 mt-4">
        <InstallAppButton variant="full" />
      </section>

      {/* Secção de depuração removida na versão final de produção */}

      {/* Histórico */}
      <section className="px-5 mt-8">
        <div className="flex flex-col gap-3 mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <FileText className="size-5 text-primary" /> Histórico de Guias
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Procurar por guia, ATCUD, data, obra..."
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
        ) : filtered.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center border border-dashed">
            <FileText className="size-10 text-muted-foreground mx-auto opacity-50" />
            <p className="mt-3 text-sm text-muted-foreground">
              {searchQuery ? "Nenhuma guia corresponde à pesquisa." : "Nenhuma guia encontrada."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((c, idx) => {
              const date = formatarDataParaPT(c.data_documento || c.created_at);
              const time = new Date(c.created_at).toLocaleTimeString("pt-PT", {
                hour: "2-digit",
                minute: "2-digit",
              });
              const isTransporte = c.tipo_guia !== "devolucao";

              return (
                <div
                  key={c.id}
                  className="bg-card rounded-2xl border shadow-sm overflow-hidden animate-fade-in-up"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  {/* Header do card */}
                  <div className="bg-muted/30 px-4 py-3 border-b flex items-center gap-2 flex-wrap">
                    <FileText className="size-4 text-primary shrink-0" />
                    <p className="font-semibold text-sm truncate flex-1 min-w-0">
                      {c.pdf_name || `Guia_${c.numero_guia || "Sem_Numero"}.pdf`}
                    </p>
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full shrink-0 ${
                        isTransporte ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
                      }`}
                    >
                      {isTransporte ? "Transporte" : "Devolução"}
                    </span>
                    <span
                      className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full shrink-0 ${
                        c.status === "concluida"
                          ? "bg-green-100 text-green-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {c.status === "concluida" ? "Validada" : "Pendente"}
                    </span>
                  </div>

                  <Link
                    to={c.status === "concluida" ? "/completed/$id" : "/checklist/$id"}
                    params={{ id: c.id }}
                  >
                    <div className="p-4 grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="size-4 shrink-0" />{" "}
                        <span className="truncate">{date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="size-4 shrink-0" /> <span>{time}</span>
                      </div>
                      <div className="flex items-center gap-2 text-foreground font-medium">
                        <Hash className="size-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{c.numero_guia || "—"}</span>
                      </div>
                      {c.obra_nome && (
                        <div className="flex items-center gap-2 text-foreground font-medium text-xs">
                          <Building2 className="size-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{c.obra_nome}</span>
                        </div>
                      )}
                      <div className="col-span-2 flex items-center gap-2 text-muted-foreground text-xs">
                        <Shield className="size-3.5 shrink-0" />
                        <span className="font-mono truncate">
                          {c.pdf_metadata?.atcud || c.codigo_at || "—"}
                        </span>
                      </div>
                    </div>
                  </Link>

                  {/* Acções */}
                  <div className="px-4 py-3 bg-muted/10 border-t grid grid-cols-3 gap-2">
                    <button
                      onClick={() => exportChecklistToExcel(c)}
                      className="h-9 rounded-lg bg-blue-50 text-blue-600 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-100 transition"
                    >
                      <DownloadIcon className="size-3.5" /> Excel
                    </button>
                    <button
                      onClick={() => shareViaWhatsApp(c)}
                      className="h-9 rounded-lg bg-green-50 text-green-600 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-green-100 transition"
                    >
                      <Smartphone className="size-3.5" /> WhatsApp
                    </button>
                    <button
                      onClick={() => setDeleteId(c.id)}
                      className="h-9 rounded-lg border border-red-100 bg-red-50 text-red-600 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-red-100 transition"
                    >
                      <Trash2 className="size-3.5" /> Apagar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* AlertDialog — Confirmar apagar */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-5 text-red-500" />
              Apagar Guia
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem a certeza que deseja apagar este documento? Esta ação não pode ser revertida — o
              PDF, os dados extraídos e a guia serão eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              className="rounded-xl bg-red-600 hover:bg-red-500 text-white"
            >
              {deleting ? (
                <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Trash2 className="size-4 mr-2" />
              )}
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl p-3 text-center ${accent ? "bg-secondary text-secondary-foreground" : "bg-primary-foreground/10 text-primary-foreground"}`}
    >
      <div className="flex items-center justify-center gap-1 mb-1 opacity-70">{icon}</div>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-70">{label}</p>
    </div>
  );
}
