# Hall da Fama · Agência NP

Portal oficial do **Hall da Fama da Agência NP** para criadores de TikTok LIVE: cupons do ciclo, ranking, comparação, sorteios e viagens, participação/PIP e presentes de 5.000 moedas. Pensado primeiro para o celular (inclusive o navegador interno do WhatsApp), com navegação lateral no computador.

```
Planilha Google (somente leitura) ──► Sincronizador (GitHub Actions, conta de serviço)
                                              │  valida, gera nova versão e ativa numa transação
                                              ▼
                                Supabase Postgres + RLS  ◄── login por código no e-mail (Supabase Auth)
                                              ▲
             GitHub Pages (React + Vite, rotas em hash) ── lê só o que a sessão pode ver
```

- **Frontend**: React 19 + TypeScript + Vite, rotas `#/…` (recarregar e abrir links diretos funcionam no Pages).
- **Dados**: Supabase Postgres com Row Level Security. Atualizar a planilha **não exige novo deploy**.
- **Sincronizador**: `sync/` (Node), roda manual ou agendado no GitHub Actions.
- **Modo demonstração**: dados 100% fictícios, gerados pelo mesmo pipeline do sincronizador.

---

## 1. Rodar localmente (sem credenciais)

> **Atenção:** o `index.html` da raiz é o arquivo-fonte. Abrir ele com dois cliques mostra uma **tela preta**: ele precisa ser montado pelo Vite (`npm run dev:demo`) ou publicado no GitHub Pages.
> Para só **olhar a demonstração** sem instalar nada, gere `npm run build:demo-file` e abra o `demo-hall-da-fama.html` com dois cliques.

Requisitos: Node 20+ (recomendado 22).

```bash
npm ci
npm run dev:demo        # http://localhost:5173 — escolha uma conta fictícia
npm run typecheck
npm test                # domínio, sincronizador, RLS em Postgres real (PGlite) e telas
npm run sync -- --fixture --dry-run   # pipeline completo com a planilha fictícia
```

Contas fictícias úteis para conferir cada caso:

| Conta | O que mostra |
|---|---|
| `@luna.demo` | Ativa, empate no ranking (4º), presente “Disponível”, duplicidade no registro (aviso) |
| `@gabi.demo` | **PIP em aberto e apta ao sorteio**, cupom de entrada, metas em novembro |
| `@bia.demo` | PIP sem cupons no ciclo, previsão de presente **com data exata** registrada |
| `@rafa.demo` | Entrada em novembro: **aguardando fechamento**, reconvite para o grupo |
| `@vic.demo` | **Reentrada**: histórico de presentes em dois vínculos |
| `@caio.demo` | **Entrega atrasada** (renovação de set. entregue em out. → próxima em jan.) |
| `@joao.demo` | Boas-vindas ainda pendente (“Ainda sem entrega registrada”) |

O modo demonstração mostra uma faixa “Modo demonstração · dados fictícios” e todas as contas veem a página de administração com dados fictícios.

---

## 2. Passos manuais inevitáveis (produção)

Siga na ordem. Cada passo tem um **como verificar**.

### 2.1 Supabase

