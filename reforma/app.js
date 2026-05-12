/* MASKS */
function formatMoney(v){
  v = Math.round(v*100)/100;
  const sign = v<0 ? '-' : '';
  v = Math.abs(v);
  let [int, dec] = v.toFixed(2).split('.');
  int = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return sign + 'R$ ' + int + ',' + dec;
}
function formatMoneyShort(v){
  const abs = Math.abs(v);
  const sign = v<0 ? '-' : '';
  if(abs >= 1e6) return sign + 'R$ ' + (abs/1e6).toFixed(2).replace('.',',') + ' M';
  if(abs >= 1e3) return sign + 'R$ ' + (abs/1e3).toFixed(1).replace('.',',') + ' K';
  return formatMoney(v);
}
function parseMoney(str){
  if(typeof str === 'number') return str;
  if(!str) return 0;
  const clean = String(str).replace(/[^\d,-]/g,'').replace(/\./g,'').replace(',','.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}
function formatPercent(v){ v = Math.round(v*100)/100; return v.toFixed(2).replace('.',',') + '%'; }
function parsePercent(str){
  if(typeof str === 'number') return str;
  if(!str) return 0;
  const clean = String(str).replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.');
  const n = parseFloat(clean);
  return isNaN(n) ? 0 : n;
}
function formatDocument(v){ return v == null ? '' : String(v).trim(); }

const INPUT_IDS = Array.from(document.querySelectorAll('input[id]:not([type="file"])')).map(inp=>inp.id);

function flattenScalarValues(source, target = {}){
  if(!source || typeof source !== 'object') return target;
  Object.entries(source).forEach(([key, value]) => {
    if(Array.isArray(value)) return;
    if(value && typeof value === 'object') {
      flattenScalarValues(value, target);
      return;
    }
    target[key] = value;
  });
  return target;
}

function setInputValue(input, rawValue){
  if(rawValue === undefined || rawValue === null || rawValue === '') return false;
  if(input.hasAttribute('data-money')) input.value = formatMoney(parseMoney(rawValue));
  else if(input.hasAttribute('data-percent')) input.value = formatPercent(parsePercent(rawValue));
  else input.value = String(rawValue);
  return true;
}

function applyBenefitValues(containerId, raw){
  if(raw === undefined || raw === null) return 0;
  const inputs = Array.from(document.querySelectorAll('#' + containerId + ' input'));
  const keyOrder = ['red30','red40','red50','red60','red70','red80','red100','isencao'];
  let values = [];

  if(Array.isArray(raw)) values = raw;
  else if(typeof raw === 'object') values = keyOrder.map(key => raw[key]);

  let changed = 0;
  inputs.forEach((input, index) => {
    if(values[index] === undefined || values[index] === null || values[index] === '') return;
    input.value = formatPercent(parsePercent(values[index]));
    changed += 1;
  });
  return changed;
}

function updateCompanyInfo(company = {}){
  const nome = company.nome ?? company.razao_social ?? company.empresa ?? company.nome_empresa;
  const cnpj = company.cnpj ?? company.documento ?? company.document;

  if(nome !== undefined && nome !== null && nome !== '') document.getElementById('empresa-nome').textContent = formatDocument(nome);
  if(cnpj !== undefined && cnpj !== null && cnpj !== '') document.getElementById('empresa-cnpj').textContent = formatDocument(cnpj);
}

function getCurrentSimulatorState(){
  const inputValues = {};
  INPUT_IDS.forEach(id => {
    const input = document.getElementById(id);
    inputValues[id] = input.hasAttribute('data-money') ? parseMoney(input.value) : parsePercent(input.value);
  });

  const mapBenefits = (selector) => Array.from(document.querySelectorAll(selector + ' input')).map(input => parsePercent(input.value));
  const priceType = document.querySelector('.ps-type-tab.active')?.getAttribute('data-tipo') || 'produto';
  const priceYear = document.getElementById('ps_ano')?.value || '2033';

  return {
    exportado_em: new Date().toISOString(),
    empresa: {
      nome: document.getElementById('empresa-nome').textContent.trim(),
      cnpj: document.getElementById('empresa-cnpj').textContent.trim()
    },
    inputs: inputValues,
    simulador_preco: {
      tipo: priceType,
      ano: priceYear
    },
    beneficios: {
      receita: mapBenefits('#rec-benefits'),
      credito: mapBenefits('#cr-benefits')
    }
  };
}

function setImportStatus(message, type = ''){
  const status = document.getElementById('import-status');
  status.textContent = message;
  status.className = 'import-status' + (type ? ' ' + type : '');
}

function applyImportedData(payload){
  if(!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('O arquivo deve conter um objeto JSON válido.');
  }

  updateCompanyInfo(payload.empresa || payload.company || payload.dados_empresa || {});

  const scalarValues = {
    ...flattenScalarValues(payload.inputs || {}),
    ...flattenScalarValues(payload.financeiro || {}),
    ...flattenScalarValues(payload.aliquotas || {}),
    ...flattenScalarValues(payload.parametros || {}),
    ...flattenScalarValues(payload),
  };

  let updatedFields = 0;
  INPUT_IDS.forEach(id => {
    const input = document.getElementById(id);
    if(!input || scalarValues[id] === undefined) return;
    if(setInputValue(input, scalarValues[id])) updatedFields += 1;
  });

  updatedFields += applyBenefitValues('rec-benefits', payload?.beneficios?.receita ?? payload?.beneficios_receita ?? payload?.rec_benefits ?? payload?.['rec-benefits']);
  updatedFields += applyBenefitValues('cr-benefits', payload?.beneficios?.credito ?? payload?.beneficios_credito ?? payload?.cr_benefits ?? payload?.['cr-benefits']);

  const priceType = payload?.simulador_preco?.tipo ?? payload?.preco?.tipo ?? payload?.tipo_preco;
  if(priceType) {
    const tab = document.querySelector(`.ps-type-tab[data-tipo="${String(priceType)}"]`);
    if(tab) {
      document.querySelectorAll('.ps-type-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      updatedFields += 1;
    }
  }

  const priceYear = payload?.simulador_preco?.ano ?? payload?.preco?.ano ?? payload?.ps_ano;
  if(priceYear !== undefined && priceYear !== null && priceYear !== '') {
    const select = document.getElementById('ps_ano');
    const yearValue = String(priceYear);
    if(select && Array.from(select.options).some(option => option.value === yearValue)) {
      select.value = yearValue;
      updatedFields += 1;
    }
  }

  compute();
  return updatedFields;
}

function safeFilePart(value, fallback = 'simulacao'){
  return String(value || fallback)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || fallback;
}

function getExportDateSlug(){
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
}

function downloadJson(data, filename){
  const content = JSON.stringify(data, null, 2);
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCurrentJson(){
  const state = getCurrentSimulatorState();
  const company = safeFilePart(state.empresa.nome, 'simulacao');
  downloadJson(state, `simulacao_reforma_tributaria_${company}_${getExportDateSlug()}.json`);
  setImportStatus('JSON atual exportado com sucesso. O arquivo pode ser reimportado depois.', 'success');
}

function generatePdfReport(){
  compute();
  setImportStatus('Preparando PDF com layout otimizado, fundo branco e visual da pagina. Na janela de impressao, escolha "Salvar como PDF".', 'success');
  setTimeout(() => window.print(), 150);
}

function setupJsonImport(){
  const importBtn = document.getElementById('btn-import-json');
  const exportBtn = document.getElementById('btn-export-json');
  const pdfBtn = document.getElementById('btn-generate-pdf');
  const fileInput = document.getElementById('json-file-input');
  const example = document.getElementById('json-example');

  example.textContent = JSON.stringify(getCurrentSimulatorState(), null, 2);

  importBtn.addEventListener('click', () => fileInput.click());
  exportBtn.addEventListener('click', exportCurrentJson);
  pdfBtn.addEventListener('click', generatePdfReport);

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if(!file) return;

    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const updatedFields = applyImportedData(payload);
      example.textContent = JSON.stringify(payload, null, 2);
      setImportStatus(`Arquivo "${file.name}" importado com sucesso. ${updatedFields} campo(s) atualizado(s).`, 'success');
    } catch (error) {
      console.error(error);
      setImportStatus(`Falha ao importar o JSON: ${error.message}`, 'error');
    } finally {
      event.target.value = '';
    }
  });
}

function initializeEmptySimulator(){
  document.getElementById('empresa-nome').textContent = 'Nao informado';
  document.getElementById('empresa-cnpj').textContent = 'Nao informado';

  document.querySelectorAll('input[data-money]').forEach(inp => {
    inp.value = formatMoney(0);
  });

  document.querySelectorAll('input[data-percent]').forEach(inp => {
    inp.value = formatPercent(0);
  });

  const reformCreditBase = document.getElementById('ps_ref_credit_base');
  if(reformCreditBase) reformCreditBase.value = formatPercent(100);
}

document.querySelectorAll('input[data-money]').forEach(inp=>{
  inp.value = formatMoney(parseMoney(inp.value));
  inp.addEventListener('input', ()=>{
    let digits = inp.value.replace(/\D/g,'');
    if(!digits){ inp.value='R$ 0,00'; compute(); return; }
    const n = parseInt(digits,10)/100;
    inp.value = formatMoney(n);
    inp.setSelectionRange(inp.value.length, inp.value.length);
    compute();
  });
  inp.addEventListener('blur', ()=>{ inp.value = formatMoney(parseMoney(inp.value)); compute(); });
});

document.querySelectorAll('input[data-percent]').forEach(inp=>{
  inp.value = formatPercent(parsePercent(inp.value));
  inp.addEventListener('input', ()=>{
    let digits = inp.value.replace(/\D/g,'');
    if(!digits){ inp.value='0,00%'; compute(); return; }
    const n = parseInt(digits,10)/100;
    inp.value = formatPercent(n);
    inp.setSelectionRange(inp.value.length-1, inp.value.length-1);
    compute();
  });
  inp.addEventListener('blur', ()=>{ inp.value = formatPercent(parsePercent(inp.value)); compute(); });
});

/* ==========================================================
   CALCULATION (aligned with EC 132/2023 + PDF methodology)
   ==========================================================
   2026: Test year. CBS 0.9% and IBS 0.1% charged, but offset
         against PIS/COFINS (zero-sum). Net carga = Carga Atual.
   2027–28: CBS full, PIS/COFINS/IPI extinct, ICMS/ISS preserved,
            IBS in test (0.1%) without credit recovery.
   2029: IBS 10%, ICMS/ISS 90%.
   2030: IBS 20%, ICMS/ISS 80%.
   2031: IBS 30%, ICMS/ISS 70%.
   2032: IBS 40%, ICMS/ISS 60%.
   2033: IBS 100%, ICMS/ISS extinct.
*/
const IBS_TEST_FACTOR = 0.1/18.5;

function getVal(id){ return parseMoney(document.getElementById(id).value); }
function getPct(id){ return parsePercent(document.getElementById(id).value)/100; }

function collectBenefits(containerId){
  const inputs = document.querySelectorAll('#'+containerId+' input');
  const [r30,r40,r50,r60,r70,r80,r100,isen] = Array.from(inputs).map(i=>parsePercent(i.value)/100);
  const eff = r30*0.30+r40*0.40+r50*0.50+r60*0.60+r70*0.70+r80*0.80+r100*1.00+isen*1.00;
  return Math.min(eff, 1);
}

function computeAll(){
  const recProd = getVal('rec_produtos');
  const recServ = getVal('rec_servicos');
  const recExp  = getVal('rec_export');
  const recOut  = getVal('rec_outras');
  const receitaBruta = recProd + recServ + recExp + recOut;
  const baseTributavel = recProd + recServ + recOut;

  const aqProd = getVal('aq_produtos');
  const aqServ = getVal('aq_servicos');
  const aqAtiv = getVal('aq_ativos');
  const aqAlug = getVal('aq_alugueis');
  const aquisicoes = aqProd + aqServ + aqAtiv + aqAlug;

  const impIssqn = getVal('imp_issqn');
  const impIcms = getVal('imp_icms');
  const impIpi = getVal('imp_ipi');
  const impPis = getVal('imp_pis');
  const impCofins = getVal('imp_cofins');

  const crIcms = getVal('cr_icms');
  const crIpi = getVal('cr_ipi');
  const crPis = getVal('cr_pis');
  const crCofins = getVal('cr_cofins');

  const aCBS = getPct('aliq_cbs');
  const aIBS = getPct('aliq_ibs');
  const aIS  = getPct('aliq_is');
  const isProd = getPct('is_produtos');
  const isServ = getPct('is_servicos');
  const simples = getPct('simples');

  const redReceita = collectBenefits('rec-benefits');
  const redCredito = collectBenefits('cr-benefits');

  // Legacy net per tax
  const netPis  = Math.max(0, impPis    - crPis);
  const netCof  = Math.max(0, impCofins - crCofins);
  const netIpi  = Math.max(0, impIpi    - crIpi);
  const netIcms = Math.max(0, impIcms   - crIcms);
  const netIss  = impIssqn;

  const legacyFederal  = netPis + netCof + netIpi;
  const legacyIndirect = netIcms + netIss;
  const cargaAtual     = legacyFederal + legacyIndirect;

  // Post-reform full
  const baseReceitaApos = baseTributavel * (1 - redReceita);
  const debCBS = baseReceitaApos * aCBS;
  const debIBS = baseReceitaApos * aIBS;
  const debIS  = (recProd*isProd + recServ*isServ) * aIS;

  const baseAquisCred = aquisicoes * (1 - redCredito) * (1 - simples);
  const credCBS = baseAquisCred * aCBS;
  const credIBS = baseAquisCred * aIBS;

  const netCBS = Math.max(0, debCBS - credCBS);
  const netIBS = Math.max(0, debIBS - credIBS);
  const cargaReforma = netCBS + netIBS + debIS;

  // Schedule (fraction of each bucket per year)
  const schedule = {
    2026: { fed:1.00, ind:1.00, cbs:0.00, ibs:0.00 },
    2027: { fed:0.00, ind:1.00, cbs:1.00, ibs:IBS_TEST_FACTOR, ibsNoCredit:true },
    2028: { fed:0.00, ind:1.00, cbs:1.00, ibs:IBS_TEST_FACTOR, ibsNoCredit:true },
    2029: { fed:0.00, ind:0.90, cbs:1.00, ibs:0.10 },
    2030: { fed:0.00, ind:0.80, cbs:1.00, ibs:0.20 },
    2031: { fed:0.00, ind:0.70, cbs:1.00, ibs:0.30 },
    2032: { fed:0.00, ind:0.60, cbs:1.00, ibs:0.40 },
    2033: { fed:0.00, ind:0.00, cbs:1.00, ibs:1.00 }
  };

  const yearly = {};
  const breakdown = {};
  Object.entries(schedule).forEach(([y, s])=>{
    const yLegFed = legacyFederal  * s.fed;
    const yLegInd = legacyIndirect * s.ind;
    const yCbs    = netCBS * s.cbs;
    const yIbs    = s.ibsNoCredit ? (debIBS * s.ibs) : (netIBS * s.ibs);
    const yIs     = debIS * s.cbs;
    yearly[y] = yLegFed + yLegInd + yCbs + yIbs + yIs;
    breakdown[y] = { legFed:yLegFed, legInd:yLegInd, cbs:yCbs, ibs:yIbs, is:yIs };
  });

  const composicaoAtual = [
    { label:'ICMS',   value: netIcms, color:'#0078BD' },
    { label:'COFINS', value: netCof,  color:'#2098D1' },
    { label:'PIS',    value: netPis,  color:'#32C4B3' },
    { label:'ISSQN',  value: netIss,  color:'#0B1E31' },
    { label:'IPI',    value: netIpi,  color:'#5FE3A1' }
  ].filter(x=>x.value>0).sort((a,b)=>b.value-a.value);

  const composicaoReforma = [
    { label:'IBS', value: netIBS, color:'#0078BD' },
    { label:'CBS', value: netCBS, color:'#32C4B3' },
    { label:'IS',  value: debIS,  color:'#0B1E31' }
  ].filter(x=>x.value>0).sort((a,b)=>b.value-a.value);

  return { cargaAtual, cargaReforma, yearly, breakdown, receitaBruta, composicaoAtual, composicaoReforma };
}

/* ========== RENDER ========== */
let chart, chartAtual, chartReforma, chartStack;

function tooltipConfig(){
  return {
    backgroundColor:'#0B1E31',
    titleColor:'#32C4B3',
    bodyColor:'#ffffff',
    borderColor:'rgba(50,196,179,.3)',
    borderWidth:1, padding:12, cornerRadius:8,
    titleFont:{family:'Inter',size:11,weight:'800'},
    bodyFont:{family:'Inter',size:12,weight:'600'},
    displayColors:true, boxPadding:4,
    callbacks:{
      label:(c)=>{
        const v = c.parsed.y !== undefined ? c.parsed.y : c.parsed;
        const pre = c.dataset.label ? c.dataset.label+': ' : '';
        return ' ' + pre + formatMoney(v);
      }
    }
  };
}

function render(data){
  const { cargaAtual, cargaReforma, yearly, breakdown, receitaBruta, composicaoAtual, composicaoReforma } = data;

  document.getElementById('kpi-atual').textContent   = formatMoney(cargaAtual);
  document.getElementById('kpi-reforma').textContent = formatMoney(cargaReforma);

  const deltaAbs = cargaReforma - cargaAtual;
  const deltaPct = cargaAtual>0 ? (deltaAbs/cargaAtual)*100 : 0;
  const deltaEl  = document.getElementById('kpi-delta');
  const chip     = document.getElementById('delta-chip');
  const absEl    = document.getElementById('kpi-delta-abs');
  const up = deltaAbs > 0;
  deltaEl.textContent = (up?'+':'') + formatPercent(deltaPct);
  deltaEl.classList.toggle('up', up);
  deltaEl.classList.toggle('down', !up);
  chip.textContent = (up?'▲ ':'▼ ') + formatMoney(Math.abs(deltaAbs));
  chip.classList.toggle('up', up);
  chip.classList.toggle('down', !up);
  absEl.textContent = up ? 'Aumento projetado de carga' : 'Redução projetada de carga';

  // Rate strip
  document.getElementById('r-receita').textContent = formatMoneyShort(receitaBruta);
  const effAtual = receitaBruta>0 ? (cargaAtual/receitaBruta*100) : 0;
  const effRef   = receitaBruta>0 ? (cargaReforma/receitaBruta*100) : 0;
  document.getElementById('r-eff-atual').textContent   = formatPercent(effAtual);
  document.getElementById('r-eff-reforma').textContent = formatPercent(effRef);
  const impact2033 = (yearly[2033] || 0) - cargaAtual;
  document.getElementById('r-impact-2033').textContent = (impact2033>=0?'+':'') + formatMoneyShort(Math.abs(impact2033));

  // Table
  const tbody = document.querySelector('#year-table tbody');
  const rows = [['Atual', cargaAtual, true], ...Object.entries(yearly).map(([y,v])=>[y,v,false])];
  const max = Math.max(...rows.map(r=>r[1]),1);
  tbody.innerHTML = rows.map(([y,v,hl])=>{
    const pct = cargaAtual>0 ? ((v-cargaAtual)/cargaAtual*100) : 0;
    const pctStr = cargaAtual>0 ? (pct>=0?'+':'') + pct.toFixed(1)+'%' : '—';
    const pctColor = pct>0 ? 'var(--danger)' : (pct<0 ? 'var(--teal-soft)' : 'var(--text-2)');
    const barW = Math.max(4, (v/max)*60);
    return `<tr class="${hl?'highlight':''}">
      <td>${y}</td>
      <td>${formatMoney(v)}<span class="bar" style="width:${barW}px"></span></td>
      <td style="color:${pctColor};font-weight:700">${pctStr}</td>
    </tr>`;
  }).join('');

  // Main bar chart
  const labels = ['Atual', ...Object.keys(yearly)];
  const values = [cargaAtual, ...Object.values(yearly)];
  if(chart){
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.update('none');
  } else {
    const ctx = document.getElementById('chart').getContext('2d');
    chart = new Chart(ctx,{
      type:'bar',
      data:{ labels, datasets:[{
        data:values,
        backgroundColor:(c)=>{
          if(c.dataIndex===0) return '#0B1E31';
          const g = c.chart.ctx.createLinearGradient(0,0,0,340);
          g.addColorStop(0,'#32C4B3'); g.addColorStop(1,'#2098D1');
          return g;
        },
        borderRadius:6, borderSkipped:false, hoverBackgroundColor:'#0078BD'
      }]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{ legend:{display:false}, tooltip:tooltipConfig() },
        scales:{
          x:{ grid:{display:false}, ticks:{color:'#4A5A6E',font:{family:'Inter',size:11,weight:'600'}}},
          y:{ grid:{color:'rgba(11,30,49,.06)'},
              ticks:{color:'#7E8A9A',font:{family:'Inter',size:10,weight:'500'},
                callback:(v)=> 'R$ ' + (v/1e6).toFixed(1) + 'M'} }
        }
      }
    });
  }

  // Donuts
  renderDonut('chart-atual', composicaoAtual, 'atual');
  renderDonut('chart-reforma', composicaoReforma, 'reforma');

  const total1 = composicaoAtual.reduce((s,i)=>s+i.value,0);
  document.getElementById('legend-atual').innerHTML = composicaoAtual.length
    ? composicaoAtual.map(i=>`
      <div class="legend-row">
        <div class="legend-left"><span class="legend-dot" style="background:${i.color}"></span>
          <span class="legend-label">${i.label}</span></div>
        <span class="legend-value">${formatMoney(i.value)} · ${total1>0?((i.value/total1)*100).toFixed(1):0}%</span>
      </div>`).join('')
    : '<div class="legend-row"><span class="legend-label" style="color:var(--text-3)">Sem dados</span></div>';

  const total2 = composicaoReforma.reduce((s,i)=>s+i.value,0);
  document.getElementById('legend-reforma').innerHTML = composicaoReforma.length
    ? composicaoReforma.map(i=>`
      <div class="legend-row">
        <div class="legend-left"><span class="legend-dot" style="background:${i.color}"></span>
          <span class="legend-label">${i.label}</span></div>
        <span class="legend-value">${formatMoney(i.value)} · ${total2>0?((i.value/total2)*100).toFixed(1):0}%</span>
      </div>`).join('')
    : '<div class="legend-row"><span class="legend-label" style="color:var(--text-3)">Sem dados</span></div>';

  // Stacked chart
  const years = Object.keys(breakdown);
  const dsLegFed = years.map(y=>breakdown[y].legFed);
  const dsLegInd = years.map(y=>breakdown[y].legInd);
  const dsCBS    = years.map(y=>breakdown[y].cbs);
  const dsIBS    = years.map(y=>breakdown[y].ibs);
  const dsIS     = years.map(y=>breakdown[y].is);

  if(chartStack){
    chartStack.data.labels = years;
    chartStack.data.datasets[0].data = dsLegFed;
    chartStack.data.datasets[1].data = dsLegInd;
    chartStack.data.datasets[2].data = dsCBS;
    chartStack.data.datasets[3].data = dsIBS;
    chartStack.data.datasets[4].data = dsIS;
    chartStack.update('none');
  } else {
    const ctx = document.getElementById('chart-stack').getContext('2d');
    chartStack = new Chart(ctx,{
      type:'bar',
      data:{ labels:years, datasets:[
        { label:'PIS/COFINS/IPI (legado)', data:dsLegFed, backgroundColor:'#CBD5DF', stack:'s', borderRadius:3 },
        { label:'ICMS/ISS (legado)',        data:dsLegInd, backgroundColor:'#0B1E31', stack:'s', borderRadius:3 },
        { label:'CBS',                       data:dsCBS,    backgroundColor:'#32C4B3', stack:'s', borderRadius:3 },
        { label:'IBS',                       data:dsIBS,    backgroundColor:'#2098D1', stack:'s', borderRadius:3 },
        { label:'IS',                        data:dsIS,     backgroundColor:'#0078BD', stack:'s', borderRadius:3 }
      ]},
      options:{
        responsive:true, maintainAspectRatio:false,
        plugins:{
          legend:{ position:'bottom', align:'start',
            labels:{color:'#0B1E31',font:{family:'Inter',size:11,weight:'600'},usePointStyle:true,pointStyle:'rectRounded',padding:14,boxWidth:10,boxHeight:10}},
          tooltip:tooltipConfig()
        },
        scales:{
          x:{ stacked:true, grid:{display:false}, ticks:{color:'#4A5A6E',font:{family:'Inter',size:11,weight:'600'}}},
          y:{ stacked:true, grid:{color:'rgba(11,30,49,.06)'},
              ticks:{color:'#7E8A9A',font:{family:'Inter',size:10,weight:'500'},
                callback:(v)=> 'R$ ' + (v/1e6).toFixed(1) + 'M'}}
        }
      }
    });
  }
}

function renderDonut(canvasId, items, key){
  const data = items.map(i=>i.value);
  const colors = items.map(i=>i.color);
  const labels = items.map(i=>i.label);

  let inst = key==='atual' ? chartAtual : chartReforma;
  if(inst){
    inst.data.labels = labels;
    inst.data.datasets[0].data = data;
    inst.data.datasets[0].backgroundColor = colors;
    inst.update('none');
    return;
  }
  if(!data.length) return;
  const ctx = document.getElementById(canvasId).getContext('2d');
  const newChart = new Chart(ctx,{
    type:'doughnut',
    data:{ labels, datasets:[{ data, backgroundColor:colors, borderColor:'#fff', borderWidth:3, hoverOffset:6 }]},
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'68%',
      plugins:{ legend:{display:false}, tooltip:tooltipConfig() }
    }
  });
  if(key==='atual') chartAtual = newChart;
  else chartReforma = newChart;
}

