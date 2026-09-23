# Meeting Intelligence — Fase 2: Casca Completa (spec de implementação)

> **Objetivo desta fase:** commitar **todas** as telas do mockup aprovado
> (`docs/mockups/meeting-intelligence-prototype.html`), de modo que quando os
> motores externos forem contratados (Claude via CNPJ, transcrição/gravação,
> pagamento) **ligar seja trocar uma flag** — sem reabrir nem reescrever o módulo.
>
> **Fonte única (No Invention):** cada tela/regra abaixo rastreia ao mockup. Onde
> o mockup não define um valor real (preços, integração externa), está listado em
> **§10 Decisões pendentes** — nada é inventado.

---

## 1. Princípio — o que "pronto para plugar" significa

Três camadas separadas desde já:

1. **UI completa** — todas as telas construídas e commitadas.
2. **Contrato de dados fixo** — funções tipadas no data-layer. Hoje retornam
   vazio/placeholder ou no-op; ao ligar um motor, troca-se **só o miolo** delas.
   Nenhuma tela muda.
3. **Feature flags por capacidade** — controlam o que aparece e o que executa.
   Ligar o módulo = virar flag + conectar o serviço real.

Regra de ouro: **nenhuma tela lê dado "chumbado".** Tudo passa pelo data-layer,
para que a virada seja só de implementação interna.

---

## 2. Estado atual (base desta fase)

| Item | Estado |
|------|--------|
| Fatia 1A — ingestão manual (colar), lista, detalhe, transcrição, copiar | ✅ Live |
| Fatia 1B — resumo por IA (Edge Function `meeting-summarize`) | 🟡 Dormente (`AI_SUMMARY_ENABLED=false`) |
| Polimento visual (lista + detalhe pelo mockup) | ✅ Feito (pendente commit) |
| Padrão de banco | RLS-off + `tenant_id` do cliente em toda escrita/leitura |
| Identidade FK | Colunas dono/autor → `public.profiles(id)` (nunca `auth.users`) |

---

## 3. Dependências externas (os "motores") e como cada uma liga

| Motor | Habilita | Como liga (sem tocar UI) |
|-------|----------|--------------------------|
| **Claude via CNPJ** | Resumo por IA, Chat RAG | Setar secret `ANTHROPIC_API_KEY` no Supabase + `AI_SUMMARY_ENABLED=true` |
| **Transcrição** (áudio→texto: Deepgram/Whisper) | Converter gravação/áudio em transcript | Nova Edge Function + `TRANSCRIPTION_ENABLED=true` |
| **Gravação no navegador** | Gravar na aba, player, download | `RECORDING_ENABLED=true` (código de captura já no lugar) |
| **Pagamento** (Pix/cartão) | Contratar horas avulsas | Integrar provedor no `meetingBilling` + `BILLING_ENABLED=true` |

Enquanto o motor não existe, a capacidade correspondente fica **oculta por flag**
(decisão confirmada) — o cliente não vê botão morto.

---

## 4. Feature flags

Arquivo único: `src/config/meetingFlags.ts` (exporta constantes tipadas).

| Flag | Controla | Default agora | Depende de |
|------|----------|---------------|-----------|
| `AI_SUMMARY_ENABLED` | Aba Resumo com IA + botão Gerar | `false` | Claude/CNPJ |
| `CHAT_RAG_ENABLED` | Aba Chat sobre a reunião | `false` | Claude/CNPJ |
| `RECORDING_ENABLED` | Gravar no navegador + player + download | `false` | Motor gravação |
| `TRANSCRIPTION_ENABLED` | Fontes de áudio (Zoom/Meet/Teams/upload áudio) → transcript | `false` | Motor transcrição |
| `HOURS_QUOTA_ENABLED` | Velocímetro, cota por usuário, solicitar horas, Gestão do módulo (consumo) | `false` | Motor (mede horas) |
| `BILLING_ENABLED` | Contratar horas (Pix/cartão) | `false` | Pagamento |
| `NOTES_ENABLED` | Aba Notas | **`true`** | — (funciona já) |
| `SHARING_ENABLED` | Compartilhar reunião | **`true`** | — (funciona já) |

