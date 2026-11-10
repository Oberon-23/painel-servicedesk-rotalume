import { T } from '../dados';
import { fN } from '../kit/formato';
import { Card } from '../kit/ui';

export default function Sobre() {
  return (
    <>
      <div className="grade g2">
        <Card titulo="A empresa e os dados">
          <div className="prosa">
            <p>O <b>Grupo Rotalume</b> é fictício, com cerca de 1.200 colaboradores. Este painel mostra o <b>Service Desk interno de TI</b>, a equipe que atende os funcionários com acessos, computadores, rede e sistemas.</p>
            <p>Os dados são gerados no navegador com semente fixa: <b>{fN(T.length)}</b> chamados de nov/2025 a out/2026, com prioridade, canal, equipe, analista, prazos, pesquisa de satisfação e comentários.</p>
            <p>Eventos colocados de propósito para a análise encontrar:</p>
            <ul>
              <li><b>Migração de e-mail (mar/2026):</b> chamados de e-mail mais que dobram e a satisfação cai.</li>
              <li><b>Portal de autoatendimento (jun/2026):</b> o portal ganha espaço e os chamados de senha diminuem.</li>
              <li><b>Queda da VPN (14/07/2026):</b> 64 chamados de prioridade alta em uma manhã.</li>
              <li><b>Sistemas corporativos:</b> pior cumprimento de prazo e chamados parados há semanas.</li>
            </ul>
          </div>
        </Card>
        <Card titulo="Prazos e metas">
          <div className="prosa">
            <ul>
              <li><b>Prazo de resposta:</b> P1 15 min · P2 30 min · P3 1 h · P4 4 h</li>
              <li><b>Prazo de resolução:</b> P1 4 h · P2 8 h · P3 24 h · P4 72 h (horas corridas, por simplificação)</li>
              <li><b>Metas:</b> resolução no prazo ≥ 90% · satisfação ≥ 4,3 · reabertura ≤ 6%</li>
            </ul>
            <p>As definições seguem as práticas de Gestão de Incidentes e Central de Serviço do ITIL 4.</p>
            <p><b>Como foi construído:</b> React + TypeScript com Vite, gráficos em Recharts com as cores do tema, filtros salvos no navegador e identidade visual compartilhada com os outros painéis da Rotalume. O assistente responde com regras calculadas no próprio navegador, sem serviços externos.</p>
          </div>
        </Card>
      </div>
      <Card titulo="Como cada indicador é calculado">
        <div className="defs">
          <div className="def"><b>SLA de resposta</b><code>1º contato no prazo ÷ chamados</code><span>Mede se o usuário foi atendido rápido.</span></div>
          <div className="def"><b>SLA de resolução</b><code>resolvidos no prazo ÷ resolvidos</code><span>Mede se o problema foi resolvido a tempo.</span></div>
          <div className="def"><b>Tempo para resolver</b><code>mediana (solução − abertura)</code><span>A mediana não é distorcida por poucos chamados muito longos.</span></div>
          <div className="def"><b>FCR</b><code>resolvidos pelo N1 sem escalar ÷ chamados</code><span>Resolução no primeiro contato.</span></div>
          <div className="def"><b>Reabertura</b><code>reabertos pelo usuário ÷ resolvidos</code><span>Chamados encerrados sem resolver de fato.</span></div>
          <div className="def"><b>CSAT</b><code>média das notas de 1 a 5</code><span>Pesquisa enviada após o atendimento.</span></div>
          <div className="def"><b>Prazo consumido</b><code>tempo aberto ÷ prazo de resolução</code><span>Acima de 100%, o chamado está vencido.</span></div>
          <div className="def"><b>Transferências</b><code>mudanças de equipe ou analista ÷ chamados</code><span>Muitas transferências indicam triagem difícil.</span></div>
        </div>
      </Card>
    </>
  );
}
