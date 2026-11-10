/* Base fictícia do Service Desk interno de TI do Grupo Rotalume (nov/2025 a out/2026). */
import { clamp, median, sum } from './kit/formato';
import { MONTHS, monthIdx, type Periodo } from './kit/meses';
import { rng } from './kit/rng';

const R = rng(31102026);
const { r: rnd, n: randn, pickW, pick, poisson } = R;
export const H = 3600000, DAY = 86400000;
const T0 = Date.UTC(2025, 10, 1);
export const HOJE = Date.UTC(2026, 9, 31, 17, 0);

export const GROUPS = ['N1 Service Desk', 'N2 Suporte', 'Suporte em Campo', 'Redes', 'Sistemas'];
export const GSHORT = ['N1', 'N2', 'Campo', 'Redes', 'Sistemas'];
export type Analista = { id: number; nome: string; g: number; speed: number; csat: number; reopen: number };
export const ANALYSTS: Analista[] = ([
  ['Ana Ribeiro', 0, 1.0, 0.1, 0.04], ['Bruno Lima', 0, 0.9, 0.0, 0.05], ['Carla Mendes', 0, 1.1, 0.2, 0.04], ['Diego Souza', 0, 1.0, -0.1, 0.05],
  ['Elisa Prado', 0, 0.85, 0.15, 0.03], ['Fábio Costa', 0, 1.25, -0.35, 0.12], ['Gabriela Nunes', 0, 1.0, 0.05, 0.05], ['Hugo Martins', 0, 0.95, 0.0, 0.05],
  ['Íris Almeida', 1, 1.0, 0.1, 0.05], ['João Pedro Reis', 1, 0.9, 0.0, 0.06], ['Karina Lopes', 1, 1.15, -0.1, 0.06],
  ['Lucas Farias', 2, 1.0, 0.05, 0.05], ['Marina Teles', 2, 0.9, 0.15, 0.04], ['Nelson Araújo', 2, 1.3, -0.25, 0.07],
  ['Otávio Brandão', 3, 1.0, 0.0, 0.05], ['Paula Siqueira', 3, 0.9, 0.1, 0.05],
  ['Rafael Tavares', 4, 1.0, 0.0, 0.06], ['Sabrina Duarte', 4, 1.1, -0.05, 0.06],
] as [string, number, number, number, number][]).map(([nome, g, speed, csat, reopen], id) => ({ id, nome, g, speed, csat, reopen }));
const byGroup = GROUPS.map((_, g) => ANALYSTS.filter((a) => a.g === g));

