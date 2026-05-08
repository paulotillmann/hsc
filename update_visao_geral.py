import os

path = r'c:\HSC\React-Starter\src\pages\TaxaOcupacao\VisaoGeral.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update OcupacaoDia
content = content.replace('  data: string;\n  horario_envio: string;\n  total_leitos: number;', '  data: string;\n  horario_envio: string;\n  created_at: string;\n  setor_id: string;\n  total_leitos: number;')

# 2. Update useState visaoFiltro
content = content.replace("useState<string>('Ambos'); // 'Ambos' | 'Geral' | 'SUS'", "useState<string>('Geral'); // 'Geral' | 'SUS'")

# 3. Update select query
content = content.replace('            data,\n            horario_envio,\n            total_leitos,', '            data,\n            horario_envio,\n            created_at,\n            setor_id,\n            total_leitos,')

# 4. Add panelRecords calculation after percentSUS
panel_records_code = '''  const dataChartSUS = [
    { name: 'Ocupados', value: statsSUS.ocupados, color: COLOR_OCUPADOS },
    { name: 'Livres', value: statsSUS.livres, color: COLOR_LIVRES },
  ];

  const panelRecords = useMemo(() => {
    let filtered = lancamentos;

    if (visaoFiltro === 'SUS') {
      filtered = filtered.filter(l => l.taxa_setores?.leitos_tipo === 'SUS');
    } else if (visaoFiltro === 'Geral') {
      filtered = filtered.filter(l =>
        (l.taxa_setores?.leitos_tipo === 'SUS' && l.taxa_setores?.calcular_taxa === 'Ambos') ||
        (l.taxa_setores?.leitos_tipo === 'Particular ou convênio' && l.taxa_setores?.calcular_taxa === 'Geral') ||
        (l.taxa_setores?.leitos_tipo === 'Ambos' && l.taxa_setores?.calcular_taxa === 'Geral')
      );
    }

    return filtered;
  }, [lancamentos, visaoFiltro]);
'''
content = content.replace('''  const dataChartSUS = [
    { name: 'Ocupados', value: statsSUS.ocupados, color: COLOR_OCUPADOS },
    { name: 'Livres', value: statsSUS.livres, color: COLOR_LIVRES },
  ];''', panel_records_code)

# 5. Update options
options_old = '''              <option value="Ambos" className="bg-background text-foreground">Geral e SUS</option>
              <option value="Geral" className="bg-background text-foreground">Apenas Geral</option>
              <option value="SUS" className="bg-background text-foreground">Apenas SUS</option>'''
options_new = '''              <option value="Geral" className="bg-background text-foreground">Geral</option>
              <option value="SUS" className="bg-background text-foreground">SUS</option>'''
content = content.replace(options_old, options_new)

