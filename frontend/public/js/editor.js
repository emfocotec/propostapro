(function() {
  var token = localStorage.getItem('pp_token');
  if (!token) { window.location.href = '/login'; return; }

  var user = JSON.parse(localStorage.getItem('pp_user') || '{}');
  var currentStep = 1;
  var currentTab  = 'proposta';
  var currentId   = null;
  var genProposta = '';
  var genContrato = '';
  var saveTimer   = null;

  // ── INIT ──
  document.addEventListener('DOMContentLoaded', function() {
    var elName = document.getElementById('user-name');
    var elPlan = document.getElementById('user-plan');
    if (elName) elName.textContent = user.name || 'Usuário';
    if (elPlan) elPlan.textContent = user.plan === 'solo' ? 'Plano Solo' : user.plan === 'agencia' ? 'Plano Agência' : 'Plano Gratuito';

    // Mostra só step 1
    showStep(1);

    // Botões de navegação
    on('btn-next-1', function() { nextStep(1); });
    on('btn-next-2', function() { nextStep(2); });
    on('btn-next-3', function() { nextStep(3); });
    on('btn-back-2', function() { showStep(1); });
    on('btn-back-3', function() { showStep(2); });
    on('btn-back-4', function() { showStep(3); });
    on('btn-gerar',  generateDocs);
    on('btn-save',   saveDoc);
    on('btn-generate', generateDocs);
    on('btn-copy',   copyText);
    on('btn-print',  function() { window.print(); });
    on('btn-share',  shareLink);
    on('btn-logout', logout);
    on('ptab-proposta', function() { switchTab('proposta'); });
    on('ptab-contrato', function() { switchTab('contrato'); });
    on('btn-add-svc', addSvc);

    // Step nav clicável
    document.querySelectorAll('.sne').forEach(function(el) {
      el.addEventListener('click', function() { showStep(parseInt(el.dataset.step)); });
    });

    // Chips
    document.querySelectorAll('.chip-g').forEach(function(group) {
      group.querySelectorAll('.chip').forEach(function(chip) {
        chip.addEventListener('click', function() {
          group.querySelectorAll('.chip').forEach(function(c) { c.classList.remove('selected'); });
          chip.classList.add('selected');
        });
      });
    });

    // Bind serviços iniciais
    bindSvcEvents();

    // Pré-preenche
    setVal('my-name',  user.companyName || user.name || '');
    setVal('my-email', user.email || '');
    setVal('my-doc',   user.cnpjCpf || '');
    setVal('my-addr',  user.address || '');

    // Carrega proposta existente
    var params = new URLSearchParams(window.location.search);
    var editId = params.get('id');
    if (editId) loadExisting(editId);
  });

  function on(id, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', fn);
  }

  // ── STEPS ──
  function showStep(n) {
    for (var i = 1; i <= 4; i++) {
      var el = document.getElementById('fs-' + i);
      if (el) el.style.display = (i === n) ? 'flex' : 'none';
    }
    document.querySelectorAll('.sne').forEach(function(el) {
      var sn = parseInt(el.dataset.step);
      el.classList.remove('active','done');
      if (sn === n) el.classList.add('active');
      else if (sn < n) el.classList.add('done');
    });
    currentStep = n;
    var form = document.querySelector('.editor-form');
    if (form) form.scrollTop = 0;
    hideErr();
  }

  function nextStep(from) {
    if (!validate(from)) return;
    showStep(from + 1);
  }

  function validate(n) {
    if (n === 1 && !gv('my-name')) { showErr('Informe seu nome/empresa.'); focusEl('my-name'); return false; }
    if (n === 2 && !gv('cl-name')) { showErr('Informe o nome do cliente.'); focusEl('cl-name'); return false; }
    if (n === 3 && !getServices().length) { showErr('Adicione pelo menos um serviço.'); return false; }
    return true;
  }

  function showErr(msg) {
    var el = document.getElementById('step-err');
    if (!el) {
      el = document.createElement('div');
      el.id = 'step-err';
      el.style.cssText = 'background:#FCEBEB;color:#A32D2D;border:1px solid #F09595;border-radius:8px;padding:10px 14px;font-size:13px;margin-bottom:8px;';
      var active = document.querySelector('.form-step[style*="flex"]');
      if (active) active.insertBefore(el, active.firstChild);
    }
    el.textContent = msg;
    el.style.display = 'block';
  }
  function hideErr() { var el = document.getElementById('step-err'); if (el) el.style.display = 'none'; }
  function gv(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  function focusEl(id) { var el = document.getElementById(id); if (el) el.focus(); }

  // ── SERVIÇOS ──
  function bindSvcEvents() {
    document.querySelectorAll('.svc-del').forEach(function(btn) {
      btn.onclick = function() {
        if (document.querySelectorAll('.svc-row').length > 1) { btn.parentElement.remove(); calcTotal(); }
      };
    });
    document.querySelectorAll('.svc-price').forEach(function(inp) {
      inp.oninput = calcTotal;
    });
  }

  function addSvc() {
    var list = document.getElementById('svc-list');
    var row = document.createElement('div');
    row.className = 'svc-row';
    row.innerHTML = '<input type="text" class="svc-name" placeholder="Nome do serviço"><input type="text" class="svc-price" placeholder="R$ 0,00"><button type="button" class="svc-del">×</button>';
    list.appendChild(row);
    bindSvcEvents();
    row.querySelector('.svc-name').focus();
  }

  function calcTotal() {
    var total = 0;
    document.querySelectorAll('.svc-price').forEach(function(inp) {
      var v = inp.value.replace(/[^\d,\.]/g,'').replace(',','.');
      total += parseFloat(v) || 0;
    });
    var fmt = 'R$ ' + total.toLocaleString('pt-BR', {minimumFractionDigits:2});
    var el = document.getElementById('total-display');
    if (el) el.textContent = fmt;
    return fmt;
  }

  function getServices() {
    return Array.from(document.querySelectorAll('.svc-row')).map(function(r) {
      return { name: (r.querySelector('.svc-name')||{}).value||'', price: (r.querySelector('.svc-price')||{}).value||'' };
    }).filter(function(s) { return s.name.trim(); });
  }

  function getChip(id) {
    var sel = document.querySelector('#' + id + ' .chip.selected');
    return sel ? sel.dataset.v : '';
  }

  function collectData() {
    return {
      provider: { name: gv('my-name'), docNum: gv('my-doc'), email: gv('my-email'), address: gv('my-addr') },
      client:   { name: gv('cl-name'), docNum: gv('cl-doc'), contact: gv('cl-contact'), email: gv('cl-email'), address: gv('cl-addr') },
      project:  { type: getChip('cg-proj'), profType: getChip('cg-prof'), scope: gv('scope'), services: getServices(), totalValue: (document.getElementById('total-display')||{}).textContent || 'R$ 0,00' },
      conditions: { startDate: gv('start-date'), endDate: gv('end-date'), paymentType: getChip('cg-pay'), paymentMethod: getChip('cg-method'), revisions: getChip('cg-rev'), validity: getChip('cg-val'), tone: getChip('cg-tone') }
    };
  }

  // ── GERAR ──
  function generateDocs() {
    var d = collectData();
    if (!d.provider.name) { showStep(1); showErr('Informe seu nome/empresa.'); return; }
    if (!d.client.name)   { showStep(2); showErr('Informe o nome do cliente.'); return; }
    if (!d.project.services.length) { showStep(3); showErr('Adicione pelo menos um serviço.'); return; }
    if (typeof PropostaTemplates === 'undefined') { alert('Erro: templates.js não carregou. Verifique o console F12.'); return; }
    genProposta = PropostaTemplates.buildProposta(d);
    genContrato = PropostaTemplates.buildContrato(d);
    switchTab('proposta');
    document.getElementById('doc-title-display').textContent = 'Proposta para ' + d.client.name;
    setSave('Gerado! Salvando...', false);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDoc, 2000);
  }

  function switchTab(tab) {
    currentTab = tab;
    document.getElementById('ptab-proposta').classList.toggle('active', tab === 'proposta');
    document.getElementById('ptab-contrato').classList.toggle('active', tab === 'contrato');
    var area = document.getElementById('doc-area');
    if (tab === 'proposta' && genProposta) area.innerHTML = genProposta;
    else if (tab === 'contrato' && genContrato) area.innerHTML = genContrato;
    else area.innerHTML = '<div class="doc-empty-state"><div style="font-size:48px;opacity:.2">✦</div><h3>Gere os documentos primeiro</h3></div>';
  }

  // ── SALVAR ──
  function saveDoc() {
    var d = collectData();
    if (!d.provider.name || !d.client.name) { setSave('Preencha seus dados e do cliente.', true); return; }
    setSave('Salvando...');
    var method = currentId ? 'PATCH' : 'POST';
    var url    = currentId ? '/api/proposals/' + currentId : '/api/proposals';
    fetch(url, {
      method: method,
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      credentials: 'include',
      body: JSON.stringify(Object.assign({ title: 'Proposta para ' + d.client.name, docType: 'both', proposalHtml: genProposta||null, contractHtml: genContrato||null }, d))
    }).then(function(r) {
      if (r.status === 401) { logout(); return null; }
      return r.json().then(function(data) { return { ok: r.ok, status: r.status, data: data }; });
    }).then(function(res) {
      if (!res) return;
      if (res.status === 403 && res.data.upgradeRequired) {
        setSave('Limite do plano gratuito atingido.', true);
        if (confirm('Limite atingido. Fazer upgrade?')) window.location.href = '/precos';
        return;
      }
      if (!res.ok) { setSave(res.data.message || 'Erro ao salvar.', true); return; }
      currentId = res.data.data.proposal._id;
      document.getElementById('btn-share').style.display = 'flex';
      setSave('Salvo ✓');
      setTimeout(function() { setSave(''); }, 3000);
    }).catch(function() { setSave('Erro de conexão.', true); });
  }

  function setSave(msg, err) {
    var el = document.getElementById('save-status');
    if (!el) return;
    el.textContent = msg;
    el.style.color = err ? 'var(--accent)' : 'var(--green)';
  }

  // ── SHARE ──
  function shareLink() {
    if (!currentId) { alert('Salve a proposta primeiro.'); return; }
    if (!user.plan || user.plan === 'free') {
      if (confirm('Link de aceite é exclusivo do plano Solo. Fazer upgrade?')) window.location.href = '/precos';
      return;
    }
    fetch('/api/proposals/' + currentId, { headers: { 'Authorization': 'Bearer ' + token }, credentials: 'include' })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        var t = data.data && data.data.proposal && data.data.proposal.acceptToken;
        if (!t) { alert('Erro ao gerar link.'); return; }
        var link = window.location.origin + '/aceitar/' + t;
        navigator.clipboard.writeText(link).then(function() { alert('✓ Link copiado!\n\n' + link); }).catch(function() { prompt('Copie o link:', link); });
      }).catch(function() { alert('Erro ao gerar link.'); });
  }

  // ── COPIAR ──
  function copyText() {
    var area = document.getElementById('doc-area');
    if (!area.querySelector('.document')) { alert('Gere o documento primeiro.'); return; }
    navigator.clipboard.writeText(area.innerText).then(function() {
      var btn = document.getElementById('btn-copy');
      if (btn) { btn.textContent = '✓ Copiado!'; setTimeout(function() { btn.textContent = '📋 Copiar'; }, 2000); }
    });
  }

  // ── LOGOUT ──
  function logout() {
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    localStorage.removeItem('pp_token');
    localStorage.removeItem('pp_user');
    window.location.href = '/login';
  }

  // ── CARREGAR EXISTENTE ──
  function loadExisting(id) {
    setSave('Carregando...');
    fetch('/api/proposals/' + id, { headers: { 'Authorization': 'Bearer ' + token }, credentials: 'include' })
      .then(function(r) { return r.ok ? r.json() : null; })
      .then(function(res) {
        if (!res) { setSave('Erro ao carregar.', true); return; }
        var p = res.data.proposal;
        setVal('my-name',    p.provider && p.provider.name);
        setVal('my-doc',     p.provider && p.provider.docNum);
        setVal('my-email',   p.provider && p.provider.email);
        setVal('my-addr',    p.provider && p.provider.address);
        setVal('cl-name',    p.client && p.client.name);
        setVal('cl-doc',     p.client && p.client.docNum);
        setVal('cl-contact', p.client && p.client.contact);
        setVal('cl-email',   p.client && p.client.email);
        setVal('cl-addr',    p.client && p.client.address);
        setVal('scope',      p.project && p.project.scope);
        setVal('start-date', p.conditions && p.conditions.startDate);
        setVal('end-date',   p.conditions && p.conditions.endDate);

        var list = document.getElementById('svc-list');
        list.innerHTML = '';
        var svcs = (p.project && p.project.services) || [];
        if (!svcs.length) svcs = [{ name:'', price:'' }];
        svcs.forEach(function(s, i) {
          if (i > 0) addSvc();
          var rows = document.querySelectorAll('.svc-row');
          var row = rows[rows.length-1];
          if (row) { row.querySelector('.svc-name').value = s.name||''; row.querySelector('.svc-price').value = s.price||''; }
        });
        calcTotal();

        setChip('cg-prof',   p.project && p.project.profType);
        setChip('cg-proj',   p.project && p.project.type);
        setChip('cg-pay',    p.conditions && p.conditions.paymentType);
        setChip('cg-method', p.conditions && p.conditions.paymentMethod);
        setChip('cg-rev',    p.conditions && p.conditions.revisions);
        setChip('cg-val',    p.conditions && p.conditions.validity);
        setChip('cg-tone',   p.conditions && p.conditions.tone);

        currentId = p._id;
        document.getElementById('doc-title-display').textContent = p.title || 'Proposta';
        document.getElementById('btn-share').style.display = 'flex';

        if (p.proposalHtml) {
          genProposta = p.proposalHtml;
          genContrato = p.contractHtml || '';
          document.getElementById('doc-area').innerHTML = genProposta;
        }
        setSave('');
      }).catch(function() { setSave('Erro ao carregar.', true); });
  }

  function setVal(id, val) { var el = document.getElementById(id); if (el && val) el.value = val; }

  function setChip(groupId, val) {
    if (!val) return;
    var el = document.querySelector('#' + groupId + ' .chip[data-v="' + val + '"]');
    if (!el) el = document.querySelector('#' + groupId + ' .chip[data-v^="' + (val.split(' ')[0]) + '"]');
    if (el) { document.querySelectorAll('#' + groupId + ' .chip').forEach(function(c){c.classList.remove('selected');}); el.classList.add('selected'); }
  }
})();