export type Tipo = 'Incidente' | 'Requisição';
type Cat = [nome: string, peso: number, horas: number, fcr: number, grupo: number, subs: [string, Tipo][]];
export const CATS: Cat[] = [
  ['Acesso e Senha', 0.24, 0.8, 0.86, 1, [['Reset de senha', 'Requisição'], ['Desbloqueio de conta', 'Incidente'], ['Permissão de pasta', 'Requisição'], ['MFA / autenticador', 'Incidente']]],
  ['E-mail e Colaboração', 0.14, 3, 0.6, 1, [['Outlook', 'Incidente'], ['Teams', 'Incidente'], ['Caixa compartilhada', 'Requisição']]],
  ['Hardware', 0.15, 18, 0.18, 2, [['Notebook', 'Incidente'], ['Impressora', 'Incidente'], ['Periféricos', 'Requisição']]],
  ['Software', 0.18, 16, 0.35, 2, [['Instalação de software', 'Requisição'], ['Licença', 'Requisição'], ['Atualização', 'Incidente']]],
  ['Rede e VPN', 0.12, 7, 0.3, 3, [['VPN', 'Incidente'], ['Wi-Fi', 'Incidente'], ['Lentidão de rede', 'Incidente']]],
  ['Sistemas Corporativos', 0.13, 24, 0.12, 4, [['ERP', 'Incidente'], ['Folha de pagamento', 'Incidente'], ['Acesso a relatório BI', 'Requisição']]],
  ['Dúvidas', 0.04, 0.5, 0.95, 1, [['Orientação de uso', 'Requisição']]],
];
export const PRI = ['P1', 'P2', 'P3', 'P4'];
const PRI_W = [0.015, 0.10, 0.585, 0.30];
export const SLA_RESP_MIN = [15, 30, 60, 240], SLA_RES_H = [4, 8, 24, 72];
const PRI_RES = [0.25, 0.5, 1, 1.6], PRI_RESP = [5, 12, 30, 85];
export const CANAIS = ['Portal', 'Telefone', 'E-mail', 'Chat', 'Presencial'];
const HOUR_W = [0, 0, 0, 0, 0, 0, 0.05, 0.4, 1.6, 2.0, 1.6, 1.2, 0.7, 1.2, 1.5, 1.3, 1.0, 0.7, 0.3, 0.12, 0.06, 0.03, 0, 0];
const T_PORTAL = Date.UTC(2026, 5, 1), T_MAIL0 = Date.UTC(2026, 2, 2), T_MAIL1 = Date.UTC(2026, 3, 1), T_VPN = Date.UTC(2026, 6, 14);
const POS = ['Atendimento rápido, resolveram na hora.', 'Analista muito atenciosa e explicou o passo a passo.', 'Resolvido no primeiro contato, obrigado!', 'Excelente, voltei a trabalhar em minutos.', 'Gostei do retorno rápido pelo chat.', 'Técnico pontual e cuidadoso.', 'Consegui resolver sozinho pelo portal, muito prático.'];
const MID = ['Resolveu, mas demorou um pouco para começar.', 'Atendimento ok, poderia ter avisado o andamento.', 'Funcionou, mas precisei explicar o problema duas vezes.'];
const NEG: Record<string, string[]> = {
  slow: ['Demorou dias para alguém aparecer.', 'Fiquei dois dias parado esperando uma solução.', 'Muito tempo de espera para algo simples.', 'Abri na segunda e só resolveram na quinta.'],
  reopen: ['Fecharam o chamado sem resolver, tive que abrir de novo.', 'O problema voltou no dia seguinte.', 'Disseram que estava resolvido, mas não estava.'],
  bounce: ['Fui transferido para três equipes diferentes.', 'Cada pessoa pedia as mesmas informações de novo.', 'Ninguém sabia de quem era o chamado.'],
  comm: ['Ninguém me deu retorno sobre o andamento.', 'Só soube que tinha sido resolvido quando fui conferir.', 'Faltou avisar o prazo.'],
  mail: ['Ninguém avisou direito sobre a migração do e-mail.', 'Perdi acesso à caixa compartilhada depois da migração.', 'Depois da migração o Outlook não sincroniza mais.'],
  sys: ['O ERP parou no fechamento do mês e ninguém tinha previsão.', 'Chamado de sistema fica parado sem resposta.', 'A folha travou e o suporte não sabia resolver.'],
};

