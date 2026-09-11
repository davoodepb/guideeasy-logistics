import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  listActivityLogsStore,
  deleteActivityLogStore,
  deleteAllActivityLogsStore,
  type ActivityLog,
} from "@/lib/store";
import { useAuth } from "@/lib/session";
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
  Trash2,
  Search,
  Download,
  Clock,
  User,
  FileText,
  AlertTriangle,
} from "lucide-react";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/historico")({
  component: HistoricoPage,
  head: () => ({ meta: [{ title: "Histórico — Prudêncio" }] }),
});

function HistoricoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate({ to: "/" });
      return;
    }
    if (user.role !== "admin") {
      toast.error("Acesso restrito a administradores.");
      navigate({ to: "/dashboard" });
      return;
    }
    loadLogs();
  }, [user, navigate]);

  function loadLogs() {
    setLoading(true);
    listActivityLogsStore()
      .then((data) => setLogs(data))
      .catch((err) => {
        console.warn("Erro ao carregar histórico:", err);
        toast.error("Não foi possível carregar o histórico.");
      })
      .finally(() => setLoading(false));
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await deleteActivityLogStore(id);
      setLogs((prev) => prev.filter((l) => l.id !== id));
      toast.success("Registo apagado.");
    } catch {
      toast.error("Erro ao apagar registo.");
    } finally {
      setDeleting(false);
      setDeleteId(null);
    }
  }

  async function handleDeleteAll() {
    setDeleting(true);
    try {
      await deleteAllActivityLogsStore();
      setLogs([]);
      toast.success("Todo o histórico foi apagado.");
    } catch {
      toast.error("Erro ao apagar histórico.");
    } finally {
      setDeleting(false);
      setShowDeleteAll(false);
    }
  }

  function exportToExcel() {
    if (logs.length === 0) {
      toast.error("Não há dados para exportar.");
      return;
    }

    const data = filteredLogs.map((l) => ({
      "Data/Hora": new Date(l.created_at).toLocaleString("pt-PT"),
      Ação: actionLabel(l.action),
      Tipo: l.entity_type,
      Nome: l.entity_name || "",
      Utilizador: l.user_name || l.user_email || "",
      Detalhes: l.details || "",
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(data);

    // Ajustar largura das colunas
    ws["!cols"] = [
      { wch: 20 },
      { wch: 20 },
      { wch: 15 },
      { wch: 30 },
      { wch: 25 },
      { wch: 40 },
    ];

    XLSX.utils.book_append_sheet(wb, ws, "Histórico");

    const filename = `historico_prudencio_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    toast.success(`Exportado: ${filename}`);
  }

  function exportToCSV() {
    if (logs.length === 0) {
      toast.error("Não há dados para exportar.");
      return;
    }

    const headers = ["Data/Hora", "Ação", "Tipo", "Nome", "Utilizador", "Detalhes"];
    const rows = filteredLogs.map((l) => [
      new Date(l.created_at).toLocaleString("pt-PT"),
      actionLabel(l.action),
      l.entity_type,
      l.entity_name || "",
      l.user_name || l.user_email || "",
      l.details || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `historico_prudencio_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  }

  const filteredLogs = logs.filter((l) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      actionLabel(l.action).toLowerCase().includes(q) ||
      l.entity_type?.toLowerCase().includes(q) ||
      l.entity_name?.toLowerCase().includes(q) ||
      l.user_name?.toLowerCase().includes(q) ||
      l.user_email?.toLowerCase().includes(q) ||
      l.details?.toLowerCase().includes(q)
    );
  });

  return (
    <main className="min-h-[100dvh] bg-background pb-24">
      {/* Header */}
      <header className="bg-gradient-to-br from-primary via-primary to-[oklch(0.22_0.07_255)] text-primary-foreground px-5 pt-8 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate({ to: "/dashboard" })}
              className="size-10 rounded-full bg-primary-foreground/10 flex items-center justify-center hover:bg-primary-foreground/20 transition"
            >
              <ArrowLeft className="size-5" />
            </button>
            <div>
              <p className="text-xs uppercase tracking-wider text-primary-foreground/50">
                Administração
              </p>
              <h1 className="text-xl font-bold">Histórico de Atividades</h1>
            </div>
          </div>
        </div>

        {/* Contadores */}
        <div className="grid grid-cols-2 gap-3 mt-5">
          <div className="bg-primary-foreground/10 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold">{logs.length}</p>
            <p className="text-xs text-primary-foreground/60">Total de registos</p>
          </div>
          <div className="bg-primary-foreground/10 rounded-2xl p-3 text-center">
            <p className="text-2xl font-bold">{filteredLogs.length}</p>
            <p className="text-xs text-primary-foreground/60">Filtrados</p>
          </div>
        </div>
      </header>

      <div className="px-5 mt-5 space-y-4">
        {/* Pesquisa */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Pesquisar no histórico..."
            className="w-full pl-10 pr-4 py-3 rounded-xl border bg-card text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Ações */}
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-medium hover:bg-green-500 transition"
          >
            <Download className="size-4" />
            Excel (.xlsx)
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition"
          >
            <Download className="size-4" />
            CSV
          </button>
          {logs.length > 0 && user?.role === "admin" && (
            <button
              onClick={() => setShowDeleteAll(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-500 transition ml-auto"
            >
              <Trash2 className="size-4" />
              Apagar Tudo
            </button>
          )}
        </div>

        {/* Lista */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            A carregar histórico...
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <FileText className="size-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sem registos de atividade</p>
            <p className="text-sm mt-1">
              {searchQuery
                ? "Nenhum resultado para a pesquisa."
                : "As atividades aparecerão aqui automaticamente."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="bg-card border rounded-xl p-4 flex items-start gap-3"
              >
                <div className="size-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  {actionIcon(log.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{actionLabel(log.action)}</p>
                  {log.entity_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      {log.entity_type}: {log.entity_name}
                    </p>
                  )}
                  {log.details && (
                    <p className="text-xs text-muted-foreground mt-0.5">{log.details}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {new Date(log.created_at).toLocaleString("pt-PT")}
                    </span>
                    {(log.user_name || log.user_email) && (
                      <span className="flex items-center gap-1">
                        <User className="size-3" />
                        {log.user_name || log.user_email}
                      </span>
                    )}
                  </div>
                </div>
                {user?.role === "admin" && (
                  <button
                    onClick={() => setDeleteId(log.id)}
                    className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-600 hover:bg-red-50 transition shrink-0"
                    title="Apagar registo"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmar apagar individual */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar registo?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-500"
            >
              {deleting ? "A apagar..." : "Apagar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar apagar tudo */}
      <AlertDialog open={showDeleteAll} onOpenChange={setShowDeleteAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-red-600" />
              Apagar todo o histórico?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Todos os {logs.length} registos serão permanentemente eliminados.
              Esta ação não pode ser revertida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-500"
            >
              {deleting ? "A apagar..." : "Apagar Tudo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    criar_guia: "Guia Criada",
    editar_guia: "Guia Editada",
    concluir_guia: "Guia Concluída",
    apagar_guia: "Guia Apagada",
    criar_obra: "Obra Criada",
    editar_obra: "Obra Editada",
    terminar_obra: "Obra Terminada",
    apagar_obra: "Obra Apagada",
    login: "Login",
    logout: "Logout",
    exportar_excel: "Exportação Excel",
    upload_pdf: "Upload PDF",
  };
  return labels[action] || action;
}

function actionIcon(action: string) {
  if (action.includes("apagar")) return <Trash2 className="size-4" />;
  if (action.includes("login") || action.includes("logout"))
    return <User className="size-4" />;
  return <FileText className="size-4" />;
}
