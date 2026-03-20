// ── TEMPLATES DE PROPOSTA E CONTRATO ──
// Toda a lógica de geração de documentos sem IA

window.PropostaTemplates = {

  // ── ESCOPOS POR TIPO DE PROJETO ──
  scopeDefaults: {
    site: 'Desenvolvimento de website institucional responsivo, incluindo design de layout, programação front-end, integração com CMS, otimização para motores de busca (SEO básico) e configuração de formulário de contato. O projeto contempla até X páginas internas conforme briefing aprovado.',
    branding: 'Desenvolvimento de identidade visual completa, incluindo criação de logotipo (apresentação de 3 conceitos e 2 rodadas de refinamento), definição de paleta de cores, tipografia, papelaria básica (cartão de visitas, papel timbrado e assinatura de e-mail) e guia de marca em PDF.',
    social: 'Gestão estratégica de redes sociais, incluindo planejamento de conteúdo mensal, criação de artes para feed e stories, elaboração de legendas otimizadas, agendamento de publicações conforme calendário editorial e relatório mensal de desempenho.',
    dev: 'Desenvolvimento de aplicação/sistema conforme especificações técnicas levantadas em reunião de briefing. Inclui arquitetura de banco de dados, desenvolvimento back-end e front-end, testes de qualidade, documentação técnica básica e suporte para implantação em ambiente de produção.',
    consultoria: 'Prestação de serviços de consultoria estratégica, incluindo diagnóstico inicial da situação atual, análise de oportunidades e riscos, elaboração de plano de ação com recomendações priorizadas, apresentação executiva de resultados e acompanhamento da fase inicial de implementação.',
    outro: 'Prestação de serviços conforme escopo detalhado em briefing aprovado entre as partes, com entregas e critérios de aceite definidos de comum acordo. Quaisquer adições ao escopo original deverão ser formalizadas por escrito e poderão implicar em ajuste de prazo e valor.'
  },

  // ── TEXTOS DE PAGAMENTO ──
  paymentText(type, method, total) {
    const methodMap = { pix: 'PIX', boleto: 'Boleto bancário', transferencia: 'Transferência bancária', cartao: 'Cartão de crédito' };
    const m = methodMap[method] || 'PIX';
    const map = {
      '50-50': `50% (cinquenta por cento) no ato da assinatura deste contrato e 50% (cinquenta por cento) na entrega final aprovada, via ${m}`,
      '30-70': `30% (trinta por cento) no ato da assinatura deste contrato e 70% (setenta por cento) na entrega final aprovada, via ${m}`,
      mensal: `Mensalmente, conforme cronograma de entregas estabelecido, via ${m}. O vencimento de cada parcela será definido em comum acordo entre as partes`,
      avista: `À vista, no ato da assinatura deste contrato, via ${m}`
    };
    return map[type] || `Conforme acordado entre as partes, via ${m}`;
  },

  // ── INTRO POR TOM ──
  introText(tone, clientName, projType) {
    const proj = projType || 'projeto';
    const map = {
      profissional: `Apresentamos a seguir nossa proposta comercial para o desenvolvimento do ${proj} solicitado por ${clientName}. Este documento detalha o escopo de trabalho, cronograma, investimento e condições de fornecimento dos serviços, visando estabelecer uma parceria sólida e transparente.`,
      direto: `Segue nossa proposta para o ${proj} de ${clientName}. Abaixo estão todos os detalhes de escopo, prazo e investimento necessários para a tomada de decisão.`,
      warm: `É com muito entusiasmo que apresentamos nossa proposta para ${clientName}! Preparamos este documento com atenção a cada detalhe do que conversamos, e estamos animados com a possibilidade de trabalharmos juntos neste ${proj}.`
    };
    return map[tone] || map.profissional;
  },

  // ── GERAR PROPOSTA HTML ──
  buildProposta(d) {
    const scope = d.project.scope || this.scopeDefaults[d.project.type] || this.scopeDefaults.outro;
    const intro = this.introText(d.conditions.tone, d.client.name, d.project.type);
    const svcRows = d.project.services.map(s =>
      `<tr><td>${esc(s.name)}</td><td style="text-align:right;font-weight:500;">${esc(s.price || '—')}</td></tr>`
    ).join('');

    return `<div class="document">
  <div class="doc-header">
    <div>
      <div class="doc-brand" contenteditable="true">${esc(d.provider.name)}</div>
      <div class="doc-brand-sub">${esc(d.provider.email)}${d.provider.address ? ' · ' + esc(d.provider.address) : ''}</div>
    </div>
    <div class="doc-type-badge">Proposta Comercial</div>
  </div>

  <div class="doc-meta-grid">
    <div class="doc-meta-card">
      <div class="doc-meta-label">Para</div>
      <div class="doc-meta-val">
        <strong contenteditable="true">${esc(d.client.name)}</strong>
        ${d.client.contact ? esc(d.client.contact) + '<br>' : ''}
        ${d.client.docNum ? 'CNPJ/CPF: ' + esc(d.client.docNum) : ''}
      </div>
    </div>
    <div class="doc-meta-card">
      <div class="doc-meta-label">Detalhes</div>
      <div class="doc-meta-val">
        Data: ${today()}<br>
        Válida por: <strong>${esc(d.conditions.validity || '7')} dias</strong><br>
        Revisões: ${esc(d.conditions.revisions || '2 rodadas')}
      </div>
    </div>
  </div>

  <div class="doc-sec">
    <div class="doc-sec-title">Apresentação</div>
    <div class="doc-text" contenteditable="true"><p>${intro}</p></div>
  </div>

  <div class="doc-sec">
    <div class="doc-sec-title">Escopo do Projeto</div>
    <div class="doc-text" contenteditable="true"><p>${esc(scope)}</p></div>
  </div>

  <div class="doc-sec">
    <div class="doc-sec-title">Serviços e Investimento</div>
    <table class="svc-table">
      <thead><tr><th>Serviço / Entrega</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>${svcRows}</tbody>
      <tfoot><tr class="total-row"><td><strong>Total</strong></td><td style="text-align:right">${esc(d.project.totalValue || '—')}</td></tr></tfoot>
    </table>
  </div>

  <div class="doc-sec">
    <div class="doc-sec-title">Condições Comerciais</div>
    <div class="doc-highlight">
      <strong>Pagamento:</strong> ${this.paymentText(d.conditions.paymentType, d.conditions.paymentMethod, d.project.totalValue)}<br>
      <strong>Início:</strong> ${fmtDate(d.conditions.startDate) || 'A definir'} &nbsp;·&nbsp;
      <strong>Entrega:</strong> ${fmtDate(d.conditions.endDate) || 'A definir'}
    </div>
    <div class="doc-text" contenteditable="true">
      <p>As revisões solicitadas deverão ser consolidadas em uma única comunicação por rodada. Alterações fora do escopo definido acima serão orçadas separadamente e formalizadas por escrito.</p>
      <p>Esta proposta tem validade de <strong>${esc(d.conditions.validity || '7')} dias</strong> a partir da data acima. Após este período, os valores e prazos poderão ser revisados conforme disponibilidade de agenda.</p>
    </div>
  </div>

  <div class="doc-sec">
    <div class="doc-sec-title">Próximos Passos</div>
    <div class="doc-text">
      <p>1. Aprovação desta proposta (por e-mail ou assinatura abaixo)<br>
      2. Assinatura do contrato de prestação de serviços<br>
      3. Pagamento da entrada conforme condições acima<br>
      4. Kick-off do projeto na data acordada</p>
    </div>
  </div>

  <div class="doc-sigs">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${esc(d.provider.name)}</div>
      <div class="sig-label">Prestador de Serviços${d.provider.docNum ? ' · ' + esc(d.provider.docNum) : ''}</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${esc(d.client.name)}</div>
      <div class="sig-label">Contratante${d.client.docNum ? ' · ' + esc(d.client.docNum) : ''}</div>
    </div>
  </div>
</div>`;
  },

  // ── CLÁUSULAS DO CONTRATO ──
  getClauses(d) {
    const svcList = d.project.services.map(s => s.name).filter(Boolean).join(', ') || 'conforme proposta comercial anexa';
    const payTxt = this.paymentText(d.conditions.paymentType, d.conditions.paymentMethod, d.project.totalValue);
    const start = fmtDate(d.conditions.startDate) || 'data a ser definida pelas partes';
    const end   = fmtDate(d.conditions.endDate)   || 'data a ser definida pelas partes';

    return [
      {
        title: 'Do Objeto',
        text: `A CONTRATADA obriga-se a prestar os seguintes serviços para a CONTRATANTE: <strong>${esc(svcList)}</strong>. Os serviços serão executados conforme especificações técnicas e escopo definidos na Proposta Comercial que integra este instrumento como Anexo I.`
      },
      {
        title: 'Do Prazo',
        text: `Os serviços terão início em <strong>${start}</strong> e previsão de conclusão em <strong>${end}</strong>. O prazo será contado somente a partir do recebimento integral do pagamento inicial e de todos os materiais, briefings, acessos e aprovações necessárias por parte da CONTRATANTE. Atrasos causados pela CONTRATANTE não serão computados no prazo da CONTRATADA. Prorrogações deverão ser acordadas por escrito entre as partes.`
      },
      {
        title: 'Do Valor e Forma de Pagamento',
        text: `O valor total contratado é de <strong>${esc(d.project.totalValue || 'valor a definir')}</strong>. O pagamento será efetuado da seguinte forma: ${payTxt}. O atraso no pagamento de qualquer parcela implicará multa moratória de 2% (dois por cento) ao mês sobre o valor inadimplente, acrescido de correção monetária pelo IGPM/FGV. A CONTRATADA poderá suspender a prestação dos serviços enquanto houver parcelas em atraso, sem que isso configure descumprimento contratual.`
      },
      {
        title: 'Das Revisões e Alterações de Escopo',
        text: `Estão inclusas <strong>${esc(d.conditions.revisions || '2 rodadas')}</strong> de revisão no projeto. Entende-se por revisão a adequação do material já entregue com base em feedback consolidado e objetivo. Cada rodada de revisão deve conter todas as solicitações de alteração em uma única comunicação escrita. Alterações que impliquem em mudança de direcionamento criativo, novo escopo ou funcionalidades adicionais serão consideradas serviços extras, orçadas separadamente e formalizadas por escrito antes de sua execução.`
      },
      {
        title: 'Das Obrigações da Contratada',
        text: `A CONTRATADA compromete-se a: (a) executar os serviços com diligência, qualidade e dentro dos prazos acordados; (b) manter sigilo absoluto sobre todas as informações confidenciais, dados e documentos da CONTRATANTE a que tiver acesso; (c) comunicar imediatamente qualquer impedimento técnico ou circunstância que possa afetar os prazos estabelecidos; (d) entregar todos os arquivos finais nos formatos e resoluções previamente combinados; (e) não subcontratar os serviços objeto deste contrato sem prévia autorização escrita da CONTRATANTE.`
      },
      {
        title: 'Das Obrigações da Contratante',
        text: `A CONTRATANTE compromete-se a: (a) fornecer todos os materiais, informações, acessos e credenciais necessárias em até <strong>5 (cinco) dias úteis</strong> após solicitação formal; (b) efetuar os pagamentos rigorosamente nos prazos acordados; (c) consolidar o feedback de todas as partes interessadas antes de enviar para cada rodada de revisão; (d) não realizar alterações nos arquivos entregues sem autorização expressa da CONTRATADA; (e) manter um responsável acessível para aprovações durante toda a execução do projeto.`
      },
      {
        title: 'Da Propriedade Intelectual e Direitos Autorais',
        text: `Os direitos patrimoniais sobre todo o material criativo e técnico desenvolvido no âmbito deste contrato serão transferidos integralmente à CONTRATANTE somente após a quitação total dos valores acordados. Até que ocorra o pagamento integral, todos os direitos de propriedade intelectual pertencem exclusivamente à CONTRATADA. A CONTRATADA reserva-se o direito de utilizar o trabalho realizado em seu portfólio, redes sociais e materiais de divulgação, exceto quando houver acordo expresso em contrário. A CONTRATANTE não poderá ceder, licenciar ou sublicenciar o material a terceiros sem prévia autorização escrita da CONTRATADA.`
      },
      {
        title: 'Da Confidencialidade',
        text: `As partes obrigam-se mutuamente a manter em absoluto sigilo todas as informações confidenciais trocadas durante a vigência deste contrato e por um período de <strong>2 (dois) anos</strong> após seu encerramento. São consideradas informações confidenciais: dados estratégicos, financeiros, operacionais, técnicos, comerciais e quaisquer outros que não sejam de domínio público. A violação desta cláusula sujeitará a parte infratora ao pagamento de indenização por perdas e danos comprovados.`
      },
      {
        title: 'Da Rescisão',
        text: `Este contrato poderá ser rescindido por qualquer das partes mediante notificação escrita com antecedência mínima de <strong>15 (quinze) dias corridos</strong>. Em caso de rescisão por iniciativa da CONTRATANTE sem justa causa: os serviços já executados até a data da rescisão serão cobrados proporcionalmente e não haverá restituição de valores já pagos. Em caso de rescisão por iniciativa da CONTRATADA sem justa causa: serão devolvidos os valores recebidos pelos serviços não entregues, deduzidos os custos já incorridos. A rescisão por justa causa, caracterizada pelo descumprimento das obrigações previstas neste instrumento, poderá ser imediata mediante notificação fundamentada.`
      },
      {
        title: 'Das Disposições Gerais e Foro',
        text: `Este instrumento constitui o acordo integral entre as partes, substituindo qualquer entendimento verbal ou escrito anterior sobre o mesmo objeto. Eventuais alterações somente terão validade se formalizadas por aditivo contratual assinado por ambas as partes. A tolerância de uma das partes em relação ao descumprimento de qualquer obrigação pela outra não será considerada novação ou renúncia ao direito. As partes elegem o foro da comarca do domicílio da CONTRATADA para dirimir quaisquer questões oriundas deste contrato, com renúncia expressa a qualquer outro, por mais privilegiado que seja.`
      }
    ];
  },

  // ── GERAR CONTRATO HTML ──
  buildContrato(d) {
    const clauses = this.getClauses(d);
    const clauseHTML = clauses.map((c, i) => `
    <div class="doc-clause">
      <div class="doc-clause-num">Cláusula ${i + 1}ª — ${c.title}</div>
      <div class="doc-clause-text" contenteditable="true">${c.text}</div>
    </div>`).join('');

    return `<div class="document">
  <div class="doc-header">
    <div>
      <div class="doc-brand">${esc(d.provider.name)}</div>
      <div class="doc-brand-sub">${esc(d.provider.email)}${d.provider.address ? ' · ' + esc(d.provider.address) : ''}</div>
    </div>
    <div class="doc-type-badge">Contrato de Prestação</div>
  </div>

  <div class="doc-meta-grid">
    <div class="doc-meta-card">
      <div class="doc-meta-label">Contratada (Prestador)</div>
      <div class="doc-meta-val">
        <strong>${esc(d.provider.name)}</strong>
        ${d.provider.docNum ? 'CNPJ/CPF: ' + esc(d.provider.docNum) + '<br>' : ''}
        ${d.provider.email ? esc(d.provider.email) : ''}
      </div>
    </div>
    <div class="doc-meta-card">
      <div class="doc-meta-label">Contratante (Cliente)</div>
      <div class="doc-meta-val">
        <strong>${esc(d.client.name)}</strong>
        ${d.client.docNum ? 'CNPJ/CPF: ' + esc(d.client.docNum) + '<br>' : ''}
        ${d.client.contact ? 'Resp.: ' + esc(d.client.contact) : ''}
      </div>
    </div>
  </div>

  <div class="doc-sec">
    <div class="doc-sec-title">Contrato de Prestação de Serviços</div>
    <div class="doc-text">
      <p>As partes acima qualificadas, doravante denominadas simplesmente <strong>CONTRATADA</strong> e <strong>CONTRATANTE</strong>, celebram o presente Contrato de Prestação de Serviços, que se regerá pelas cláusulas e condições a seguir estipuladas, e pelas normas de direito aplicáveis, em especial o Código Civil Brasileiro.</p>
    </div>
  </div>

  <div class="doc-sec">
    ${clauseHTML}
  </div>

  <div class="doc-text" style="font-size:12px;color:var(--ink3);margin-bottom:32px;text-align:center;">
    ${d.provider.address ? esc(d.provider.address) + ', ' : ''}${today()}.
  </div>

  <div class="doc-sigs">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${esc(d.provider.name)}</div>
      <div class="sig-label">CONTRATADA${d.provider.docNum ? ' · ' + esc(d.provider.docNum) : ''}</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${esc(d.client.name)}</div>
      <div class="sig-label">CONTRATANTE${d.client.docNum ? ' · ' + esc(d.client.docNum) : ''}</div>
    </div>
  </div>
  <div class="doc-text" style="margin-top:24px;font-size:12px;text-align:center;color:var(--ink3);">
    Testemunha 1: _____________________________ &nbsp;&nbsp; Testemunha 2: _____________________________
  </div>
</div>`;
  }
};

// ── HELPERS GLOBAIS ──
function esc(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function today() {
  return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}
function fmtDate(d) {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}