export type Chamado = {
  id: string; open: number; m: number; tipo: Tipo; cat: string; ci: number; sub: string; p: number; canal: string; g: number; an: number;
  respMin: number; slaResp: boolean; resH: number | null; isOpen: boolean; ageH: number | null; fcr: boolean; reassign: number; reopened: boolean;
  slaRes: boolean | null; csat: number | null; comment: string | null; hour: number; dow: number;
};
export const T: Chamado[] = [];
let nInc = 10420, nReq = 4210;
function makeTicket(open: number, opts: { cat?: number; sub?: [string, Tipo]; pri?: number; forceEsc?: boolean; medH?: number } = {}) {
  const m = monthIdx(open);
  const mail = open >= T_MAIL0 && open < T_MAIL1;
  const ci = opts.cat ?? pickW(CATS.map((c, i) => { let w = c[1]; if (i === 0 && open >= T_PORTAL) w *= 0.62; if (i === 1 && mail) w *= 2.6; return w; }));
  const C = CATS[ci], sub = opts.sub ?? pick(C[5]), tipo = sub[1], p = opts.pri ?? pickW(PRI_W), portal = open >= T_PORTAL;
  let canal = CANAIS[pickW(portal ? [0.38, 0.22, 0.18, 0.16, 0.06] : [0.18, 0.34, 0.26, 0.14, 0.08])];
  if (ci === 0 && portal && rnd() < 0.5) canal = 'Portal';
  const hour = new Date(open).getUTCHours(), dow = new Date(open).getUTCDay();
  const peak = dow === 1 && hour >= 8 && hour <= 11 ? 1.7 : hour >= 8 && hour <= 10 ? 1.25 : 1;
  const respMin = Math.max(1, Math.round(PRI_RESP[p] * peak * (mail ? 1.4 : 1) * Math.exp(randn() * 0.75)));
  let fcr = rnd() < C[3] * (ci === 0 && portal ? 1.05 : 1);
  if (opts.forceEsc) fcr = false;
  const g = fcr ? 0 : C[4], an = pick(byGroup[g]);
  const reassign = fcr ? 0 : 1 + poisson(ci === 4 ? 0.7 : ci === 5 ? 0.6 : 0.3);
  let med = C[2] * PRI_RES[p] * an.speed;
  if (ci === 1 && mail) med *= 2.2;
  if (ci === 5) med *= 1.15;
  if (opts.medH) med = opts.medH;
  let resH = Math.max(0.08, med * Math.exp(randn() * (ci === 5 || ci === 2 ? 1.0 : 0.85)));
  if ((ci === 2 || ci === 3 || ci === 5) && rnd() < 0.07) resH *= 5 + rnd() * 12;
  const resolved = open + resH * H, isOpen = resolved > HOJE;
  const reopened = !isOpen && rnd() < an.reopen * (ci === 1 && mail ? 2 : 1);
  const slaResp = respMin <= SLA_RESP_MIN[p], slaRes = isOpen ? null : resH <= SLA_RES_H[p];
  let csat: number | null = null, comment: string | null = null;
  if (!isOpen && rnd() < 0.34) {
    let s = 4.55 + an.csat + randn() * 0.55;
    if (!slaRes) s -= 1.1; if (reopened) s -= 1.3; if (reassign >= 2) s -= 0.6;
    if (ci === 1 && mail) s -= 0.7;
    if (canal === 'Portal' && fcr) s += 0.15;
    csat = clamp(Math.round(s), 1, 5);
    if (rnd() < 0.45) {
      if (csat >= 4) comment = canal === 'Portal' ? pick(POS) : pick(POS.filter((c) => !/portal/.test(c)));
      else if (csat === 3) comment = pick(MID);
      else {
        const pool: string[] = [];
        if (ci === 1 && mail) pool.push('mail', 'mail'); if (ci === 5) pool.push('sys'); if (reopened) pool.push('reopen', 'reopen');
        if (reassign >= 2) pool.push('bounce', 'bounce'); if (!slaRes) pool.push('slow', 'slow'); pool.push('comm');
        comment = pick(NEG[pick(pool)]);
      }
    }
  }
  const id = tipo === 'Incidente' ? `INC${String(++nInc).padStart(7, '0')}` : `RITM${String(++nReq).padStart(7, '0')}`;
  T.push({ id, open, m, tipo, cat: C[0], ci, sub: sub[0], p, canal, g, an: an.id, respMin, slaResp, resH: isOpen ? null : resH, isOpen, ageH: isOpen ? (HOJE - open) / H : null, fcr, reassign, reopened, slaRes, csat, comment, hour, dow });
}
for (let d = T0; d < HOJE; d += DAY) {
  const dow = new Date(d).getUTCDay(), m = monthIdx(d);
  let lambda = dow === 0 || dow === 6 ? 2.5 : 31 * (dow === 1 ? 1.25 : dow === 5 ? 0.88 : 1);
  lambda *= 1 + 0.008 * m;
  const n = poisson(lambda);
  const hw = dow === 0 || dow === 6 ? HOUR_W.map((_, h) => (h >= 9 && h <= 17 ? 1 : 0)) : HOUR_W;
  for (let k = 0; k < n; k++) { const h = pickW(hw); const t = d + h * H + Math.floor(rnd() * 60) * 60000; if (t < HOJE) makeTicket(t); }
  if (d === T_VPN) for (let k = 0; k < 64; k++) makeTicket(d + (8 + rnd() * 3) * H, { cat: 4, sub: ['VPN', 'Incidente'], pri: 1, forceEsc: true, medH: 5.5 });
}
T.sort((a, b) => a.open - b.open);