# 6. Replace layout and grid rendering
grid_jsx = ''') : (
        <div className="flex flex-col gap-6 mt-4 w-full">
          
          <div className="grid grid-cols-1 max-w-xl mx-auto w-full gap-8">
            {/* Card GERAL */}
            {visaoFiltro === 'Geral' && (
              <div className="bg-card rounded-2xl shadow-sm border p-6 flex flex-col items-center">
                <h2 className="text-lg font-bold text-foreground mb-6 uppercase tracking-wider text-center">Taxa de Ocupação Geral</h2>
                
                <div className="relative w-64 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dataChartGeral}
                        cx="50%"
                        cy="50%"
                        innerRadius={85}
                        outerRadius={110}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        stroke="none"
                        cornerRadius={20}
                        paddingAngle={5}
                      >
                        {dataChartGeral.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Texto Central */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-5xl font-extrabold text-foreground leading-none">{statsGeral.total}</span>
                    <span className="text-sm font-medium text-muted-foreground mt-2">leitos</span>
                  </div>
                </div>

                <div className="mt-8 flex justify-center items-center gap-6 text-[15px] font-medium w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLOR_OCUPADOS }}></div>
                    <span className="text-foreground">Ocupados ({statsGeral.ocupados})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLOR_LIVRES }}></div>
                    <span className="text-foreground">Livres ({statsGeral.livres})</span>
                  </div>
                </div>
              </div>
            )}

            {/* Card SUS */}
            {visaoFiltro === 'SUS' && (
              <div className="bg-card rounded-2xl shadow-sm border p-6 flex flex-col items-center">
                <h2 className="text-lg font-bold text-foreground mb-6 uppercase tracking-wider text-center">Taxa de Ocupação SUS</h2>
                
                <div className="relative w-64 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dataChartSUS}
                        cx="50%"
                        cy="50%"
                        innerRadius={85}
                        outerRadius={110}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        stroke="none"
                        cornerRadius={20}
                        paddingAngle={5}
                      >
                        {dataChartSUS.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  {/* Texto Central */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-5xl font-extrabold text-foreground leading-none">{statsSUS.total}</span>
                    <span className="text-sm font-medium text-muted-foreground mt-2">leitos</span>
                  </div>
                </div>

                <div className="mt-8 flex justify-center items-center gap-6 text-[15px] font-medium w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLOR_OCUPADOS }}></div>
                    <span className="text-foreground">Ocupados ({statsSUS.ocupados})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: COLOR_LIVRES }}></div>
                    <span className="text-foreground">Livres ({statsSUS.livres})</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Table Grid */}
          <div className="flex-1 bg-card border rounded-lg shadow-sm flex flex-col overflow-hidden w-full">
            <div className="p-4 border-b bg-muted/20 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">Lançamentos de Taxas do dia</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                  <CalendarIcon className="h-4 w-4" />
                  {new Date(dataFiltro + 'T00:00:00').toLocaleDateString('pt-BR')}
                  <span className="mx-1">•</span>
                  <Clock className="h-4 w-4" />
                  {horarioFiltro}
                </p>
              </div>
            </div>

            <div className="p-4 flex-1 overflow-auto bg-muted/5">
              {panelRecords.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-3 p-6 text-center">
                  <p>Nenhum setor encontrado para este horário.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/50 border-b">
                      <tr>
                        <th className="px-2 py-2 font-semibold">Setor</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Leitos</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Ocupados</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Ocup.<br />Não SUS</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Ocup.<br />SUS</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Isolados</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Livres</th>
                        <th className="px-2 py-2 font-semibold text-center leading-tight">Disp.</th>
                        <th className="px-2 py-2 font-semibold text-center w-[80px] leading-tight">Taxa<br />Ocup.</th>
                        <th className="px-2 py-2 font-semibold text-center">Atual.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {panelRecords.map((record, index) => {
                        const detalhes = record.taxa_ocupacao_dia_setor_leito || [];
                        const totalOcupadosNaoSus = detalhes
                          .filter(d => d.padrao !== false)
                          .reduce((acc, curr) => acc + Number(curr.qtd_leitos_dia || 0), 0);
                        const totalOcupadosSus = detalhes
                          .filter(d => d.padrao !== false)
                          .reduce((acc, curr) => acc + Number(curr.qtd_leitos_sus || 0), 0);
                        const totalOcupados = totalOcupadosNaoSus + totalOcupadosSus;

                        const isolados = detalhes
                          .filter(d => d.padrao === false)
                          .reduce((acc, curr) => acc + Number(curr.qtd_leitos_dia || 0) + Number(curr.qtd_leitos_sus || 0), 0);

                        const isSUS = record.taxa_setores?.leitos_tipo === 'SUS';
                        const baseLeitosExibicao = isSUS ? Number(record.total_leitos_sus || 0) : Number(record.total_leitos || 0);

                        const leitosLivres = Math.max(0, baseLeitosExibicao - totalOcupados);
                        const leitosDisponiveis = leitosLivres;
                        const taxaOcupacao = baseLeitosExibicao > 0 ? Math.min(100, (totalOcupados / baseLeitosExibicao) * 100) : 0;

                        const dataAtual = new Date(record.created_at);
                        const atualTime = `${String(dataAtual.getHours()).padStart(2, '0')}:${String(dataAtual.getMinutes()).padStart(2, '0')}`;

                        return (
                          <tr key={record.id} className="border-b hover:bg-muted/30 transition-colors">
                            <td className="px-2 py-2 font-medium text-foreground whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]" title={record.taxa_setores?.nome_setor}>
                              <div className="flex flex-col">
                                <span className="truncate">{record.taxa_setores?.nome_setor}</span>
                                {record.taxa_setores?.leitos_tipo && (
                                  <span className="inline-flex w-fit px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 uppercase tracking-tight mt-0.5">
                                    {record.taxa_setores?.leitos_tipo}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center font-medium">{baseLeitosExibicao}</td>
                            <td className="px-2 py-2 text-center font-medium">{totalOcupados}</td>
                            <td className="px-2 py-2 text-center">{totalOcupadosNaoSus}</td>
                            <td className="px-2 py-2 text-center">{totalOcupadosSus}</td>
                            <td className="px-2 py-2 text-center text-yellow-600 dark:text-yellow-500 font-medium">{isolados}</td>
                            <td className="px-2 py-2 text-center">{leitosLivres}</td>
                            <td className="px-2 py-2 text-center">{leitosDisponiveis}</td>
                            <td className="px-2 py-2 text-center">
                              <div className="relative w-full h-6 bg-muted/40 rounded overflow-hidden flex items-center justify-center border border-border/50">
                                <div
                                  className="absolute left-0 top-0 h-full bg-[#8c1c13] transition-all duration-500"
                                  style={{ width: `${taxaOcupacao}%` }}
                                />
                                <span className={`relative z-10 text-xs font-bold ${taxaOcupacao > 50 ? 'text-white' : 'text-foreground'}`}>
                                  {taxaOcupacao.toFixed(1).replace('.0', '')}%
                                </span>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center text-xs text-muted-foreground">{atualTime}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
'''
grid_start = content.find(') : (')
if grid_start != -1:
    content = content[:grid_start] + grid_jsx

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
