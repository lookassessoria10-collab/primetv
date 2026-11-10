# Prime TV

Plataforma de Digital Signage da **Prime Esthetics · Estética Avançada**: apresentação contínua para as TVs das unidades e painel administrativo para gerenciar imagens, peças, campanhas, unidades e programação — sem editar código, abrir o GitHub ou fazer deploy manual.

- **TV (pública):** `https://SEU-DOMINIO/tv/<codigo-da-unidade>` — ex.: `/tv/unidade-centro`
- **Painel (restrito):** `https://SEU-DOMINIO/admin`

---

## 1. Arquitetura

```
                 ┌──────────── Painel (/admin) ─────────────┐
                 │ edição local → "Salvar rascunho"          │
 Administrador ─►│            → "Publicar alterações"        │
                 └───────────────┬───────────────────────────┘
                                 │ API do servidor (token só no servidor)
                                 ▼
        GitHub (repositório privado) — 1 commit por operação (Git Data API)
          data/draft.json   rascunho (não afeta as TVs, não dispara deploy)
          data/store.json   versão publicada
          public/media/**   imagens e vídeos otimizados
          archive/originals/** originais para documentação (nunca públicos)
                                 │ commit em data/store.json
                                 ▼
        Vercel — deploy automático e atômico (a versão antiga segue no ar até a nova ficar pronta)
                                 │
                                 ▼
        TV (/tv/[unidade]) — consulta /api/tv/[unidade] a cada 60 s,
        pré-carrega tudo e troca de versão entre uma peça e outra
```

Decisões principais:

| Tema | Solução |
| --- | --- |
| Persistência sem banco | JSON versionado no GitHub (`data/store.json` publicado, `data/draft.json` rascunho). Camada de acesso em `src/lib/server/storage` (driver GitHub para produção e driver local para desenvolvimento). |
| Gravação | Git Data API: blobs → árvore → **um commit** → atualização do ramo **sem force**. Se outro commit chegar no meio, a operação é refeita sobre o estado novo; se o rascunho foi alterado por outra sessão, a gravação é recusada (HTTP 409) em vez de sobrescrever. |
| Rascunho x publicado | Salvar rascunho grava só `data/draft.json`. Publicar valida tudo, confirma que as mídias existem no repositório e grava `store.json` + `draft.json` no mesmo commit. |
| Deploy | O Vercel faz o deploy a partir do commit de publicação. Commits só de rascunho/mídias são ignorados (`scripts/vercel-ignore.mjs`), economizando builds. |
| Versão publicada | `store.json` é incluído no build: cada deploy serve exatamente a versão do seu commit. A TV detecta a nova versão por `/api/tv/[unidade]` (campo `version`) e `/api/version`. |
| Confirmação | O painel só mostra **Publicado** quando o próprio site já responde com a nova versão. Falhas de deploy informadas pelo Vercel ao GitHub aparecem como **Erro de publicação**. |
| Agenda | Campanhas e itens são avaliados no player, no fuso configurado (padrão `America/Bahia`). Entram e saem sozinhos, sem novo deploy. |
| Player | Mesmo componente na TV e na prévia do painel. Palco fixo 1080×1920 (ou 1920×1080) escalado sem distorção; transições em CSS (opacity, transform, clip-path); pré-carregamento; pula peças com falha; tela de contingência; cache offline via service worker; recarga preventiva periódica. |
| Mídias | Otimizadas no navegador (WebP < 1 MB para fotos; artes com texto preservadas ou WebP de alta qualidade). Abstração `storage: "repo" \| "r2"` pronta para Cloudflare R2. |

Tecnologias: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 (painel) · Motion (animações do painel) · Lucide · Zod.

### Estrutura de pastas

```
data/store.json          programação publicada (lida pela TV)
data/draft.json          rascunho do painel
public/media/            mídias (seed/ = materiais iniciais; AAAA/MM/ = enviados pelo painel)
public/brand/            logotipo provisório (ver “Pendências”)
public/sw.js             service worker das TVs (cache offline)
scripts/                 build-info, seed, hash de senha, testes, simulador do GitHub, ignore do Vercel
src/app/tv/[unit]/       player público
src/app/admin/           painel (login, setup e páginas)
src/app/api/             rotas (TV, versão, painel)
src/components/slides/   modelos visuais das peças (TV e prévia)
src/components/player/   motor de reprodução, cache e recuperação
src/components/admin/    interface do painel
src/lib/                 esquema (Zod), agenda, ciclo, manifesto, validação
src/lib/server/          autenticação, sessão, armazenamento (GitHub/local)
```

---

## 2. Rodar localmente

Requisitos: Node.js 20.9+ (recomendado 22 ou 24).

```bash
npm install
```

Crie `.env.local` a partir de `.env.example`. Para desenvolver sem GitHub use o driver local:

```
STORAGE_DRIVER=local
ADMIN_USER=admin
ADMIN_PASSWORD_HASH=...   # gere com: npm run hash-password
SESSION_SECRET=...        # o mesmo comando gera um valor
```

```bash
npm run dev
```

