import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Eraser, Send, Sparkles } from 'lucide-react';
import { useFiltro } from '../App';
import { CATS, curOpen, filt, GSHORT, kpi, T, teamRows, THEME_RULES, type Chamado, type Filtro } from '../dados';
import { fH, fN, fP } from '../kit/formato';
import { MONTHS } from '../kit/meses';
import { Card } from '../kit/ui';

const SUGS = ['Quais assuntos mais estouram o prazo?', 'Como está a fila agora?', 'Qual analista precisa de apoio?', 'Por que a satisfação caiu?', 'O portal reduziu os chamados de senha?', 'Faça um resumo executivo'];

type Item = { label: string; valor: ReactNode };
type Resposta = { titulo: ReactNode; itens: Item[]; passo: ReactNode };

function descF(f: Filtro) {
  return `${MONTHS[f.periodo.from].label} a ${MONTHS[f.periodo.to].label} · equipe ${f.group === 'all' ? 'todas' : GSHORT[+f.group]} · ${f.type === 'all' ? 'todos os tipos' : f.type === 'Incidente' ? 'incidentes' : 'requisições'}`;
}

function grupos(rows: Chamado[], fn: (t: Chamado) => string) {
  const m = new Map<string, Chamado[]>();
  rows.forEach((t) => { const x = fn(t); if (!m.has(x)) m.set(x, []); m.get(x)!.push(t); });
  return [...m.entries()].map(([x, r]) => ({ x, k: kpi(r) }));
}