function compute(){
  render(computeAll());
  renderPriceSim();
}

/* ==========================================================
   PRICE SIMULATOR — Sale price formation under both regimes
   ==========================================================
   Methodology (validated with accounting best-practices):

   CURRENT REGIME (non-cumulative / Lucro Real):
   --------------------------------------------
   - ICMS, PIS, COFINS, ISS are charged "por dentro" (inside the
     gross sale price). IPI is charged "por fora" (added on top).
   - Credits on purchases: PIS, COFINS, ICMS, IPI.
   - Net cost after credits = Cost × (1 - credit-rate mix).
   - Sale price formula (mark-up divisor):
         PV = NetCost / (1 - ICMS% - PIS% - COFINS% - Expenses% - Margin%)
     For products: Final customer price = PV × (1 + IPI%).
     For services: ISS replaces ICMS; no IPI.

   POST-REFORM REGIME (CBS + IBS + IS):
   ------------------------------------
   - CBS, IBS and IS are charged "por fora" (on top of base price).
   - Broad 100% non-cumulativity: every taxed purchase generates credit.
   - Net cost = Cost × (1 - CBS% - IBS%). (IS does not generate credit.)
   - Base price = NetCost / (1 - Expenses% - Margin%)
     Final customer price = BasePrice × (1 + CBS% + IBS% + IS%).

   HYBRID YEARS (2027–2032):
   -------------------------
   - CBS fully active; PIS/COFINS/IPI extinct from 2027.
   - ICMS/ISS preserved but with gradually reduced rates.
   - IBS introduced with a progressive share.
   - The simulator applies the year's reduction factor to ICMS/ISS and
     the year's share to IBS. Credits from the hybrid basket remain
     consistent with the schedule used in the main calculation.
   ========================================================== */