- Painel: http://localhost:3210/admin
- TV: http://localhost:3210/tv/unidade-centro (acrescente `?debug=1` para ver versão, peça atual e conexão)

No modo local, salvar e publicar gravam diretamente em `data/` e `public/media/`. Para recomeçar a demonstração: `npm run seed:reset` (apaga as alterações locais de `data/`).

Comandos úteis:

| Comando | O que faz |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Desenvolvimento, build de produção e servidor de produção |
| `npm run typecheck` · `npm run lint` · `npm run format` | Tipagem, lint e formatação |
| `npm run hash-password` | Gera `ADMIN_PASSWORD_HASH` e `SESSION_SECRET` |
| `npm run test:smoke` | Teste de ponta a ponta contra um servidor rodando (use em modo local; grava dados) |
| `npm run test:github` | Testa o armazenamento no GitHub contra um simulador local da API (requer `npm run build`) |

---

## 3. Publicar (GitHub + Vercel)

### 3.1 Repositório

1. Crie um repositório **privado** no GitHub (as fotografias clínicas ficam no repositório).
2. Envie o projeto:

   ```bash
   git init
   git add .
   git commit -m "Prime TV"
   git branch -M main
   git remote add origin https://github.com/SUA-CONTA/prime-tv.git
   git push -u origin main
   ```

### 3.2 Token do GitHub (usado só pelo servidor)

GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → *Generate new token*:

- **Repository access:** *Only select repositories* → o repositório da Prime TV.
- **Permissions → Repository permissions:**
  - **Contents:** Read and write
  - **Commit statuses:** Read-only
  - **Deployments:** Read-only
  - (Metadata: Read-only é adicionado automaticamente)
- Defina uma validade e anote a data para renovar.

### 3.3 Vercel

1. Vercel → *Add New → Project* → importe o repositório. Framework: **Next.js** (detectado). Comandos padrão.
2. **Plano:** uso comercial exige o plano **Pro** do Vercel (o Hobby é apenas para uso pessoal/não comercial).
3. Em *Settings → Environment Variables* (ambiente **Production**), cadastre:

| Variável | Valor |
| --- | --- |
| `ADMIN_USER` | usuário do painel |
| `ADMIN_PASSWORD_HASH` | gerado em `/admin/setup` ou `npm run hash-password` |
| `SESSION_SECRET` | gerado junto com o hash (mín. 32 caracteres) |
| `GITHUB_TOKEN` | token do passo 3.2 |
| `GITHUB_OWNER` | usuário ou organização dona do repositório |
| `GITHUB_REPO` | nome do repositório |
| `GITHUB_BRANCH` | `main` (o mesmo ramo de produção do Vercel) |
| `APP_URL` | endereço final, ex. `https://tv.suaclinica.com.br` |

> O briefing citava `GITHUBTOKEN`, `ADMINUSER` etc.; os nomes corretos levam sublinhado, como na tabela.

4. *Deployments* → **Redeploy** para aplicar as variáveis.
5. Abra `https://SEU-DOMINIO/admin/setup` se ainda não tiver o hash da senha (a página calcula tudo no navegador, nada é enviado).
6. Entre em `/admin` → **Configurações → Verificar configuração**: todos os itens devem ficar verdes.
7. (Opcional) Configure um domínio próprio em *Settings → Domains*.

### 3.4 Como uma publicação acontece

1. **Rascunho** — edições ficam no navegador (há cópia de segurança local).
2. **Salvo** — “Salvar rascunho” grava `data/draft.json` (sem deploy, sem efeito nas TVs).
3. **Publicando** — “Publicar alterações” valida, confere as mídias e grava `store.json` + `draft.json` em um único commit; o Vercel inicia o deploy (normalmente 1 a 3 minutos).
4. **Publicado** — o painel confirma quando o site já serve a nova versão. As TVs percebem na verificação seguinte (até ~60 s), baixam todas as mídias novas e trocam de programação **entre uma peça e outra**, sem tela preta.
5. **Erro de publicação** — mensagem real do servidor (validação, conflito, permissão do token ou falha de deploy, com link para o log do Vercel).

---

## 4. Colocar a apresentação na TV

1. Cadastre/ajuste a unidade em **Unidades** (nome, código, orientação, WhatsApp) e **publique**.
2. No navegador da TV (ou do aparelho ligado a ela), abra `https://SEU-DOMINIO/tv/<codigo>`.
3. Coloque em tela cheia (toque/clique uma vez na tela ou use o modo quiosque do aparelho).
4. Recomendações:
   - Prefira um **Android TV box / Google TV / Fire TV** com navegador em modo quiosque (ex.: Fully Kiosk Browser ou Chrome) configurado para abrir a URL ao ligar. Smart TVs com navegador Chromium recente também funcionam.
   - Desative economia de energia, protetor de tela e desligamento automático da TV.
   - Ajuste o formato da imagem para “Ajustar à tela/Just Scan”. Se a TV cortar as bordas, use **Margem de segurança (overscan)** na unidade.
   - TV instalada em pé que não gira a imagem: escolha **Rotação 90°** na unidade.
   - Deixe a primeira abertura acontecer com internet: a partir daí página, scripts, mídias e programação ficam em cache e a TV volta a funcionar mesmo se reiniciar sem conexão.