> Notas e Compartilhamento já funcionam de verdade (só dependem de banco), então
> nascem ligados. Todo o resto nasce desligado e oculto.

---

## 5. Modelo de dados (migrations agora)

Todas as tabelas seguem o padrão da 1A: **sem RLS** (isolamento no cliente via
`tenant_id = getActiveTenantId()`), FKs de pessoa → `profiles(id)`. Uma migration
por bloco, para aplicar/revisar em partes.

| Tabela nova | Campos-chave | Serve a | Funciona já? |
|-------------|--------------|---------|--------------|
| `meeting_notes` | `id, tenant_id, meeting_id→meetings, author_id→profiles, body, time_anchor(text null), created_at` | Aba Notas | ✅ Sim |
| `meeting_shares` | `id, tenant_id, meeting_id, shared_with_id→profiles, shared_by_id→profiles, created_at` | Compartilhamento | ✅ Sim |
| `meeting_quotas` | `id, tenant_id, profile_id→profiles, role_context, quota_minutes, used_minutes, period_start, period_end, updated_at` | Cota por usuário / velocímetro | 🟡 Casca (used_minutes só o motor preenche) |
| `meeting_hour_requests` | `id, tenant_id, requester_id→profiles, type('temporaria'\|'definitiva'), minutes, justification, status('pending'\|'approved'\|'denied'), granted_minutes, decided_by→profiles, reason, created_at, decided_at` | Solicitar/Aprovar/Recusar | 🟡 Fluxo funciona; consumo depende do motor |
| `meeting_hour_purchases` | `id, tenant_id, minutes, amount_cents, method('pix'\|'card'), status, purchased_by→profiles, created_at` | Contratar horas | 🟡 Casca até pagamento |
| `tenant_meeting_pool` | `tenant_id(pk), contracted_minutes, extra_minutes, period_start, period_end, renova_at` | Pool do workspace (KPIs) | 🟡 Casca |
| `meeting_notifications` | `id, tenant_id, audience('admin'\|profile_id), kind, text, read(bool), created_at` | Sino/notificações | 🟡 Emite só de features ativas |

**Colunas novas em `meetings`** (nullable, não quebram a 1A):
- `audio_url text null` — gravação (RECORDING).
- `archived_at timestamptz null` — arquivar (retenção 30 dias; ver §7).

> Cotas/horas guardadas em **minutos** (int) para evitar float; a UI formata em h/min.

---

## 6. Data-layer (`src/data/db/`)

Um módulo por domínio, todos com `safeCall` + cast `tbl()` (padrão da 1A). Comportamento **flag-off** definido em cada função (retorno neutro, nunca erro).

| Módulo | Funções | flag-off retorna |
|--------|---------|------------------|
| `meetingNotes.ts` | `listNotes`, `createNote`, `deleteNote` | (ativo) |
| `meetingShares.ts` | `listShares`, `addShare`, `removeShare`, `sharedWithMe` | (ativo) |
| `meetingQuotas.ts` | `getMyQuota`, `listTenantQuotas`, `adjustQuota`, `getPool` | zeros / vazio |
| `meetingRequests.ts` | `createRequest`, `listRequests`, `approveRequest`, `denyRequest` | vazio / no-op |
| `meetingBilling.ts` | `listPurchases`, `purchaseHours` | `purchaseHours` = no-op (retorna "indisponível") |
| `meetingNotifications.ts` | `listNotifications`, `markRead`, `markAllRead`, `emit` | (ativo; `emit` só das features ligadas) |
| `meetingUsage.ts` | `recordUsage(meetingId, minutes)` | **stub** — só o motor de transcrição chama de verdade |

---

