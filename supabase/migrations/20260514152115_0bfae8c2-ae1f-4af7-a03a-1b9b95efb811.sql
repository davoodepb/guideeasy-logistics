
CREATE TABLE IF NOT EXISTS public.checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_at text,
  numero_guia text,
  data_documento date,
  data_carga date,
  hora_carga text,
  observacoes_renato text,
  status text NOT NULL DEFAULT 'pendente',
  created_by text,
  responsavel text,
  observacoes_colaborador text,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id uuid NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
  artigo text,
  descricao text,
  quantidade text,
  unidade text,
  checked boolean NOT NULL DEFAULT false,
  position int NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS checklist_items_checklist_id_idx
  ON public.checklist_items (checklist_id);

CREATE TABLE IF NOT EXISTS public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checklists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_users        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read checklists"        ON public.checklists       FOR SELECT USING (true);
CREATE POLICY "public write checklists"       ON public.checklists       FOR INSERT WITH CHECK (true);
CREATE POLICY "public update checklists"      ON public.checklists       FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "public read items"             ON public.checklist_items  FOR SELECT USING (true);
CREATE POLICY "public write items"            ON public.checklist_items  FOR INSERT WITH CHECK (true);
CREATE POLICY "public update items"           ON public.checklist_items  FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public delete items"           ON public.checklist_items  FOR DELETE USING (true);

CREATE POLICY "public read app_users"         ON public.app_users        FOR SELECT USING (true);
CREATE POLICY "public write app_users"        ON public.app_users        FOR INSERT WITH CHECK (true);