5. Diagnóstico: `https://SEU-DOMINIO/tv/<codigo>?debug=1` mostra versão, peça atual, status e conexão.

Comportamento automático: loop infinito; pré-carregamento das próximas peças; peças com imagem indisponível são puladas e tentadas de novo depois; sem nenhuma peça exibível, aparece a programação institucional padrão e, por fim, a tela de contingência da marca; a página se recarrega de forma preventiva a cada 6 h (configurável) apenas se o servidor estiver respondendo.

---

## 5. Operação diária (sem terminal)

- **Programação:** escolha a unidade, arraste as miniaturas, ajuste tempo e transição, oculte, duplique, agende ou remova itens. “Espaços de campanha” são preenchidos automaticamente pelas campanhas ativas. Use **Pré-visualizar** para assistir à sequência real (inclusive simulando data e hora).
- **Peças:** crie a partir dos modelos (Arte pronta, Antes e depois, Campanha, Destaque de procedimento, Institucional, Chamada para ação, Vídeo), edite textos e imagens com prévia ao vivo e salve modelos reutilizáveis. Use `*palavra*` para destacar em itálico dourado.
- **Mídias:** arraste vários arquivos; escolha “Fotografia” (otimização) ou “Arte com texto” (preservação). Registre categoria, procedimento e, para fotos de pacientes, a **autorização de uso** — sem “Uso autorizado”, a imagem não vai para a TV. Ajuste o enquadramento clicando no ponto principal da foto. Arquive o que não usa mais.
- **Campanhas:** nome, descrição interna, período (início/fim, dias e horários), unidades, prioridade, peso e peças. Programe com antecedência; elas entram e saem sozinhas.
- **Unidades:** cada unidade tem código (link), orientação, rotação, overscan, WhatsApp (o QR Code é gerado a partir dele), mensagem própria e programação (compartilhada ou exclusiva).
- **Configurações:** marca/logotipo, fuso, tempos padrão, observação sobre resultados, contato geral, tela de contingência e diagnóstico.

---

## 6. Limites e cuidados

- **Tamanho dos envios:** cada arquivo deve ter até 4 MB (limite de requisição do Vercel). Fotos são reduzidas automaticamente; vídeos devem ser curtos (MP4 H.264 ou WebM). Para vídeos maiores ou uma biblioteca muito grande, o próximo passo é o Cloudflare R2 (o modelo de dados já prevê `storage: "r2"`; a URL pública seria configurada em `NEXT_PUBLIC_MEDIA_BASE_URL`).
- **Tempo de publicação:** depende do deploy do Vercel (1–3 min). Rascunhos e envios de mídia não geram deploy.
- **Histórico do Git:** “Excluir definitivamente” remove o arquivo da versão atual, mas o histórico do repositório mantém versões antigas. Se uma autorização for revogada, além de excluir no painel é preciso limpar o histórico (ex.: `git filter-repo`) — por isso o repositório deve ser privado.
- **Acesso:** um administrador central (usuário/senha do Vercel). Tentativas de login são limitadas por IP (melhor esforço por instância).
- **Google Drive:** pode ser usado como arquivo dos originais, mas o player não depende dele.
- **Navegadores de TV:** o player evita recursos CSS recentes e usa alvo `chrome >= 79`; aparelhos muito antigos devem ser substituídos por um TV box.

---

## 7. Conteúdo inicial e pendências

Importados como artes prontas (sem nenhuma alteração nos arquivos): Ultraformer MPT Papada, Ultraformer MPT Pescoço, Preenchimento labial, Microvasos ou PEIM e a peça institucional sobre ocasiões especiais, além das quatro artes da campanha “Esquenta Prime Black Friday”. Dois recortes das fotos de resultado (lábios e pernas) ilustram os destaques de procedimento.

Antes de usar em produção:

1. **Logotipo oficial:** o atual (`public/brand/*.png`) foi extraído das artes de referência. Envie o arquivo oficial em **Configurações → Marca**.
2. **Harmonização de glúteos:** a arte não veio entre os anexos; envie em **Mídias** e inclua na programação.
3. **Autorizações de uso:** os resultados clínicos importados foram marcados como “Uso autorizado” por fazerem parte do material Prime TV fornecido para exibição. Registre a referência de cada termo em **Mídias → Autorização de uso de imagem** (ou altere a situação, se for o caso).
4. **Campanha Black Friday:** está **ativa sem datas**. Defina início e término em **Campanhas** antes de publicar.
5. **Unidades:** “Unidade Centro / unidade-centro” é um exemplo. Ajuste nome, código, endereço e **WhatsApp** (sem número cadastrado, o número e o QR Code ficam ocultos — nada é inventado).
6. As artes de antes e depois de Toxina botulínica, Bioestimulador e as versões alternativas de Preenchimento labial/Microvasos recebidas como referência de identidade **não foram importadas**: aparentam ser imagens ilustrativas, não fotografias reais de pacientes.