/** Respostas calculadas no navegador para as perguntas mais comuns. */
function responder(q: string, f: Filtro): Resposta {
  const s = q.toLowerCase(), rows = filt(f), k = kpi(rows);
  if (/sla|prazo|venc|atras|estour/.test(s)) {
    const c = grupos(rows, (t) => t.cat).filter((x) => x.k.resolvidos > 30).sort((a, z) => a.k.slaRes - z.k.slaRes);
    return {
      titulo: 'Prazo dos chamados',
      itens: [
        { label: 'Resposta no prazo', valor: <><b>{fP(k.slaResp)}</b> · resolução no prazo <b>{fP(k.slaRes)}</b> (meta 90%)</> },
        ...(c.length ? [{ label: 'Pior assunto', valor: <><b>{c[0].x}</b>, com {fP(c[0].k.slaRes)} resolvidos no prazo</> }, { label: 'Melhor assunto', valor: <><b>{c[c.length - 1].x}</b>, com {fP(c[c.length - 1].k.slaRes)}</> }] : []),
      ],
      passo: c.length ? <>Revisar a fila de {c[0].x} e o acordo de atendimento com a equipe responsável.</> : 'Ampliar o período para ter volume suficiente.',
    };
  }
  if (/fila|backlog|abert|risco/.test(s)) {
    const o = curOpen(f), late = o.filter((t) => t.cons > 1), g = grupos(late, (t) => GSHORT[t.g]).sort((a, z) => z.k.n - a.k.n);
    return {
      titulo: <>Fila agora: {fN(o.length)} chamados abertos</>,
      itens: [
        { label: 'Vencidos', valor: <><b>{fN(late.length)}</b>{g[0] ? <>, a maioria com <b>{g[0].x}</b> ({g[0].k.n})</> : null}</> },
        { label: 'Mais antigo', valor: o.length ? fH(Math.max(...o.map((t) => t.ageH!))) : '—' },
      ],
      passo: <>Conversa rápida com {g[0]?.x ?? 'os grupos'} para redistribuir os vencidos.</>,
    };
  }
  if (/analista|equipe|time|pessoa|apoio/.test(s)) {
    const tr = teamRows(f).filter((x) => x.resp >= 20);
    if (!tr.length) return { titulo: 'Equipe', itens: [{ label: 'Aviso', valor: 'Poucas respostas de pesquisa neste recorte.' }], passo: 'Ampliar o período.' };
    const lo = [...tr].sort((a, z) => a.csat - z.csat)[0], hi = [...tr].sort((a, z) => z.csat - a.csat)[0], re = [...tr].sort((a, z) => z.reab - a.reab)[0];
    return {
      titulo: 'Equipe no recorte',
      itens: [
        { label: 'Maior satisfação', valor: <><b>{hi.nome}</b> ({fN(hi.csat, 2)})</> },
        { label: 'Menor satisfação', valor: <><b>{lo.nome}</b> ({fN(lo.csat, 2)})</> },
        { label: 'Mais reaberturas', valor: <><b>{re.nome}</b> ({fP(re.reab)})</> },
      ],
      passo: <>Acompanhar alguns atendimentos de {re.nome} e reforçar a confirmação com o usuário antes de encerrar.</>,
    };
  }
  if (/csat|satisf|coment|reclam|nota/.test(s)) {
    const neg = rows.filter((t) => t.comment && t.csat! <= 2);
    const th = THEME_RULES.map(([n, re]) => ({ n, q: neg.filter((t) => re.test(t.comment!)).length })).filter((x) => x.q).sort((a, z) => z.q - a.q).slice(0, 3);
    const ms = MONTHS.slice(f.periodo.from, f.periodo.to + 1).map((m) => ({ m, c: kpi(rows.filter((t) => t.m === m.i)).csat })).filter((x) => Number.isFinite(x.c)).sort((a, z) => a.c - z.c);
    return {
      titulo: <>Satisfação: {fN(k.csat, 2)} de 5 ({fP(k.satisf, 0)} satisfeitos)</>,
      itens: [
        ...(ms[0] ? [{ label: 'Pior mês', valor: <><b>{ms[0].m.long}</b> ({fN(ms[0].c, 2)}){ms[0].m.i === 4 ? ', mês da migração de e-mail' : ''}</> }] : []),
        { label: 'Temas das notas 1 e 2', valor: th.length ? th.map((x) => `${x.n} (${x.q})`).join(', ') : 'poucos comentários' },
      ],
      passo: <>Atacar o tema “{th[0]?.n ?? 'demora'}” com uma mudança de processo.</>,
    };
  }
  if (/portal|autoatend|senha|canal/.test(s)) {
    const pre = T.filter((t) => t.m >= 3 && t.m <= 6), pos = T.filter((t) => t.m >= 7 && t.m <= 10);
    const a = pre.filter((t) => t.ci === 0).length / 4, b = pos.filter((t) => t.ci === 0).length / 4;
    return {
      titulo: 'Efeito do portal, lançado em junho de 2026',
      itens: [
        { label: 'Chamados de senha e acesso', valor: <><b>{fN(a)}</b> por mês (fev–mai) → <b>{fN(b)}</b> por mês (jun–set), {fP((b - a) / a)}</> },
        { label: 'Participação do portal', valor: <>{fP(pre.filter((t) => t.canal === 'Portal').length / pre.length)} → <b>{fP(pos.filter((t) => t.canal === 'Portal').length / pos.length)}</b></> },
      ],
      passo: 'Divulgar o portal para quem ainda liga pedindo reset de senha.',
    };
  }
  const c = grupos(rows, (t) => t.cat).filter((x) => x.k.resolvidos > 30).sort((a, z) => a.k.slaRes - z.k.slaRes);
  return {
    titulo: 'Resumo do recorte',
    itens: [
      { label: 'Volume e prazo', valor: <>{fN(k.n)} chamados · <b>{fP(k.slaRes)}</b> resolvidos no prazo · mediana de <b>{fH(k.mttr)}</b></> },
      { label: 'Qualidade', valor: <>1º contato <b>{fP(k.fcr)}</b> · reabertos <b>{fP(k.reab)}</b> · satisfação <b>{fN(k.csat, 2)}</b></> },
      ...(c.length ? [{ label: 'Ponto de atenção', valor: <><b>{c[0].x}</b> ({fP(c[0].k.slaRes)} no prazo)</> }] : []),
    ],
    passo: 'Pergunte sobre prazo, fila, equipe, satisfação ou portal para detalhar.',
  };
}