/* ============ consultas ============ */
export type Filtro = { periodo: Periodo; group: string; type: string };
export type Recorte = { from?: number; to?: number; cat?: string | null; p?: number | null; canal?: string | null; an?: number | null; group?: string; type?: string };

export function filt(f: Filtro, o: Recorte = {}) {
  const from = o.from ?? f.periodo.from, to = o.to ?? f.periodo.to, g = o.group ?? f.group, ty = o.type ?? f.type;
  return T.filter((t) => t.m >= from && t.m <= to && (g === 'all' || t.g === +g) && (ty === 'all' || t.tipo === ty)
    && (!o.cat || t.cat === o.cat) && (o.p == null || o.p < 0 || t.p === o.p) && (!o.canal || t.canal === o.canal) && (o.an == null || t.an === o.an));
}
export type Kpi = ReturnType<typeof kpi>;
export function kpi(rows: Chamado[]) {
  const res = rows.filter((t) => !t.isOpen), cs = rows.filter((t) => t.csat);
  return {
    n: rows.length, resolvidos: res.length, abertos: rows.length - res.length,
    slaResp: rows.length ? rows.filter((t) => t.slaResp).length / rows.length : NaN,
    slaRes: res.length ? res.filter((t) => t.slaRes).length / res.length : NaN,
    mttr: median(res.map((t) => t.resH!)),
    fcr: rows.length ? rows.filter((t) => t.fcr).length / rows.length : NaN,
    reab: res.length ? res.filter((t) => t.reopened).length / res.length : NaN,
    csat: cs.length ? sum(cs, (t) => t.csat!) / cs.length : NaN,
    satisf: cs.length ? cs.filter((t) => t.csat! >= 4).length / cs.length : NaN,
    insat: cs.length ? cs.filter((t) => t.csat! <= 2).length / cs.length : NaN,
    respostas: cs.length,
    reatrib: rows.length ? sum(rows, (t) => t.reassign) / rows.length : NaN,
  };
}
export const allSel = (f: Filtro) => T.filter((t) => (f.group === 'all' || t.g === +f.group) && (f.type === 'all' || t.tipo === f.type));
export const byMonth = (rows: Chamado[]) => MONTHS.map((mm) => kpi(rows.filter((t) => t.m === mm.i)));
export const curOpen = (f: Filtro) => allSel(f).filter((t) => t.isOpen).map((t) => ({ ...t, cons: t.ageH! / SLA_RES_H[t.p] }));
export const META = { sla: 0.9, csat: 4.3, reab: 0.06 };

export function teamRows(f: Filtro) {
  const rows = filt(f);
  return ANALYSTS.map((a) => {
    const r = rows.filter((t) => t.an === a.id), k = kpi(r);
    return { id: a.id, nome: a.nome, g: a.g, gs: GSHORT[a.g], n: r.length, mttr: k.mttr, slaRes: k.slaRes, reab: k.reab, csat: k.csat, resp: k.respostas };
  }).filter((x) => x.n > 0);
}

export const THEME_RULES: [string, RegExp, string][] = [
  ['Demora no atendimento', /demor|dias|espera|esperando|só resolveram|tempo de espera/i, 'Rever a escala nos horários de pico e o prazo do suporte em campo.'],
  ['Fechado sem resolver', /sem resolver|voltou|não estava|de novo/i, 'Confirmar com o usuário antes de encerrar o chamado.'],
  ['Transferências entre equipes', /transferid|equipes|mesmas informações|de quem era/i, 'Melhorar a triagem do N1 com um roteiro por sintoma.'],
  ['Falta de retorno', /retorno|avisar|andamento|soube/i, 'Atualizar o usuário a cada mudança de situação.'],
  ['Migração de e-mail', /migraç|outlook não sincroniza|caixa compartilhada/i, 'Comunicar mudanças com antecedência e ter perguntas frequentes prontas.'],
  ['Sistemas sem previsão', /erp|folha|sistema/i, 'Criar um acordo de atendimento com a equipe de sistemas.'],
  ['Rapidez elogiada', /rápid|na hora|minutos|primeiro contato/i, 'Registrar as soluções rápidas na base de conhecimento.'],
  ['Cordialidade elogiada', /atencios|cuidados|pontual|obrigad|passo a passo|prático/i, 'Usar estes atendimentos como exemplo em treinamentos.'],
];