1. Crie um projeto em [supabase.com](https://supabase.com) (região São Paulo recomendada).
2. Aplique as migrações de `supabase/migrations/` em ordem:
   - Com a CLI: `npx supabase link --project-ref SEU_REF` e `npx supabase db push`; **ou**
   - No painel: **SQL Editor** → cole e rode cada arquivo, na ordem do nome.
3. **Authentication → Sign In / Providers → Email**: deixe Email ativo e **desative “Allow new users to sign up”** (só convidados entram).
4. **Authentication → Email Templates → Magic Link**: inclua o código no corpo, por exemplo:
   ```html
   <h2>Seu código do Hall da Fama NP</h2>
   <p>Digite este código no portal: <strong>{{ .Token }}</strong></p>
   <p>Ele vale por 15 minutos.</p>
   ```
   O login usa **código de 6 dígitos**, que funciona em qualquer navegador, inclusive dentro do WhatsApp (link mágico costuma abrir em outro navegador e perder a sessão).
5. **Authentication → URL Configuration**: `Site URL` = `https://SEU-USUARIO.github.io/NOME-DO-REPO/`. Adicione o mesmo endereço em *Redirect URLs* (e `http://localhost:5173/` para testes).
6. **Recomendado**: configure SMTP próprio (Authentication → SMTP), porque o SMTP padrão do Supabase tem limite baixo de envios por hora.
7. Anote em **Project Settings → API Keys**: a URL do projeto, a **publishable key** (`sb_publishable_…`, vai para o frontend) e a **secret key** (`sb_secret_…`, só para o sincronizador e scripts da equipe).

**Verificar:** no SQL Editor, `select * from public.get_ranking('2026-T4');` deve falhar com *Sem acesso ao ranking* (você está sem vínculo) — isso confirma que a proteção está ativa.

### 2.2 Conta de serviço do Google (leitura da planilha)

1. No [Google Cloud Console](https://console.cloud.google.com/): crie um projeto → **APIs e serviços → Ativar APIs** → ative **Google Sheets API**.
2. **IAM e administrador → Contas de serviço → Criar**. Sem papéis no projeto. Em *Chaves*, crie uma chave **JSON** e guarde o arquivo com cuidado.
3. Na planilha **Hall da Fama — Controle de status, PIP e sorteios**: **Compartilhar** com o e-mail da conta de serviço (`…@….iam.gserviceaccount.com`) como **Leitor**. Faça o mesmo com a planilha auxiliar (seção 5), se usar.
4. O ID da planilha é o trecho entre `/d/` e `/edit` na URL.

**Verificar:** rode localmente `npm run sync:dry` com as variáveis da seção 2.4 num arquivo `.env` carregado no terminal. Deve imprimir contagens e “a carga seria aceita”.

> ⚠️ **Coluna de IDs como texto**: formate a coluna de ID (Formatar → Número → Texto simples) em todas as abas. IDs longos guardados como número perdem dígitos; o sincronizador **recusa** IDs em notação científica.

### 2.3 GitHub

1. Crie o repositório e envie este código para a branch `main`.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. **Settings → Secrets and variables → Actions**:
   - Aba **Variables** (valores publicáveis):
     - `VITE_SUPABASE_URL` = URL do projeto
     - `VITE_SUPABASE_PUBLISHABLE_KEY` = publishable key
     - `VITE_DATA_MODE` = `supabase` (ou `demo` para publicar só a demonstração)
   - Aba **Secrets** (nunca vão para o site):
     - `SUPABASE_URL`, `SUPABASE_SECRET_KEY`
     - `GOOGLE_SERVICE_ACCOUNT_JSON` = conteúdo inteiro do arquivo JSON da conta de serviço
     - `HALL_SPREADSHEET_ID`
     - `PORTAL_AUX_SPREADSHEET_ID` (opcional)
4. Rode **Actions → Sincronizar planilha → Supabase → Run workflow** (primeiro com *Somente validar* marcado).
5. Faça um push na `main` (ou rode **CI e deploy** manualmente).

**Verificar:** o workflow de deploy mostra a URL do Pages; o passo “Verificar bundle público” deve passar. O workflow de sincronização deve terminar com “Nova versão ativada”.

### 2.4 Variáveis de ambiente

Veja `.env.example`. Só as que começam com `VITE_` vão para o navegador, e são todas publicáveis. A chave secreta do Supabase e a credencial do Google **não** podem ter prefixo `VITE_`.

---

## 2.5 Vídeos da página inicial

A página inicial tem dois botões em destaque, **“Aprenda a usar o painel”** e **“O que é o Hall da Fama?”**, que abrem uma página de vídeo horizontal (16:9). Sem link configurado, aparece “Vídeo em breve”.

Para colocar os vídeos (sem mexer no código):

1. Suba o vídeo no YouTube (pode ser **Não listado**), Vimeo ou Google Drive (compartilhado como “Qualquer pessoa com o link”).
2. No GitHub: **Settings → Secrets and variables → Actions → Variables** → crie:
   - `VITE_VIDEO_PAINEL_URL` = link do vídeo “Como usar o painel”
   - `VITE_VIDEO_HALL_URL` = link do vídeo “O que é o Hall da Fama”
3. Em **Actions → CI e deploy → Run workflow**, publique de novo.

Também aceita um arquivo `.mp4` colocado em `public/videos/` (link `./videos/nome.mp4`), mas o YouTube costuma carregar melhor no celular. Títulos e textos dos botões ficam em `src/config/videos.ts`.

**Verificar:** abra o portal, toque no botão e confira se o vídeo toca e se a tela cheia funciona no celular.

## 3. Acesso dos criadores

O acesso vem **da sessão e do vínculo oficial da conta**, criado pela agência no servidor. Digitar um @ no portal serve apenas para buscar no ranking.

Os comandos abaixo rodam no computador da equipe, com `SUPABASE_URL` e `SUPABASE_SECRET_KEY` definidos no terminal:

| Situação | Comando |
|---|---|
| Primeiro convite | `npm run admin:link -- convidar email@criador.com 7234567890123456789` |
| Corrigir cadastro (ID errado ou novo e-mail) | `npm run admin:link -- corrigir email@criador.com ID_CORRETO` |
| Saída/eliminação: manter só o histórico próprio | `npm run admin:link -- historico email@criador.com` |
| Revogar todo acesso | `npm run admin:link -- revogar email@criador.com` |
| Dar acesso de equipe (página Administração) | `npm run admin:link -- equipe email@equipe.com` |
| Listar vínculos | `npm run admin:link -- listar` |

Depois do convite, envie ao criador o link do portal: ele digita o e-mail, recebe o código e entra.

**Teste no celular (faça uma vez):** abra o link do portal pelo WhatsApp → digite o e-mail → copie o código do e-mail → volte ao WhatsApp e cole. Repita no Chrome/Safari. Recarregue a página numa rota interna (ex.: `…/#/cupons/ranking`) para conferir que a sessão e o link direto funcionam.

---

## 4. Como os dados fluem e o que é protegido

### Permissões (RLS)

| Quem | Pode ler |
|---|---|
| Sem sessão | Só a tela de acesso e a marca |
| Criador com vínculo ativo | Seu perfil, cupons, PIP e presentes; ranking (via função); calendário e resultados **publicados** |
| Conta antiga (`historico`) | Só os próprios dados; **sem** ranking |
| Conta autenticada sem vínculo | Nada |
| Equipe | Status da sincronização e erros de validação. **Não** lê dados pessoais dos criadores |

- O ranking é lido apenas pela função `get_ranking(ciclo)`, que devolve **somente** posição, @, cupons e “é você”. A tabela do ranking não é legível diretamente.
- Ninguém consegue alterar dados pela API; só o sincronizador (chave secreta) grava.
- Testes em `tests/db/rls.test.ts` rodam as **mesmas migrações** num Postgres real (PGlite) e tentam ler dados de outra pessoa alterando o ID da consulta.

### Sincronização

- Lê apenas as colunas necessárias, com `FORMATTED_VALUE` (IDs como texto, valores já calculados pelas fórmulas).
- **Não lê**: `Hall da Fama!I` (contato), `Registro de entregas!G` (comprovante), `PIP!D:F` (diamantes, horas e dias individuais), Sheet1, LT e Como usar.
- Valida cabeçalhos, tipos, datas, IDs duplicados e relações. **Erros recusam a carga** e a última versão válida continua no ar; **avisos** aparecem na página Administração.
- Grava uma **nova versão** (snapshot) e ativa tudo numa transação. Se nada mudou (mesmo hash), não cria versão. Execuções simultâneas são bloqueadas no GitHub e no banco.
- Guarda as 3 últimas versões válidas. Logs mostram só contagens e células, nunca IDs, nomes ou valores.
- Se a sincronização parar por mais de 36 horas, o portal avisa que os dados podem estar defasados.

---

## 5. Planilha auxiliar privada (calendário, resultados, previsões)

Para publicar datas sem mexer no código, crie **uma planilha Google privada** com as abas abaixo (nomes exatos, cabeçalhos na linha 1), compartilhe com a conta de serviço como Leitor e configure `PORTAL_AUX_SPREADSHEET_ID`. Modelos com linhas fictícias em `templates/planilha-auxiliar/*.csv` (Arquivo → Importar → Inserir nova página).

Todas as abas são **opcionais**. Datas no formato `dd/mm/aaaa`. Meses como `01/mm/aaaa`, `jan/2027` ou `2027-01`.

### `Calendário do portal`

| Coluna | Uso |
|---|---|
| `id` | Identificador estável (ex.: `sorteio-2026-t4`) |
| `tipo` | `sorteio`, `resultado` ou `viagem` |
| `titulo` | Texto exibido |
| `ciclo` | `2026-T4` (Out–Dez 2026), `2027-T1` (Jan–Mar)… |
| `mes_previsto` | Mês previsto. **O dia é ignorado** (01 = referência de mês) |
| `data_confirmada` | Preencha só quando a agência confirmar o dia. Ativa o contador “Faltam X dias” |
| `horario` | `HH:MM`, só se divulgado (o portal nunca inventa horário) |
| `status` | `previsto`, `confirmado`, `remarcado`, `realizado`, `aguardando_divulgacao`, `cancelado` |
| `inicio_viagem`, `fim_viagem` | Datas da viagem |
| `destino` | Só quando confirmado |
| `detalhes` | Texto curto |
| `link_oficial` | URL `https://` opcional |
| `data_anterior` | Em remarcação, a data antiga (exibida como “Antes: …”) |
| `imagem_url` | URL `https://` de imagem **autorizada** do destino |
| `published` | `sim` para aparecer no portal. Qualquer outro valor mantém oculto |

**Remarcar um sorteio:** coloque a data antiga em `data_anterior`, a nova em `data_confirmada` e `status = remarcado`.
**Depois do sorteio:** `status = realizado` e publique o resultado na aba abaixo. Enquanto não houver resultado publicado, o portal mostra “Aguardando resultado”.

### `Resultados do portal`

`id`, `ciclo`, `titulo`, `data_sorteio`, `data_divulgacao`, `ganhadores` (`@a; @b; @c`), `observacoes`, `link_oficial`, `published`.

### `Previsões de presentes`

`id_criador` (texto), `entrada_vinculo`, `referencia` (igual à coluna D da aba Presentes), `data_prevista`. Associação por **ID + entrada + referência**. Sem linha aqui, o portal mostra “Previsão: fevereiro de 2027 · dia a confirmar”.

### `Ciclos do portal`

`ciclo`, `estado` (`parcial`, `em_validacao`, `validado`, `arquivado`), `publicar_faixas` (`sim`/`não`). Use `validado` depois da conferência final: o ranking passa a usar **Cupons aptos ao sorteio**. A faixa numérica só aparece com `validado` **e** `publicar_faixas = sim`.

---

## 6. Mapa de campos da planilha principal

Definido em `sync/sheet-map.ts`. O cabeçalho é conferido por palavra-chave: se a planilha mudar de layout, a carga é recusada com a célula exata no relatório.

| Aba | Colunas lidas | Vai para |
|---|---|---|
| Configurações | B4 início, B5 mês em análise, B6 mês do sorteio, B28 último mês completo | Estado do programa |
| Meses | A mês, H liberado | Quais meses estão fechados |
| Hall da Fama | A ID, B criador, C entrada vigente, D status do mês, E diamantes do mês anterior (**só conferência das faixas, não é exportado**), F cupons do mês, G cupons do ciclo, H próximo sorteio, J convite/aviso | Perfil, status, reconvite |
| Sorteios | A:I | Saldo do ciclo selecionado, participação, cupons aptos, faixa |
| PIP | A, B, C mês de recuperação, G resultado | Status, mês das metas, resultado |
| Presentes | A:J | Próximo presente (resultado da fórmula ativa) |
| Registro de entregas | A ID, B entrada do vínculo, C referência, D **data real**, E criador, F moedas | Histórico de presentes |
| Histórico | Meses na linha 5, campos na linha 7, blocos de 12 colunas; usa “Vínculo/Entrada”, “Status”, “Cupons do mês”, “Cupons acumulados” | Extrato mensal, ciclos anteriores |

**Pontos para validar com a agência antes da primeira carga real** (o sincronizador sinaliza divergências como aviso):

1. Linha do cabeçalho de cada aba (padrão: linha 1; ajuste `headerRow` em `sync/sheet-map.ts`).
2. `Hall da Fama!D` (“status do mês”) refere-se ao **último mês fechado**.
3. `Presentes!D` (referência a entregar): quando contém um mês (`fev/2027`), ele vira a previsão; quando é “Boas-vindas”, a previsão é o mês de entrada; senão, usa `H` (próxima renovação).
4. Nomes exatos dos campos no `Histórico` (linha 7).
5. Corte do ciclo na aba `Sorteios` antes de arquivar um ciclo.

---

## 7. Regras implementadas

| Regra | Onde |
|---|---|
| Faixas: <500 mil = 0; 500 mil = 1; 1 mi = 2; 1,5 mi = 3; 2 mi+ = 4 | `src/domain/coupons.ts` (o portal exibe sempre o valor da planilha; a função serve para explicação e conferência) |
| Ciclos Out–Dez → jan, Jan–Mar → abr, Abr–Jun → jul, Jul–Set → out | `src/domain/cycles.ts` |
| Empate: mesma posição (1, 1, 3), ordem alfabética dentro do empate | `src/domain/ranking.ts` |
| Busca por @ sem diferenciar maiúsculas/acentos, com ou sem @ | `src/domain/ranking.ts` |
| “Hoje” em America/Sao_Paulo; mês sem dia nunca gera contador | `src/domain/dates.ts`, `calendar.ts` |
| Renovação de presente no 3º mês após a entrega real | `src/domain/gifts.ts` (conferência; produção usa a fórmula) |
| Fechamento pendente preserva o último status confirmado | `src/domain/status.ts` |
| Cupons aptos só contam com participação “Apto” | `sync/build.ts` |

---

## 8. Identidade visual

Tokens centralizados no topo de `src/styles.css` (`--np-bg`, `--np-surface`, `--np-brand`, `--np-violet`, `--np-pink`, `--np-text`, `--np-text-2`). Quando o kit oficial chegar, troque só esses valores. Logo em `src/assets/logo-np.png`. Fontes Archivo Black (títulos e números) e Inter, servidas pelo próprio site.

Acessibilidade: foco visível rosa, alvos de toque de 44–56 px, estados com ícone + texto (nunca só cor), contraste AA, `prefers-reduced-motion` respeitado, link “Pular para o conteúdo”.

---

## 9. Estrutura

```
src/
  domain/        regras puras (datas, ciclos, cupons, ranking, calendário, presentes, status)
  data/          contrato de dados, adaptadores Supabase e demonstração
  app/           autenticação, carregamento, navegação (Shell)
  pages/         Início, Cupons (meus/ranking/comparar), Sorteios, Conta, PIP, Presentes, Regulamento, Admin
  ui/            componentes visuais
sync/            sincronizador (mapa da planilha, leitura, validação, gravação, planilha fictícia)
supabase/        migrações SQL (esquema, RLS, funções do sincronizador)
scripts/         gerar dados demo, verificar bundle, gestão de acesso
templates/       modelos CSV da planilha auxiliar
tests/           domínio, sincronizador, RLS (PGlite), telas
.github/workflows  deploy no Pages e sincronização agendada
```

## 10. Manutenção rápida

- **Planilha mudou**: rode o workflow de sincronização com *Somente validar*. Corrija o que aparecer como erro.
- **Dados fictícios**: depois de alterar `sync/fixtures/sample-workbook.ts`, rode `npx tsx scripts/gen-demo.ts` (há teste que avisa se esquecer).
- **Sincronização falhou**: o portal continua com a última versão válida. Veja Administração no portal ou o log do Actions.