type Msg = { id: number; quem: 'u' | 'a'; texto?: string; r?: Resposta; recorte?: string };

export default function Assistente() {
  const f = useFiltro();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [txt, setTxt] = useState('');
  const fim = useRef<HTMLDivElement>(null);
  const n = useRef(0);
  useEffect(() => { fim.current?.scrollIntoView({ block: 'nearest' }); }, [msgs]);

  const perguntar = (q: string) => {
    q = q.trim(); if (!q) return;
    setTxt('');
    setMsgs((m) => [...m, { id: ++n.current, quem: 'u', texto: q }, { id: ++n.current, quem: 'a', r: responder(q, f), recorte: descF(f) }]);
  };

  return (
    <div className="grade g-7-5">
      <Card titulo="Pergunte aos dados" sub={`Recorte atual: ${descF(f)}. Mude os filtros no topo para outro recorte.`}
        acoes={msgs.length ? <button type="button" className="btn" onClick={() => setMsgs([])}><Eraser size={15} aria-hidden /> Limpar</button> : undefined}>
        <div className="chat" aria-live="polite">
          <div className="msg a">
            <span className="quem"><Sparkles size={14} aria-hidden /> Assistente</span>
            <p>Olá! Respondo perguntas sobre <b>prazos, fila, equipe, satisfação e canais</b> com os números do painel. Escolha uma sugestão ou escreva a sua pergunta.</p>
          </div>
          {msgs.map((m) => m.quem === 'u'
            ? <div key={m.id} className="msg u">{m.texto}</div>
            : (
              <div key={m.id} className="msg a">
                <span className="quem"><Sparkles size={14} aria-hidden /> Assistente</span>
                <h4>{m.r!.titulo}</h4>
                <ul>{m.r!.itens.map((i, j) => <li key={j}><span className="rot">{i.label}:</span> {i.valor}</li>)}</ul>
                <p className="passo"><b>Próximo passo:</b> {m.r!.passo}</p>
                <span className="fraco">{m.recorte}</span>
              </div>
            ))}
          <div ref={fim} />
        </div>
        <div className="sugs">{SUGS.map((s) => <button key={s} type="button" className="sug" onClick={() => perguntar(s)}>{s}</button>)}</div>
        <form className="pergunta" onSubmit={(e) => { e.preventDefault(); perguntar(txt); }}>
          <input value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Ex.: como está o prazo de Hardware?" aria-label="Sua pergunta" />
          <button type="submit" className="btn prim" disabled={!txt.trim()}><Send size={16} aria-hidden /> Perguntar</button>
        </form>
      </Card>
      <Card titulo="Como o assistente funciona">
        <div className="prosa">
          <p>As respostas são <b>calculadas no navegador</b> a partir dos mesmos dados dos gráficos. O assistente reconhece o assunto da pergunta (prazo, fila, equipe, satisfação, canais) e monta a resposta com os números do recorte escolhido.</p>
          <p>Não há chamada a serviços externos nem chave de API no código. Isso deixa o painel seguro para publicar e garante que nenhum número seja inventado.</p>
          <p>Assuntos reconhecidos:</p>
          <ul>
            <li><b>Prazo:</b> resposta e resolução no prazo, piores e melhores assuntos.</li>
            <li><b>Fila:</b> abertos, vencidos e o chamado mais antigo.</li>
            <li><b>Equipe:</b> maior e menor satisfação e reabertura por analista.</li>
            <li><b>Satisfação:</b> pior mês e temas das notas baixas.</li>
            <li><b>Canais:</b> efeito do portal de autoatendimento.</li>
          </ul>
          <p className="fraco">Assuntos considerados: {CATS.map((c) => c[0]).join(', ')}.</p>
        </div>
      </Card>
    </div>
  );
}