const PS_SCHEDULE = {
  2027: { icmsIssFactor:1.00, ibsFactor:0.00 }, /* IBS test ignored for pricing */
  2029: { icmsIssFactor:0.90, ibsFactor:0.10 },
  2030: { icmsIssFactor:0.80, ibsFactor:0.20 },
  2031: { icmsIssFactor:0.70, ibsFactor:0.30 },
  2032: { icmsIssFactor:0.60, ibsFactor:0.40 },
  2033: { icmsIssFactor:0.00, ibsFactor:1.00 }
};

// Price simulator rates. Inputs in section 06 take precedence; company data is only a fallback.
function derivedRates(){
  const recProd = getVal('rec_produtos');
  const recServ = getVal('rec_servicos');
  const recOut  = getVal('rec_outras');
  const baseReceita = recProd + recServ + recOut;

  const aqProd = getVal('aq_produtos');
  const aqServ = getVal('aq_servicos');
  const aqAtiv = getVal('aq_ativos');
  const aqAlug = getVal('aq_alugueis');
  const baseAquis = aqProd + aqServ + aqAtiv + aqAlug;

  // Débito/receita (sale-side rates)
  const r = (num, den) => (den > 0 ? num/den : 0);
  const aliqIcms   = r(getVal('imp_icms'),   baseReceita);
  const aliqIss    = r(getVal('imp_issqn'),  baseReceita);
  const aliqIpi    = r(getVal('imp_ipi'),    baseReceita);
  const aliqPis    = r(getVal('imp_pis'),    baseReceita);
  const aliqCofins = r(getVal('imp_cofins'), baseReceita);

  // Crédito/aquisição (purchase-side rates)
  const credIcms   = r(getVal('cr_icms'),   baseAquis);
  const credIpi    = r(getVal('cr_ipi'),    baseAquis);
  const credPis    = r(getVal('cr_pis'),    baseAquis);
  const credCofins = r(getVal('cr_cofins'), baseAquis);

  // Fallback to typical Lucro Real rates when the company has no data
  const fallback = (v, def) => v > 0 ? v : def;
  const priceRate = (id, def) => {
    const input = document.getElementById(id);
    return input ? parsePercent(input.value) / 100 : def;
  };

  return {
    sale: {
      icms:   priceRate('ps_icms',   fallback(aliqIcms,   0.18)),
      iss:    priceRate('ps_iss',    fallback(aliqIss,    0.05)),
      ipi:    priceRate('ps_ipi',    aliqIpi),
      pis:    priceRate('ps_pis',    fallback(aliqPis,    0.0165)),
      cofins: priceRate('ps_cofins', fallback(aliqCofins, 0.076))
    },
    credit: {
      icms:   priceRate('ps_cr_icms',   credIcms   > 0 ? credIcms   : 0.18),
      ipi:    priceRate('ps_cr_ipi',    credIpi),
      pis:    priceRate('ps_cr_pis',    credPis    > 0 ? credPis    : 0.0165),
      cofins: priceRate('ps_cr_cofins', credCofins > 0 ? credCofins : 0.076)
    },
    reform: {
      cbs: priceRate('ps_cbs', getPct('aliq_cbs')),
      ibs: priceRate('ps_ibs', getPct('aliq_ibs')),
      is:  priceRate('ps_is',  getPct('aliq_is')),
      creditBase: priceRate('ps_ref_credit_base', 1),
      creditCbs: priceRate('ps_cr_cbs', getPct('aliq_cbs')),
      creditIbs: priceRate('ps_cr_ibs', getPct('aliq_ibs'))
    }
  };
}

