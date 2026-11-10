import { Navigate, Route, Routes } from 'react-router-dom';
import { BookOpen, Headset, House, ListTodo, Radio, Sparkles, Star, Users } from 'lucide-react';
import { FiltrosProvider, useFiltros, type DefFiltro } from './kit/filtros';
import { Moldura, type Visao } from './kit/ui';
import { GROUPS, type Filtro } from './dados';
import Resumo from './telas/Resumo';
import Fila from './telas/Fila';
import AoVivo from './telas/AoVivo';
import Equipe from './telas/Equipe';
import Satisfacao from './telas/Satisfacao';
import Assistente from './telas/Assistente';
import Sobre from './telas/Sobre';

const FILTROS: DefFiltro[] = [
  { id: 'group', label: 'Equipe', options: [['all', 'Todas'], ...GROUPS.map((g, i) => [String(i), g] as [string, string])] },
  { id: 'type', label: 'Tipo', options: [['all', 'Todos'], ['Incidente', 'Incidentes'], ['Requisição', 'Requisições']] },
];

const VISOES: Visao[] = [
  { path: '/', label: 'Visão geral', icon: <House />, heading: 'Visão geral do atendimento', sub: 'Prazo, satisfação e volume de chamados' },
  { path: '/ao-vivo', label: 'Ao vivo', icon: <Radio />, heading: 'Operação ao vivo', sub: 'Fila, analistas e nível de serviço minuto a minuto', filtros: 'nenhum' },
  { path: '/fila', label: 'Fila e prazos', icon: <ListTodo />, heading: 'Fila e prazos', sub: 'Chamados abertos, vencidos e horários de pico' },
  { path: '/equipe', label: 'Equipe', icon: <Users />, heading: 'Desempenho da equipe', sub: 'Resolução, reabertura e satisfação por analista' },
  { path: '/satisfacao', label: 'Satisfação', icon: <Star />, heading: 'Satisfação do usuário', sub: 'O que os usuários acharam do atendimento' },
  { path: '/assistente', label: 'Assistente', icon: <Sparkles />, heading: 'Assistente de análise', sub: 'Perguntas prontas respondidas com os dados do painel' },
  { path: '/sobre', label: 'Sobre os dados', icon: <BookOpen />, heading: 'Sobre os dados', sub: 'Como o painel foi construído', filtros: 'nenhum' },
];

export function useFiltro(): Filtro {
  const { periodo, valor } = useFiltros();
  return { periodo, group: valor('group'), type: valor('type') };
}

export default function App() {
  return (
    <FiltrosProvider chave="rotalume-sd" defs={FILTROS}>
      <Routes>
        <Route element={<Moldura produto="Service Desk" icone={<Headset size={18} />} visoes={VISOES} asOf="31/10/2026"
          rodape={<>Projeto de portfólio de <a href="https://github.com/Oberon-23">Breno Silva</a> · Rotalume é uma empresa fictícia e todos os dados são simulados.</>} />}>
          <Route index element={<Resumo />} />
          <Route path="ao-vivo" element={<AoVivo />} />
          <Route path="fila" element={<Fila />} />
          <Route path="equipe" element={<Equipe />} />
          <Route path="satisfacao" element={<Satisfacao />} />
          <Route path="assistente" element={<Assistente />} />
          <Route path="sobre" element={<Sobre />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </FiltrosProvider>
  );
}
