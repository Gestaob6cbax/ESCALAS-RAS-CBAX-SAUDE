// ====== CONFIGURAÇÃO ======
// 1) URL do seu "backend" (Google Apps Script). Você vai colar depois.
const API_URL = ""; // ex: "https://script.google.com/macros/s/XXXX/exec"

// 2) Onde está o JSON do mês
const DATA_URL = "data/marco_2026_sobreaviso.json";

// 3) Regras simples de PIN (apenas exemplo)
// Recomendado: validar PIN no Google Sheets (mais seguro).
// Aqui deixo local como fallback.
const PIN_FALLBACK = {
  "42871": "1234"
};

// ====== ESTADO ======
let session = null;
let dadosMes = null;
let minhas = []; // escolhas do usuário logado

// ====== HELPERS ======
const $ = (id) => document.getElementById(id);

function setMsg(el, msg){ el.textContent = msg || ""; }

function isVaga(item){
  return (item.status_sobreaviso || "").toUpperCase() === "VAGA";
}

function renderVagas(lista){
  const root = $("listaVagas");
  root.innerHTML = "";
  const vagas = lista.filter(isVaga);

  if (vagas.length === 0){
    root.innerHTML = `<div class="item"><h4>Sem vagas</h4><p class="muted small">Nenhuma vaga disponível no período.</p></div>`;
    return;
  }

  for (const v of vagas){
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <h4>${v.data} <span class="badge">${v.ala_servico}</span></h4>
      <p class="muted">Sobreaviso do dia: <b>${v.militar_sobreaviso}</b> (${v.ala_sobreaviso})</p>
      <p class="muted small">Cobre: <b>${v.cobre_ala || "-"}</b> · Motivo: ${v.motivo || "-"}</p>
      <button data-data="${v.data}">Selecionar esta vaga</button>
    `;
    div.querySelector("button").addEventListener("click", () => escolherVaga(v));
    root.appendChild(div);
  }
}

function renderMinhas(){
  const root = $("listaMinhas");
  root.innerHTML = "";
  if (minhas.length === 0){
    root.innerHTML = `<div class="item"><h4>Nenhuma escolha</h4><p class="muted small">Você ainda não selecionou vaga.</p></div>`;
    return;
  }
  for (const e of minhas){
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <h4>${e.data} <span class="badge">${e.ala_servico}</span></h4>
      <p class="muted">Status: <b>${e.status || "PENDENTE"}</b></p>
      <p class="muted small">Cobre: <b>${e.cobre_ala || "-"}</b> · Obs: ${e.obs || "-"}</p>
    `;
    root.appendChild(div);
  }
}

async function carregarMes(){
  setMsg($("status"), "Carregando dados do mês...");
  const r = await fetch(DATA_URL, { cache: "no-store" });
  dadosMes = await r.json();
  setMsg($("status"), `Dados carregados: ${dadosMes.mes}.`);
  renderVagas(dadosMes.itens || []);
}

// ====== LOGIN ======
$("btnLogin").addEventListener("click", async () => {
  const matricula = $("matricula").value.trim();
  const pin = $("pin").value.trim();

  if (!matricula || !pin){
    return setMsg($("loginMsg"), "Informe matrícula e PIN.");
  }

  // Se tiver API (planilha), valida lá. Senão usa fallback local.
  if (API_URL){
    try{
      const r = await fetch(`${API_URL}?action=login&matricula=${encodeURIComponent(matricula)}&pin=${encodeURIComponent(pin)}`);
      const j = await r.json();
      if (!j.ok) return setMsg($("loginMsg"), j.error || "Falha no login.");
      session = { matricula, nome: j.nome || matricula };
    }catch(e){
      return setMsg($("loginMsg"), "Erro ao conectar no servidor. Tente novamente.");
    }
  } else {
    const ok = PIN_FALLBACK[matricula] && PIN_FALLBACK[matricula] === pin;
    if (!ok) return setMsg($("loginMsg"), "PIN inválido (modo local).");
    session = { matricula, nome: matricula };
  }

  // entrou
  $("loginCard").classList.add("hidden");
  $("appCard").classList.remove("hidden");
  $("welcome").textContent = `Bem-vindo(a), ${session.nome} (${session.matricula})`;
  setMsg($("loginMsg"), "");
});

// Sair
$("btnSair").addEventListener("click", () => {
  session = null;
  minhas = [];
  $("appCard").classList.add("hidden");
  $("loginCard").classList.remove("hidden");
  $("matricula").value = "";
  $("pin").value = "";
});

// Carregar vagas
$("btnCarregar").addEventListener("click", carregarMes);

// Minhas escolhas
$("btnMinhas").addEventListener("click", async () => {
  if (!session) return;
  if (API_URL){
    const r = await fetch(`${API_URL}?action=minhas&matricula=${encodeURIComponent(session.matricula)}`);
    const j = await r.json();
    minhas = j.itens || [];
  }
  renderMinhas();
});

// Escolher vaga
async function escolherVaga(v){
  if (!session) return;

  const obs = prompt("Observação (opcional):") || "";

  // salva local (sempre)
  minhas.push({
    data: v.data,
    ala_servico: v.ala_servico,
    ala_sobreaviso: v.ala_sobreaviso,
    cobre_ala: v.cobre_ala,
    status: "PENDENTE",
    obs
  });
  renderMinhas();

  // envia para planilha (se tiver API)
  if (API_URL){
    await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "escolher",
        matricula: session.matricula,
        data: v.data,
        ala_servico: v.ala_servico,
        ala_sobreaviso: v.ala_sobreaviso,
        cobre_ala: v.cobre_ala,
        obs
      })
    });
  }

  alert("Escolha registrada!");
}

// Exportar minhas escolhas em Excel (no celular também)
$("btnExportar").addEventListener("click", () => {
  if (minhas.length === 0) return alert("Sem escolhas para exportar.");

  const ws = XLSX.utils.json_to_sheet(minhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "MinhasEscolhas");
  XLSX.writeFile(wb, `minhas_escolhas_${session?.matricula || "usuario"}.xlsx`);
});
