## Ordem proposta (do mais simples/impactante ao mais complexo)

Vou implementar em **fases**, na ordem que você pediu. Cada fase pode ser entregue independentemente — se algo demorar muito, você ainda fica com as anteriores prontas.

---

### Fase 1 — Tamanho de fonte ajustável 🔤
- Botão **A− / A / A+** no canto superior do app (visível em todas as telas do aluno e nas contas de divisão).
- Salva preferência no `localStorage` (não precisa logar de novo).
- Aplica via CSS variable em `:root` no `styles.css`.

### Fase 2 — Segurança no cadastro/recuperação 🔐
- **No cadastro (primeiro acesso e visitante):** além do ano de nascimento, perguntar:
  - **Cor preferida** (lista fixa: vermelho, azul, verde, amarelo, rosa, roxo, laranja, preto, branco, marrom)
  - **Componente curricular preferido** (lista fixa: Matemática, Português, Ciências, História, Geografia, Artes, Ed. Física, Inglês)
- **Na recuperação de senha:** o aluno responde **as 3 perguntas** (ano de nascimento, cor, componente). Só libera reset se acertar **as 3**.
- Migration: adicionar colunas `favorite_color` e `favorite_subject` na tabela `students`.
- Atualizar `src/lib/api.ts` (`createVisitor`, `setStudentPassword`) e `src/routes/aluno.tsx`.

### Fase 3 — Tema amazônico personalizável 🌳
- 4 temas visuais à escolha no painel do aluno (após login):
  - **Floresta** (verdes + onça)
  - **Rio** (azuis + boto)
  - **Indígena/Quilombola** (grafismos terracota)
  - **Ribeirinho** (canoa, pôr-do-sol no rio)
- Cada tema troca tokens de cor + um banner ilustrado no topo.
- Imagens geradas com `imagegen` (estilo ilustração infantil).
- Salva preferência por aluno no banco (coluna `theme`).

### Fase 4 — Alertas de inatividade ⚠️
- No painel do professor, seção **"⚠️ Alunos inativos (3+ semanas)"**.
- Lista alunos cuja última sessão foi há ≥21 dias (ou nunca jogaram).
- Ordenado por tempo de inatividade.

### Fase 5 — Desafio da semana 🏆
- Sequência fixa de 10 problemas (gerada a partir do número da semana ISO, igual pra todos os alunos da semana).
- Após concluir: ganha **selo da semana** (ex.: "Semana 23/2026 ⭐").
- **Streak semanal**: contador de semanas consecutivas em que completou o desafio.
- Botão grande **"Desafio da Semana"** na tela inicial do aluno.
- Migration: tabela `weekly_challenges` (student_id, year, week, completed_at, correct).

### Fase 6 — Revisão inteligente 🧠
- Nova atividade que sorteia problemas com base nas **tabuadas/divisões mais erradas** do aluno (consulta `attempts`).
- Botão "Revisão Inteligente" no menu de escolher atividade.

### Fase 7 — Modo professor ao vivo 📡
- **MAIS COMPLEXO.** Requer realtime do Supabase:
  - Professor cria uma sessão com **código de 4 dígitos**.
  - Alunos entram com o código.
  - Professor escolhe a tabuada e dispara perguntas.
  - Cada resposta dos alunos aparece em tempo real no painel.
- Migration: tabelas `live_sessions` e `live_responses` + habilitar realtime.
- **Aviso:** é a feature que mais exige tempo e testes; pode ficar por último.

---

## Como vou proceder

Vou **começar pela Fase 1 e ir entregando uma fase de cada vez**, te avisando ao fim de cada uma. Assim você pode testar e mandar ajustes incrementais. Se quiser pular alguma fase ou mudar prioridade, é só falar.

Posso começar?