## 7. Telas / blocos (por onda)

Cada bloco: **origem no mockup** · **dado** · **flag** · **funciona já vs casca**.

### Onda A — funciona de verdade já (não depende de motor)

| Bloco | Origem (mockup) | Dado | Flag |
|-------|-----------------|------|------|
| **Aba Notas** no detalhe | `tabNotas` | `meeting_notes` | `NOTES_ENABLED=true` |
| **Compartilhar** (chips no header + modal seleção) | `openShareModal`, `headerDetail` | `meeting_shares` | `SHARING_ENABLED=true` |
| **Lista: "Compartilhada comigo / por"** + bolinhas | `renderList` metaShare | `meeting_shares` | `SHARING_ENABLED` |
| **Regra de dono** (só dono compartilha/baixa; visão compartilhada = read-only) | `canManage`, `headerDetail` | `meetings.owner_id` + shares | — |
| **Ajuda do módulo** (seções ativas conforme flags) | `renderHelp` | estático | — |

### Onda B — casca oculta por flag (liga com o motor)

| Bloco | Origem (mockup) | Dado | Flag |
|-------|-----------------|------|------|
| **Velocímetro "Suas horas"** (topo da lista, visão usuário) | `userQuotaMini` | `meeting_quotas` | `HOURS_QUOTA_ENABLED` |
| **Card de horas no Início** (workspace/pessoal) | `renderHome` | quotas + pool | `HOURS_QUOTA_ENABLED` |
| **Solicitar mais horas** (modal temp/definitiva + justificativa) | `openRequestModal` | `meeting_hour_requests` | `HOURS_QUOTA_ENABLED` |
| **Aprovar / Recusar** (fila admin, conceder ≠ pedido, motivo) | `approveRequest`,`openDenyModal` | requests | `HOURS_QUOTA_ENABLED` |
| **Gestão do módulo** (KPIs consumo, projeção, tabela cota/usuário, economia por compartilhamento) | `renderAdmin` | pool + quotas | `HOURS_QUOTA_ENABLED` |
| **Liberar acesso ao módulo** (incluir usuários, cota padrão do cargo) | `openAddUsersModal` | `meeting_quotas` | `HOURS_QUOTA_ENABLED` |
| **Contratar horas** (régua Pix/cartão, preço na hora) | régua `renderAdmin` | `meeting_hour_purchases` + pool | `BILLING_ENABLED` |
| **Nova reunião — fontes de áudio** (Zoom/Meet/Teams/gravar) | `renderNew` | — | `TRANSCRIPTION_ENABLED` / `RECORDING_ENABLED` |
| **Gravar no navegador** (timer, encerrar, toggle áudio da call) | `renderRecord` | `meetings.audio_url` | `RECORDING_ENABLED` |
| **Player + Baixar áudio** (detalhe) | `headerDetail` player | `meetings.audio_url` | `RECORDING_ENABLED` |
| **Aba Chat (RAG)** | `tabChat` | transcript + Claude | `CHAT_RAG_ENABLED` |
| **Aba Resumo por IA + Gerar** | `tabResumo` | `meetings.summary` | `AI_SUMMARY_ENABLED` (já existe) |
| **Reprocessar** resumo | `headerDetail` actions | Edge Function | `AI_SUMMARY_ENABLED` |
| **Arquivar** (sai da lista, 30 dias no repositório) | `data-archive` | `meetings.archived_at` | — (funciona já; regra de purga = §10) |
| **Notificações** (sino + painel) | `renderNotif` | `meeting_notifications` | emite só de features ligadas |

### Já entregue (Fatia 1A + polimento)
Lista, detalhe (Resumo/Transcrição), colar transcrição, copiar. Filtros e busca.

---

## 8. Navegação & gating

- **Nova reunião** vira **tela dedicada** (mockup `renderNew`) com as fontes; com
  `RECORDING/TRANSCRIPTION` off, só **"Colar transcrição"** aparece (o modal atual
  é absorvido pela tela). → *ver §10 (tela vs modal).*