// Compute current-regime pricing
function priceCurrent({ tipo, cost, expRate, margRate, ipiRate, rates }){
  const s = rates.sale, c = rates.credit;
  const isProduct = tipo === 'produto';

  // Credits absorbed in the cost
  const creditRate = isProduct
    ? (c.icms + c.ipi + c.pis + c.cofins)
    : (c.pis + c.cofins);
  const credits = cost * creditRate;
  const netCost = cost - credits;

  // "Por dentro" total on the sale price
  const saleInRate = isProduct
    ? (s.icms + s.pis + s.cofins)
    : (s.iss  + s.pis + s.cofins);

  const divisor = 1 - saleInRate - expRate - margRate;

  if (divisor <= 0) {
    return { invalid:true, netCost, credits, saleInRate, divisor };
  }

  const salePrice = netCost / divisor;                // price before IPI
  const taxIcmsIss = isProduct ? salePrice * s.icms : salePrice * s.iss;
  const taxPis     = salePrice * s.pis;
  const taxCofins  = salePrice * s.cofins;
  const taxInSide  = salePrice * saleInRate;
  const ipiAmt     = isProduct ? salePrice * (ipiRate || s.ipi) : 0;
  const finalPrice = salePrice + ipiAmt;

  const expenses   = salePrice * expRate;
  const margin     = salePrice * margRate;
  const totalTax   = taxInSide + ipiAmt;

  return {
    invalid:false, tipo, cost, netCost, credits,
    salePrice, finalPrice, expenses, margin, totalTax,
    taxIcmsIss, taxPis, taxCofins, ipiAmt,
    saleInRate, ipiRate: isProduct ? (ipiRate || s.ipi) : 0,
    marginEffective: finalPrice > 0 ? margin / finalPrice : 0
  };
}

