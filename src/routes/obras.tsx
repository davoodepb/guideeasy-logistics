import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listObrasStore, createObraStore, type Obra } from "@/lib/store";
import { useAuth } from "@/lib/session";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  ChevronRight,
  Calendar,
  User,
  Search,
  X,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/obras")({
  component: ObrasPage,
  head: () => ({ meta: [{ title: "Obras — Prudêncio" }] }),
});

function ObrasPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nomeError, setNomeError] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate({ to: "/" });
      return;
    }
    load();
  }, [user, navigate]);

  if (!user) return null;

  function load() {
    setLoading(true);
    setLoadError(null);
    listObrasStore()
      .then((data) => setObras(data))
      .catch((error: unknown) => {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code?: unknown }).code)
            : "";
        const message = error instanceof Error ? error.message : String(error);
        const permissionDenied =
          code === "permission-denied" || message.toLowerCase().includes("permission");
        const friendlyMessage = permissionDenied
          ? "Acesso recusado. Inicie sessão com Firebase Authentication e confirme as regras do Firestore."
          : "Não foi possível carregar as obras. Tente novamente.";
        console.warn("Erro ao carregar obras:", error);
        setLoadError(friendlyMessage);
        toast.error(friendlyMessage);
      })
      .finally(() => setLoading(false));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!nome.trim()) {
      setNomeError("O nome da obra é obrigatório.");
      toast.error("Introduza o nome da obra");
      return;
    }
    setNomeError("");
    setSaving(true);
    try {
      await createObraStore({
        nome: nome.trim(),
        descricao: descricao.trim() || undefined,
        status: "ativa",
        created_by: profile?.name,
        created_at: Date.now(),
      });
      toast.success("Obra criada com sucesso");
      setNome("");
      setDescricao("");
      setShowForm(false);
      load();
    } catch (e: unknown) {
      toast.error("Erro: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  }

  const filtered = obras.filter((o) => o.nome.toLowerCase().includes(searchTerm.toLowerCase()));
  const ativas = filtered.filter((o) => o.status === "ativa");
  const terminadas = filtered.filter((o) => o.status === "terminada");

  return (
    <main className="min-h-[100dvh] bg-background pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary via-primary to-[oklch(0.22_0.07_255)] text-primary-foreground px-5 pt-6 pb-8 rounded-b-3xl shadow-lg">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-sm opacity-80 hover:opacity-100 transition"
        >
          <ArrowLeft className="size-4" /> Voltar
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Obras</h1>
            <p className="text-sm opacity-70 mt-0.5">Gestão de obras em curso</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="h-10 px-4 rounded-xl bg-primary-foreground/15 text-primary-foreground font-semibold text-sm flex items-center gap-2 hover:bg-primary-foreground/25 transition active:scale-[0.98]"
          >
            <Plus className="size-4" /> Nova Obra
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="rounded-2xl bg-primary-foreground/10 p-3 text-center">
            <p className="text-2xl font-bold">{ativas.length}</p>
            <p className="text-[10px] uppercase tracking-wider opacity-70 mt-0.5">Em curso</p>
          </div>
          <div className="rounded-2xl bg-primary-foreground/10 p-3 text-center">
            <p className="text-2xl font-bold">{terminadas.length}</p>
            <p className="text-[10px] uppercase tracking-wider opacity-70 mt-0.5">Terminadas</p>
          </div>
        </div>
      </header>

      {/* Barra de Pesquisa */}
      <div className="px-5 -mt-4 relative z-10">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            id="search-obras"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar obra por nome..."
            className="w-full h-12 pl-11 pr-10 rounded-2xl border bg-card shadow-sm text-sm outline-none focus:ring-2 focus:ring-ring transition"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 size-6 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition"
              aria-label="Limpar pesquisa"
            >
              <X className="size-3.5 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      <section className="px-5 mt-4">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : loadError ? (
          <div className="bg-card rounded-2xl border border-red-200 p-10 text-center">
            <AlertTriangle className="size-10 text-red-500 mx-auto opacity-80" />
            <p className="mt-3 text-sm font-semibold text-red-700">{loadError}</p>
            <button
              onClick={load}
              className="mt-4 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 hover:opacity-90 transition"
            >
              Tentar novamente
            </button>
          </div>
        ) : filtered.length === 0 && searchTerm ? (
          <div className="bg-card rounded-2xl border border-dashed p-10 text-center">
            <Search className="size-10 text-muted-foreground mx-auto opacity-40" />
            <p className="mt-3 text-sm text-muted-foreground">
              Nenhuma obra encontrada para "{searchTerm}".
            </p>
            <button
              onClick={() => setSearchTerm("")}
              className="mt-4 h-10 px-5 rounded-xl bg-muted text-sm font-semibold inline-flex items-center gap-2 hover:bg-muted/80 transition"
            >
              <X className="size-4" /> Limpar pesquisa
            </button>
          </div>
        ) : obras.length === 0 ? (
          <div className="bg-card rounded-2xl border border-dashed p-10 text-center">
            <Building2 className="size-10 text-muted-foreground mx-auto opacity-40" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma obra registada.</p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-2 hover:opacity-90 transition"
            >
              <Plus className="size-4" /> Criar primeira obra
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {ativas.length > 0 && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <Clock className="size-3.5" /> Em curso ({ativas.length})
                </h2>
                <div className="space-y-3">
                  {ativas.map((o, idx) => (
                    <ObraCard key={o.id} obra={o} idx={idx} />
                  ))}
                </div>
              </div>
            )}
            {terminadas.length > 0 && (
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                  <CheckCircle2 className="size-3.5" /> Terminadas ({terminadas.length})
                </h2>
                <div className="space-y-3">
                  {terminadas.map((o, idx) => (
                    <ObraCard key={o.id} obra={o} idx={idx} terminada />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Dialog — Nova Obra */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <div className="size-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Building2 className="size-5 text-primary" />
              </div>
              Nova Obra
            </DialogTitle>
            <DialogDescription>
              Preencha os dados para criar uma nova obra em curso.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Nome da Obra <span className="text-destructive">*</span>
              </label>
              <input
                type="text"
                value={nome}
                onChange={(e) => {
                  setNome(e.target.value);
                  if (e.target.value.trim()) setNomeError("");
                }}
                placeholder="Ex: Condomínio das Fontainhas"
                autoFocus
                className={`mt-1.5 h-12 w-full rounded-xl border bg-background px-4 text-sm outline-none transition ${
                  nomeError ? "border-red-500 focus:ring-red-200" : "border-input focus:ring-ring"
                } focus:ring-2`}
              />
              {nomeError && (
                <p className="text-xs text-red-500 mt-1 font-semibold flex items-center gap-1 animate-fade-in">
                  <AlertTriangle className="size-3.5" /> {nomeError}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Descrição (opcional)
              </label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                placeholder="Notas sobre a obra..."
                rows={2}
                className="mt-1.5 w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring transition resize-none"
              />
            </div>

            <DialogFooter className="gap-2 sm:gap-0 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="h-11 px-4 rounded-xl bg-muted font-semibold text-sm transition hover:bg-muted/80"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving || !nome.trim()}
                className="h-11 px-5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center gap-2 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
              >
                {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                Criar
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function ObraCard({ obra, idx, terminada }: { obra: Obra; idx: number; terminada?: boolean }) {
  const date = new Date(obra.created_at).toLocaleDateString("pt-PT");

  return (
    <Link
      to="/obra/$id"
      params={{ id: obra.id }}
      className="block bg-card rounded-2xl border shadow-sm overflow-hidden hover:shadow-md transition-all active:scale-[0.99] animate-fade-in-up"
      style={{ animationDelay: `${idx * 50}ms` }}
    >
      <div className="p-4 flex items-center gap-4">
        <div
          className={`size-11 rounded-xl flex items-center justify-center shrink-0 ${
            terminada ? "bg-muted" : "bg-primary/10"
          }`}
        >
          <Building2 className={`size-5 ${terminada ? "text-muted-foreground" : "text-primary"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{obra.nome}</p>
          {obra.descricao && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{obra.descricao}</p>
          )}
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="size-3" /> {date}
            </span>
            {obra.created_by && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <User className="size-3" /> {obra.created_by}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-full ${
              terminada ? "bg-muted text-muted-foreground" : "bg-green-100 text-green-700"
            }`}
          >
            {terminada ? "Terminada" : "Em curso"}
          </span>
          <ChevronRight className="size-4 text-muted-foreground" />
        </div>
      </div>
    </Link>
  );
}