- **Gestão do módulo**: segmented control "Minhas reuniões / Gestão do módulo"
  (admin), como no mockup. Só aparece com `HOURS_QUOTA_ENABLED` **ou** quando houver
  gestão de acesso a exibir. Conteúdo modular por flag.
- **Ajuda**: botão no topo da tela de Reuniões → `renderHelp` (seções conforme flags).
- **Card de horas no Início**: integra na tela de Início existente (board de
  widgets, react-grid-layout) como um widget. → *ver §10 (integração Início).*
- **Sino de notificações**: no header da tela de Reuniões.
- Gating de menu por papel continua pelo padrão da 1A (Sidebar/`ROLE_NAV_MAP`).

---

## 9. Fora de escopo desta fase

- Implementar de fato os motores (Claude, transcrição, gravação, pagamento) —
  esta fase entrega a **casca** que os recebe.
- Integração real com APIs de Zoom/Meet/Teams (as opções ficam como fontes; a
  captura real depende do motor de gravação/transcrição).
- Relatórios/BI de reuniões além dos KPIs do mockup.

---

## 10. Decisões — RESOLVIDAS (2026-09-23)

1. **Régua de cota/preço** ✅ Default = **R$ 2,00/h avulsa** (ajuste do dono
   sobre o mockup, que dizia R$5) + cotas por cargo **PMO/PM/PO/SM 3h; Tech
   Lead/Dev 1h30**. Todos os valores ficam em **constantes parametrizáveis**
   (`src/config/meetingFlags.ts` → `MEETING_PRICING`, `ROLE_QUOTA_MINUTES`).
2. **Nova reunião** ✅ **Tela dedicada** (mockup `renderNew`) — mockup é a fonte
   de verdade (já validado/aprovado). O modal atual de colar é absorvido.
3. **Card de horas no Início** ✅ **Completo** — integrar como **widget** no board
   da Início (react-grid-layout), além do velocímetro no topo da lista.
4. **Retenção/arquivar** ✅ **Completo** — `archived_at` (sai da lista) **+ purga
   automática de 30 dias** via job agendado no Supabase (`pg_cron` + função
   `purge_archived_meetings()`; a extensão pg_cron é habilitada pelo @devops).

---

## 11. Plano de implementação & entrega

| Onda | Conteúdo | Entregável |
|------|----------|-----------|
| **0** | `meetingFlags.ts` + migrations (todas as tabelas §5) | SQL para rodar no Supabase + flags |
| **1** | Data-layer §6 (todos os módulos, com flag-off) | arquivos `db/*.ts` |
| **2** | Onda A (Notas, Compartilhamento, Ajuda) — **funciona já** | telas |
| **3** | Onda B parte 1 (cota: velocímetro, solicitar/aprovar, Gestão do módulo) | telas (flag off) |
| **4** | Onda B parte 2 (gravação, player, Nova reunião com fontes, Chat) | telas (flag off) |
| **5** | Contratar horas + Notificações + Início widget | telas (flag off) |
| **6** | `npm run build` verde + revisão + entrega git-direto | tudo |

Entrega sempre pela **rota git-direto** (arquivos prontos p/ colar + caminhos +
links de edição no GitHub). `npm run build` deve passar a cada onda.

---

## 12. Riscos / notas

- **Build já estava quebrado** antes desta fase: `Header.tsx` tinha `type View`
  sem `'meetings'` (corrigido no polimento). Manter o `build` como rede de segurança.
- **git-LFS**: o repo tem um PNG que dá 404 no LFS; clonar com
  `GIT_LFS_SKIP_SMUDGE=1` para evitar falha de checkout.
- **Cota em minutos** (não horas-float) para consistência.
- Sem RLS até o `rls_lockdown.sql` global; toda tabela nova entra sem RLS e o
  front envia/filtra `tenant_id`.
