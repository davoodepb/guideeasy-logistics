import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  listChecklistsWithItemsStore,
  updateObraStore,
  deleteObraStore,
  type Obra,
  type Checklist,
  getObraStore,
} from "@/lib/store";
import { useAuth } from "@/lib/session";
import { exportChecklistToExcel } from "@/lib/excel-export";
import { shareViaWhatsApp } from "@/lib/whatsapp";
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
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Upload,
  Download,
  Loader2,
  FileText,
  Hash,
  Calendar,
  User,
  AlertTriangle,
  Package,
  Trash2,
  ChevronRight,
  Smartphone,
} from "lucide-react";

export const Route = createFileRoute("/obra/$id")({
  component: ObraDetailPage,
  head: () => ({ meta: [{ title: "Detalhe de Obra — Prudêncio" }] }),
});

async function fetchObra(id: string): Promise<Obra | null> {
  try {
    return await getObraStore(id);
  } catch {
    return null;
  }
}

function ObraDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [obra, setObra] = useState<Obra | null>(null);
  const [guias, setGuias] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmTerminar, setConfirmTerminar] = useState(false);
  const [confirmApagar, setConfirmApagar] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, g] = await Promise.all([fetchObra(id), listChecklistsWithItemsStore(id)]);
      if (!o) {
        toast.error("Obra não encontrada");
        navigate({ to: "/obras" });
        return;
      }
      setObra(o);
      setGuias(g);
    } catch (error) {
      console.warn("Erro ao carregar a obra:", error);
      toast.error("Não foi possível carregar os dados da obra.");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!user) {
      navigate({ to: "/" });
      return;
    }
    void load();
  }, [load, navigate, user]);

  if (!user) return null;

  async function handleTerminarObra() {
    if (!obra) return;
    setBusy(true);
    try {
      await updateObraStore(id, { status: "terminada", terminated_at: Date.now() });
      toast.success("Obra terminada");
      setConfirmTerminar(false);
      void load();
    } catch (e: unknown) {
      toast.error("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  async function handleApagarObra() {
    setBusy(true);
    try {
      await deleteObraStore(id);
      toast.success("Obra apagada");
      navigate({ to: "/obras" });
    } catch (e: unknown) {
      toast.error("Erro: " + (e instanceof Error ? e.message : String(e)));
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-dvh flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!obra) return null;

  const pendentes = guias.filter((g) => g.status === "pendente");
  const transporte = guias.filter((g) => g.tipo_guia !== "devolucao");
  const devolucao = guias.filter((g) => g.tipo_guia === "devolucao");
  const isTerminada = obra.status === "terminada";

  return (
    <main className="min-h-dvh bg-background pb-28">
      {/* Header */}
      <header className="bg-linear-to-br from-primary via-primary to-[oklch(0.22_0.07_255)] text-primary-foreground px-5 pt-6 pb-8 rounded-b-3xl shadow-lg">
        <Link
          to="/obras"
          className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100 transition"
        >
          <ArrowLeft className="size-4" /> Obras
        </Link>

        <div className="mt-3">
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                isTerminada ? "bg-white/20 text-white/70" : "bg-green-400/30 text-green-100"
              }`}
            >
              {isTerminada ? "Terminada" : "Em curso"}
            </span>
          </div>
          <h1 className="text-xl font-bold leading-tight">{obra.nome}</h1>
          {obra.descricao && (
            <p className="text-sm opacity-70 mt-0.5 line-clamp-2">{obra.descricao}</p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs opacity-60">
            <span className="flex items-center gap-1">
              <Calendar className="size-3" />
              {new Date(obra.created_at).toLocaleDateString("pt-PT")}
            </span>
            {obra.created_by && (
              <span className="flex items-center gap-1">
                <User className="size-3" /> {obra.created_by}
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mt-5">
          <StatCard label="Guias" value={guias.length} />
          <StatCard label="Pendentes" value={pendentes.length} accent />
          <StatCard label="Transporte" value={transporte.length} />
          <StatCard label="Devolução" value={devolucao.length} />
        </div>
      </header>

      {/* CTA Upload */}
      {!isTerminada && (
        <section className="px-5 -mt-5">
          <Link
            to="/upload"
            search={{ obra_id: id, obra_nome: obra.nome }}
            className="flex items-center gap-3 bg-card border rounded-2xl p-4 shadow-sm hover:shadow-md active:scale-[0.99] transition"
          >
            <div className="size-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <Upload className="size-5 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm">Carregar Guia</p>
              <p className="text-xs text-muted-foreground">Associar PDF a esta obra</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </section>
      )}

      {/* Resumo de Quantidades */}
      {guias.length > 0 && (
        <section className="px-5 mt-6">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
            <Package className="size-3.5" /> Resumo de Quantidades
          </h2>
          <ResumQuantidadesTable guias={guias} />
        </section>
      )}

      {/* Lista de Guias */}
      <section className="px-5 mt-5">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <FileText className="size-3.5" /> Guias desta obra ({guias.length})
        </h2>

        {guias.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed p-8 text-center">
            <FileText className="size-8 text-muted-foreground mx-auto opacity-40" />
            <p className="mt-2 text-sm text-muted-foreground">Nenhuma guia associada.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {guias.map((g, idx) => (
              <GuiaCard key={g.id} guia={g} idx={idx} />
            ))}
          </div>
        )}
      </section>

      {/* Botões de Ação */}
      {!isTerminada && (
        <section className="px-5 mt-6 space-y-3">
          <button
            onClick={() => setConfirmTerminar(true)}
            className="w-full h-13 rounded-xl bg-primary text-primary-foreground font-bold flex items-center justify-center gap-2 text-sm shadow-lg transition hover:opacity-90 active:scale-[0.98]"
          >
            <CheckCircle2 className="size-5" /> Terminar Obra
          </button>
          <button
            onClick={() => setConfirmApagar(true)}
            className="w-full h-11 rounded-xl bg-red-50 text-red-600 font-semibold flex items-center justify-center gap-2 text-sm transition hover:bg-red-100 active:scale-[0.98]"
          >
            <Trash2 className="size-4" /> Apagar Obra
          </button>
        </section>
      )}

      {isTerminada && (
        <section className="px-5 mt-6 space-y-3">
          <div className="bg-muted/50 rounded-xl p-4 text-center">
            <CheckCircle2 className="size-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-sm text-muted-foreground font-medium">Obra terminada</p>
            {obra.terminated_at && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(obra.terminated_at).toLocaleDateString("pt-PT")}
              </p>
            )}
          </div>
          <button
            onClick={() => setConfirmApagar(true)}
            className="w-full h-11 rounded-xl bg-red-50 text-red-600 font-semibold flex items-center justify-center gap-2 text-sm transition hover:bg-red-100 active:scale-[0.98]"
          >
            <Trash2 className="size-4" /> Apagar Obra
          </button>
        </section>
      )}

      {/* AlertDialog — Terminar Obra */}
      <AlertDialog open={confirmTerminar} onOpenChange={setConfirmTerminar}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="size-5 text-primary" />
              Terminar Obra
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left">
                <div className="bg-muted/50 rounded-xl p-3">
                  <p className="text-sm font-semibold text-foreground">{obra?.nome}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {guias.length} guia{guias.length !== 1 ? "s" : ""} associada
                    {guias.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  A obra passará para o estado "Terminada". Os dados e guias serão preservados para
                  consulta.
                </p>
                {pendentes.length > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800">
                      Existem <strong>{pendentes.length}</strong> guia
                      {pendentes.length !== 1 ? "s" : ""} por validar.
                    </p>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleTerminarObra}
              className="rounded-xl bg-primary hover:opacity-90"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="size-4 mr-2" />
              )}
              Terminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog — Apagar Obra */}
      <AlertDialog open={confirmApagar} onOpenChange={setConfirmApagar}>
        <AlertDialogContent className="max-w-sm rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="size-5 text-red-500" />
              Apagar Obra
            </AlertDialogTitle>
            <AlertDialogDescription>
              A obra <strong>"{obra?.nome}"</strong> será apagada. As guias associadas serão
              desvinculadas mas não eliminadas. Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApagarObra}
              className="rounded-xl bg-red-600 hover:bg-red-500 text-white"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <Trash2 className="size-4 mr-2" />
              )}
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

function ResumQuantidadesTable({ guias }: { guias: Checklist[] }) {
  // ─── Cálculo de stock por artigo ───
  type ArtigoStock = {
    artigo: string;
    descricao: string;
    unidade: string;
    enviado: number;
    devolvido: number;
  };

  const mapa = new Map<string, ArtigoStock>();

  for (const guia of guias) {
    const isDevolucao = guia.tipo_guia === "devolucao";
    for (const item of guia.items || []) {
      const key = (item.artigo || "").trim() || "__SEM_ARTIGO__";
      const qty = parseFloat((item.quantidade || "0").replace(",", ".")) || 0;

      if (!mapa.has(key)) {
        mapa.set(key, {
          artigo: key === "__SEM_ARTIGO__" ? "Sem Artigo" : item.artigo,
          descricao: item.descricao || "—",
          unidade: item.unidade || "—",
          enviado: 0,
          devolvido: 0,
        });
      }

      const entry = mapa.get(key)!;
      if (isDevolucao) {
        entry.devolvido += qty;
      } else {
        entry.enviado += qty;
      }
    }
  }

  const artigos = Array.from(mapa.values()).sort((a, b) => a.artigo.localeCompare(b.artigo, "pt"));

  // Totais globais
  const totalEnviado = artigos.reduce((s, a) => s + a.enviado, 0);
  const totalDevolvido = artigos.reduce((s, a) => s + a.devolvido, 0);
  const totalSaldo = totalEnviado - totalDevolvido;

  if (artigos.length === 0) return null;

  return (
    <div className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="text-left p-3 pl-4 font-semibold text-foreground text-xs">Artigo</th>
              <th className="text-left p-3 font-semibold text-foreground text-xs hidden sm:table-cell">
                Descrição
              </th>
              <th className="text-right p-3 font-semibold text-blue-600 text-xs">Enviado</th>
              <th className="text-right p-3 font-semibold text-orange-600 text-xs">Devolvido</th>
              <th className="text-right p-3 pr-4 font-semibold text-foreground text-xs">Saldo</th>
              <th className="text-center p-3 font-semibold text-foreground text-xs w-12">Un.</th>
            </tr>
          </thead>
          <tbody>
            {artigos.map((a, idx) => {
              const saldo = a.enviado - a.devolvido;
              return (
                <tr
                  key={a.artigo + idx}
                  className="border-b last:border-b-0 hover:bg-muted/30 transition"
                >
                  <td className="p-3 pl-4 font-mono text-xs font-medium text-foreground">
                    {a.artigo}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground truncate max-w-[180px] hidden sm:table-cell">
                    {a.descricao}
                  </td>
                  <td className="text-right p-3 font-bold text-blue-600 tabular-nums">
                    {a.enviado.toFixed(2)}
                  </td>
                  <td className="text-right p-3 font-bold text-orange-600 tabular-nums">
                    {a.devolvido.toFixed(2)}
                  </td>
                  <td
                    className={`text-right p-3 pr-4 font-bold tabular-nums ${
                      saldo > 0
                        ? "text-green-600"
                        : saldo < 0
                          ? "text-red-600"
                          : "text-muted-foreground"
                    }`}
                  >
                    {saldo.toFixed(2)}
                  </td>
                  <td className="text-center p-3 text-[10px] uppercase text-muted-foreground font-medium">
                    {a.unidade}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Linha de totais */}
          <tfoot className="bg-secondary/10 border-t-2">
            <tr>
              <td className="p-3 pl-4 font-bold text-foreground text-xs" colSpan={2}>
                <span className="hidden sm:inline">
                  TOTAL ({artigos.length} artigo{artigos.length !== 1 ? "s" : ""})
                </span>
                <span className="sm:hidden">TOTAL</span>
              </td>
              <td className="text-right p-3 font-bold text-blue-600 tabular-nums">
                {totalEnviado.toFixed(2)}
              </td>
              <td className="text-right p-3 font-bold text-orange-600 tabular-nums">
                {totalDevolvido.toFixed(2)}
              </td>
              <td
                className={`text-right p-3 pr-4 font-bold text-lg tabular-nums ${
                  totalSaldo >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {totalSaldo.toFixed(2)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function GuiaCard({ guia, idx }: { guia: Checklist; idx: number }) {
  const date = guia.data_documento || new Date(guia.created_at).toLocaleDateString("pt-PT");
  const isTransporte = guia.tipo_guia !== "devolucao";

  return (
    <div
      className="bg-card rounded-2xl border shadow-sm overflow-hidden animate-fade-in-up"
      style={{ animationDelay: `${idx * 40}ms` }}
    >
      <div className="bg-muted/30 px-4 py-3 border-b flex items-center gap-3">
        <FileText className="size-4 text-primary shrink-0" />
        <p className="font-semibold text-sm truncate flex-1">
          {guia.pdf_name || `${guia.numero_guia || "Sem número"}`}
        </p>
        <span
          className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full shrink-0 ${
            isTransporte ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"
          }`}
        >
          {isTransporte ? "Transporte" : "Devolução"}
        </span>
      </div>

      <Link
        to={guia.status === "concluida" ? "/completed/$id" : "/checklist/$id"}
        params={{ id: guia.id }}
      >
        <div className="p-4 grid grid-cols-2 gap-y-2.5 gap-x-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="size-3.5 shrink-0" />
            <span className="truncate text-xs">{date}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Hash className="size-3.5 shrink-0" />
            <span className="truncate text-xs font-mono">{guia.numero_guia || "—"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Package className="size-3.5 shrink-0" />
            <span className="text-xs">{guia.items?.length || 0} artigos</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                guia.status === "concluida"
                  ? "bg-green-100 text-green-700"
                  : "bg-yellow-100 text-yellow-700"
              }`}
            >
              {guia.status === "concluida" ? "Validada" : "Pendente"}
            </span>
          </div>
        </div>
      </Link>

      <div className="px-4 py-2.5 bg-muted/10 border-t flex gap-2">
        <button
          onClick={() => exportChecklistToExcel(guia)}
          className="h-8 flex-1 rounded-lg bg-blue-50 text-blue-600 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-blue-100 transition"
        >
          <Download className="size-3" /> Excel
        </button>
        <button
          onClick={() => shareViaWhatsApp(guia)}
          className="h-8 flex-1 rounded-lg bg-green-50 text-green-600 font-semibold text-xs flex items-center justify-center gap-1.5 hover:bg-green-100 transition"
        >
          <Smartphone className="size-3" /> WhatsApp
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-3 text-center ${accent ? "bg-secondary text-secondary-foreground" : "bg-primary-foreground/10 text-primary-foreground"}`}
    >
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-wider opacity-70 mt-0.5">{label}</p>
    </div>
  );
}