// Compute post-reform pricing (pure 2033 or hybrid year)
function priceReform({ tipo, cost, expRate, margRate, ano, rates }){
  const isProduct = tipo === 'produto';
  const r = rates.reform;
  const s = rates.sale;
  const sched = PS_SCHEDULE[ano] || PS_SCHEDULE[2033];

  // Hybrid legacy portion (ICMS or ISS, "por dentro"), with year's factor
  const legacyInRate = isProduct
    ? s.icms * sched.icmsIssFactor
    : s.iss  * sched.icmsIssFactor;

  const cbsRate = r.cbs;                 // full CBS from 2027 onward
  const ibsRate = r.ibs * sched.ibsFactor;
  const isRate  = r.is;                  // Imposto Seletivo (por fora)

  // Credits on purchase. Debit and credit rates can differ from sale rates.
  const creditBaseRate = Math.max(0, Math.min(1, r.creditBase));
  const creditCbsRate = r.creditCbs;
  const creditIbsRate = r.creditIbs * sched.ibsFactor;
  const creditRate = creditCbsRate + creditIbsRate;
  const grossCredits = cost * creditBaseRate * creditRate;
  const credits = Math.min(cost, grossCredits);
  const netCost = cost - credits;

  // "Por dentro" divisor now includes the hybrid legacy portion
  const divisor = 1 - legacyInRate - expRate - margRate;

  if (divisor <= 0) {
    return { invalid:true, netCost, credits, divisor };
  }

  const basePrice  = netCost / divisor;   // price before por-fora (CBS/IBS/IS)
  const taxLegacy  = basePrice * legacyInRate;
  const taxCbs     = basePrice * cbsRate;
  const taxIbs     = basePrice * ibsRate;
  const taxIs      = basePrice * isRate;
  const outsideTax = taxCbs + taxIbs + taxIs;
  const finalPrice = basePrice + outsideTax;

  const expenses = basePrice * expRate;
  const margin   = basePrice * margRate;
  const totalTax = taxLegacy + outsideTax;

  return {
    invalid:false, tipo, cost, netCost, credits,
    basePrice, finalPrice, expenses, margin, totalTax,
    taxLegacy, taxCbs, taxIbs, taxIs,
    legacyInRate, cbsRate, ibsRate, isRate,
    creditBaseRate, creditCbsRate, creditIbsRate, creditRate,
    marginEffective: finalPrice > 0 ? margin / finalPrice : 0
  };
}

