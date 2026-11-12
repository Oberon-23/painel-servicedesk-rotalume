# Painel de Service Desk — Grupo Rotalume

[![CI](https://github.com/Oberon-23/painel-servicedesk-rotalume/actions/workflows/ci.yml/badge.svg)](https://github.com/Oberon-23/painel-servicedesk-rotalume/actions/workflows/ci.yml)

> Dashboard interativo do Service Desk interno de TI de uma empresa **fictícia** (Grupo Rotalume), em React + TypeScript, sem backend. Acompanha prazos (SLA), fila, desempenho da equipe e satisfação dos usuários, e traz um assistente que responde perguntas comuns com os próprios dados do painel.

**[Abrir o painel →](https://painel-servicedesk-rotalume.vercel.app)**

## Em 30 segundos

- **Problema:** a coordenação de um service desk precisa ver, no mesmo lugar, o prazo dos chamados, quem está esperando agora e se a escala acompanha a demanda.
- **O que fiz:** um painel de SLA, fila, equipe e satisfação, com uma tela de operação ao vivo e um assistente que responde perguntas comuns usando os próprios dados do painel.
- **O que ele mostra:** 78,7% dos chamados resolvidos no prazo, abaixo da meta de 90%, com Sistemas Corporativos como o maior problema (44,5% no prazo).

![Demonstração: visão geral, operação ao vivo e fila de chamados](docs/img/demo.gif)

## O que o painel responde

- Os chamados estão sendo atendidos e resolvidos no prazo?
- Quantas pessoas estão esperando agora no telefone e no chat, de qual unidade, e há quanto tempo?
- Quem da equipe está disponível, em atendimento ou em pausa, e alguma pausa passou do previsto?
- A escala acompanha a demanda ao longo do dia?
- O que está na fila de chamados, há quanto tempo, e o que vence primeiro?
- Em que horários os chamados chegam, para montar a escala da equipe?
- Como cada analista está em rapidez, reabertura e satisfação?
- Do que os usuários mais reclamam, e qual ação atacar primeiro?

![Operação ao vivo](docs/img/servicedesk_aovivo.png)

## Operação ao vivo

A tela **Ao vivo** simula um dia útil da central do N1, minuto a minuto, com uma linha do tempo e um botão para reproduzir o dia:

- **Fila agora** por canal e por unidade de origem, com a maior espera e os próximos a serem atendidos.
- **Estado de cada analista** (disponível, em atendimento, pausa curta, almoço, treinamento) e alerta quando a pausa passa do previsto.
- **Nível de serviço, abandono, TME e TMA** do dia até o horário escolhido.
- **Dimensionamento com Erlang C:** analistas necessários por meia hora para atender 80% em até 60 s, comparados com a escala.
- Uma instabilidade no ERP às 11h15 mostra a fila crescendo e de onde vêm as ligações.

A simulação tem testes automáticos (`npm test`) para o Erlang C e para regras como "nenhum analista atende dois contatos ao mesmo tempo".

![Fila e prazos](docs/img/servicedesk_fila.png)

## Por que essas escolhas

- **Gestão de central em tempo real**: nível de serviço 80/60, abandono, TME, TMA e aderência da escala, os mesmos indicadores que um supervisor acompanha no painel da central telefônica.
- **Métricas de ITSM (ITIL 4)**: SLA de resposta e de resolução por prioridade, FCR (resolução no primeiro contato), reabertura e CSAT. É o vocabulário de qualquer central de serviço.
- **Mediana em vez de média no tempo de resolução**: poucos chamados parados por semanas distorcem a média; a mediana mostra o tempo típico.
- **Fila com "prazo consumido"**: em vez de só contar abertos, cada chamado mostra quanto do prazo já gastou, para agir antes de vencer.
- **Comentários agrupados em temas com ação sugerida**: transforma a pesquisa de satisfação em um plano de melhoria, não só em uma nota.
- **Assistente sem serviços externos**: as respostas são calculadas no navegador a partir dos mesmos dados dos gráficos. Não há chave de API no código e nenhum número é inventado.
- **Eventos simulados** (migração de e-mail, portal de autoatendimento, queda da VPN): testam se os indicadores mostram mudanças reais de processo, não só ruído.
- **React + TypeScript com dados gerados no navegador** (semente fixa, reprodutível), publicado como site estático. Cada tela abre com uma manchete que diz o resultado em uma frase, antes dos gráficos.

![Satisfação do usuário](docs/img/servicedesk_satisfacao.png)

## Dados

Todos os dados são fictícios, gerados no navegador ao carregar a página. Os eventos simulados e as fórmulas estão na aba **"Sobre os dados"** do próprio painel.

## Deploy

Aplicação estática feita com Vite. Na Vercel, basta importar o repositório: o framework é detectado sozinho (build `npm run build`, saída `dist/`). O `vercel.json` redireciona as rotas para o `index.html`, então links diretos como `/fila` funcionam.

**Localmente:**
```bash
npm install
npm run dev       # desenvolvimento
npm run build     # gera dist/
npm test          # testes dos cálculos
```

A versão anterior, em HTML puro com Chart.js e assistente ligado ao Claude, está preservada em `legado.html`.

## Stack

React 19 + TypeScript, Vite, React Router, [Recharts](https://recharts.org/) e ícones Lucide. O tema claro/escuro usa variáveis CSS e os gráficos leem as mesmas cores, então mudam junto com o tema. Os filtros ficam salvos no navegador. A identidade visual é compartilhada com os outros painéis da Rotalume.