function renderPriceSim(){
  const tipoEl = document.querySelector('.ps-type-tab.active');
  const tipo   = tipoEl ? tipoEl.getAttribute('data-tipo') : 'produto';
  const cost     = parseMoney(document.getElementById('ps_custo').value);
  const expRate  = parsePercent(document.getElementById('ps_desp').value)   / 100;
  const margRate = parsePercent(document.getElementById('ps_margem').value) / 100;
  const ipiRate  = parsePercent(document.getElementById('ps_ipi').value)    / 100;
  const ano      = parseInt(document.getElementById('ps_ano').value, 10) || 2033;

  // Badge for the reform side
  const badgeLabels = {
    2027:'2027 · CBS integral', 2029:'2029 · Transição 10%',
    2030:'2030 · Transição 20%', 2031:'2031 · Transição 30%',
    2032:'2032 · Transição 40%', 2033:'2033 · IVA pleno'
  };
  document.getElementById('ps_reforma_badge').textContent = badgeLabels[ano] || '2033 · IVA pleno';

  // Hide IPI input for services
  const ipiField = document.getElementById('ps_ipi').closest('.field');
  if (ipiField) ipiField.style.opacity = (tipo === 'servico') ? '.45' : '1';
  ['ps_icms','ps_cr_icms','ps_cr_ipi'].forEach(id => {
    const field = document.getElementById(id)?.closest('.field');
    if (field) field.style.opacity = (tipo === 'servico') ? '.45' : '1';
  });
  ['ps_iss'].forEach(id => {
    const field = document.getElementById(id)?.closest('.field');
    if (field) field.style.opacity = (tipo === 'produto') ? '.45' : '1';
  });

  const rates = derivedRates();
  const atual   = priceCurrent({ tipo, cost, expRate, margRate, ipiRate, rates });
  const reforma = priceReform ({ tipo, cost, expRate, margRate, ano,     rates });

  // Warning on invalid configuration (divisor <= 0)
  const warnEl  = document.getElementById('ps_warn');
  const warnMsg = document.getElementById('ps_warn_msg');
  if (atual.invalid || reforma.invalid) {
    warnEl.style.display = 'flex';
    warnMsg.textContent = 'A soma de tributos + despesas + margem ultrapassa 100% do preço. Reduza a margem ou as despesas para que o cálculo seja viável.';
  } else {
    warnEl.style.display = 'none';
  }

  // --- ATUAL breakdown ---
  const brAtual = document.getElementById('ps_atual_breakdown');
  if (atual.invalid) {
    brAtual.innerHTML = '<div class="ps-breakdown-row"><span class="ps-row-label">Cálculo inviável</span><span class="ps-row-value">—</span></div>';
    document.getElementById('ps_atual_final').textContent  = '—';
    document.getElementById('ps_atual_trib').textContent   = '—';
    document.getElementById('ps_atual_margem').textContent = '—';
  } else {
    const tributoPrincipal = tipo === 'produto' ? 'ICMS' : 'ISS';
    const rowsAtual = [
      ['Custo de aquisição', atual.cost,           '#7E8A9A', 'main'],
      ['Créditos na entrada', -atual.credits,      '#32C4B3', 'sub'],
      ['Custo líquido',       atual.netCost,       '#0B1E31', 'main'],
      ['Despesas operacionais', atual.expenses,    '#CBD5DF', 'sub'],
      ['Margem de lucro',       atual.margin,      '#2098D1', 'sub'],
      [tributoPrincipal,        atual.taxIcmsIss,  '#0078BD', 'sub'],
      ['PIS',                   atual.taxPis,      '#32C4B3', 'sub'],
      ['COFINS',                atual.taxCofins,   '#2098D1', 'sub']
    ];
    if (tipo === 'produto' && atual.ipiAmt > 0) rowsAtual.push(['IPI (por fora)', atual.ipiAmt, '#5FE3A1', 'sub']);
    rowsAtual.push(['Preço final ao cliente', atual.finalPrice, '#0B1E31', 'total']);

    brAtual.innerHTML = rowsAtual.map(([lbl,val,col,kind]) => {
      const cls = kind === 'sub' ? 'ps-row-sub' : (kind === 'total' ? 'ps-row-total' : '');
      return `<div class="ps-breakdown-row ${cls}">
        <span class="ps-row-label"><span class="ps-row-dot" style="background:${col}"></span>${lbl}</span>
        <span class="ps-row-value">${formatMoney(val)}</span>
      </div>`;
    }).join('');

    document.getElementById('ps_atual_final').textContent  = formatMoney(atual.finalPrice);
    document.getElementById('ps_atual_trib').textContent   = formatMoney(atual.totalTax);
    document.getElementById('ps_atual_margem').textContent = formatMoney(atual.margin)
      + ' · ' + formatPercent(atual.marginEffective * 100);
  }

  // --- REFORMA breakdown ---
  const brReforma = document.getElementById('ps_reforma_breakdown');
  if (reforma.invalid) {
    brReforma.innerHTML = '<div class="ps-breakdown-row"><span class="ps-row-label">Cálculo inviável</span><span class="ps-row-value">—</span></div>';
    document.getElementById('ps_reforma_final').textContent  = '—';
    document.getElementById('ps_reforma_trib').textContent   = '—';
    document.getElementById('ps_reforma_margem').textContent = '—';
  } else {
    const rowsRef = [
      ['Custo de aquisição',   reforma.cost,      '#7E8A9A', 'main'],
      ['Créditos CBS + IBS',   -reforma.credits,  '#32C4B3', 'sub'],
      ['Custo líquido',        reforma.netCost,   '#0B1E31', 'main'],
      ['Despesas operacionais', reforma.expenses, '#CBD5DF', 'sub'],
      ['Margem de lucro',       reforma.margin,   '#2098D1', 'sub']
    ];
    if (reforma.creditBaseRate < 0.999 && reforma.cost > 0) {
      rowsRef.splice(1, 0, ['Custo sem credito', reforma.cost * (1 - reforma.creditBaseRate), '#CBD5DF', 'sub']);
    }
    if (reforma.taxLegacy > 0) {
      const legLbl = tipo === 'produto' ? 'ICMS residual' : 'ISS residual';
      rowsRef.push([legLbl, reforma.taxLegacy, '#CBD5DF', 'sub']);
    }
    if (reforma.taxCbs > 0) rowsRef.push(['CBS (por fora)', reforma.taxCbs, '#32C4B3', 'sub']);
    if (reforma.taxIbs > 0) rowsRef.push(['IBS (por fora)', reforma.taxIbs, '#2098D1', 'sub']);
    if (reforma.taxIs  > 0) rowsRef.push(['IS (por fora)',  reforma.taxIs,  '#0078BD', 'sub']);
    rowsRef.push(['Preço final ao cliente', reforma.finalPrice, '#0B1E31', 'total']);

    brReforma.innerHTML = rowsRef.map(([lbl,val,col,kind]) => {
      const cls = kind === 'sub' ? 'ps-row-sub' : (kind === 'total' ? 'ps-row-total' : '');
      return `<div class="ps-breakdown-row ${cls}">
        <span class="ps-row-label"><span class="ps-row-dot" style="background:${col}"></span>${lbl}</span>
        <span class="ps-row-value">${formatMoney(val)}</span>
      </div>`;
    }).join('');

    document.getElementById('ps_reforma_final').textContent  = formatMoney(reforma.finalPrice);
    document.getElementById('ps_reforma_trib').textContent   = formatMoney(reforma.totalTax);
    document.getElementById('ps_reforma_margem').textContent = formatMoney(reforma.margin)
      + ' · ' + formatPercent(reforma.marginEffective * 100);
  }

  // --- DELTA ---
  const arrow = document.getElementById('ps_delta_arrow');
  const pctEl = document.getElementById('ps_delta_pct');
  const absEl = document.getElementById('ps_delta_abs');
  const hintEl= document.getElementById('ps_delta_hint');

  if (atual.invalid || reforma.invalid) {
    arrow.className = 'ps-delta-arrow neutral';
    arrow.textContent = '=';
    pctEl.className = 'ps-delta-pct neutral';
    pctEl.textContent = '—';
    absEl.textContent = '—';
    hintEl.textContent = 'Ajuste os parâmetros para simular.';
  } else {
    const diffAbs = reforma.finalPrice - atual.finalPrice;
    const diffPct = atual.finalPrice > 0 ? (diffAbs / atual.finalPrice) * 100 : 0;
    const up   = diffAbs > 0.005;
    const down = diffAbs < -0.005;
    const dir  = up ? 'up' : (down ? 'down' : 'neutral');

    arrow.className = 'ps-delta-arrow ' + dir;
    arrow.textContent = up ? '▲' : (down ? '▼' : '=');
    pctEl.className = 'ps-delta-pct ' + dir;
    pctEl.textContent = (up ? '+' : '') + formatPercent(diffPct);
    absEl.textContent = (up ? '+' : '') + formatMoney(diffAbs);

    if (up) {
      hintEl.textContent = 'Com estas alíquotas, o preço ao cliente sobe na reforma. Avalie rever margem, renegociar custos ou pleitear créditos específicos.';
    } else if (down) {
      hintEl.textContent = 'A reforma reduz o preço ao cliente mantendo sua margem — a não-cumulatividade ampla favorece o negócio neste cenário.';
    } else {
      hintEl.textContent = 'O impacto no preço é praticamente neutro.';
    }
  }

}

// Wire up tabs and year selector
document.querySelectorAll('.ps-type-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.ps-type-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderPriceSim();
  });
});
document.getElementById('ps_ano').addEventListener('change', renderPriceSim);
initializeEmptySimulator();
setupJsonImport();
compute();
