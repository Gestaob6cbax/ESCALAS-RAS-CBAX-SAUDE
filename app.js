// ====== CONFIGURAÇÃO ======
const API_URL =
  "https://script.google.com/macros/s/AKfycbxZjCTcP4yBNgMVVukHBeTlmMryUKSQP2p3ZIkMs5JyOR9uS2bd7QoEsqSyCeAddDQP/exec";

const DATA_URL = "data/marco_2026_sobreaviso.json";

// fallback local (só usado se API_URL estiver vazio)
const PIN_FALLBACK = {
  "42871": "1234",
};

// ====== ESTADO ======
let session = null; // { matricula, nome, perfil }
let dadosMes = null; // JSON do mês
let minhas = []; // escolhas do usuário (vindas da planilha e/ou local)

// ====== HELPERS ======
const $ = (id) => document.getElementById(id);

function setMsg(el, msg) {
  el.textContent = msg || "";
}

function isVaga(item) {
  return String(item.status_sobreaviso || "")
    .trim()
    .toUpperCase() === "VAGA";
}

function chaveEscolha(e) {
  // chave simples para deduplicar (matricula + data)
  return `${session?.matricula || ""}__${String(e.data || "").trim()}`;
}

function jaEscolheuData(dataISO) {
  const d = String(dataISO || "").trim();
  return minhas.some((e) => String(e.data || "").trim() === d);
}

function sortPorData(arr) {
  return [...arr].sort((a, b) => String(a.data).localeCompare(String(b.data)));
}

async function apiGet(params) {
  const url = `${API_URL}?${params}`;
  const r = await fetch(url, { cache: "no-store" });
  return await r.json();
}

async function apiPost(obj) {
  const r = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(obj),
  });

  // se o Apps Script retornar HTML por algum motivo, isso evita quebrar silencioso
  const txt = await r.text();
  try {
    return JSON.parse(txt);
  } catch {
    return { ok: false, error: "Resposta não-JSON do servidor.", raw: txt };
  }
}

// ====== RENDER ======
function renderVagas(lista) {
  const root = $("listaVagas");
  root.innerHTML = "";

  const vagas = lista.filter(isVaga);

  if (vagas.length === 0) {
    root.innerHTML = `<div class="item"><h4>Sem vagas</h4><p class="muted small">Nenhuma vaga disponível no período.</p></div>`;
    return;
  }

  for (const v of sortPorData(vagas)) {
    const escolhido = jaEscolheuData(v.data);

    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <h4>${v.data} <span class="badge">${v.ala_servico}</span></h4>
      <p class="muted">Sobreaviso do dia: <b>${v.militar_sobreaviso}</b> (${v.ala_sobreaviso})</p>
      <p class="muted small">Cobre: <b>${v.cobre_ala || "-"}</b> · Motivo: ${v.motivo || "-"}</p>
      <button ${escolhido ? "disabled" : ""}>
        ${escolhido ? "Já selecionado" : "Selecionar esta vaga"}
      </button>
    `;

    const btn = div.querySelector("button");
    btn.addEventListener("click", () => escolherVaga(v));
    root.appendChild(div);
  }
}

function renderMinhas() {
  const root = $("listaMinhas");
  root.innerHTML = "";

  if (!minhas || minhas.length === 0) {
    root.innerHTML = `<div class="item"><h4>Nenhuma escolha</h4><p class="muted small">Você ainda não selecionou vaga.</p></div>`;
    return;
  }

  for (const e of sortPorData(minhas)) {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <h4>${e.data} <span class="badge">${e.ala_servico}</span></h4>
      <p class="muted">Status: <b>${e.status || "PENDENTE"}</b></p>
      <p class="muted small">Sobreaviso: <b>${e.ala_sobreaviso || "-"}</b> · Cobre: <b>${e.cobre_ala || "-"}</b></p>
      <p class="muted small">Obs: ${e.obs || "-"}</p>
    `;
    root.appendChild(div);
  }
}

// ====== DADOS DO MÊS ======
async function carregarMes() {
  try {
    setMsg($("status"), "Carregando dados do mês...");
    const r = await fetch(DATA_URL, { cache: "no-store" });
    if (!r.ok) throw new Error("Não foi possível carregar o arquivo de dados do mês.");
    dadosMes = await r.json();
    setMsg($("status"), `Dados carregados: ${dadosMes.mes}.`);
    renderVagas(dadosMes.itens || []);
  } catch (e) {
    setMsg($("status"), `Erro: ${e.message || e}`);
  }
}

// ====== LOGIN ======
$("btnLogin").addEventListener("click", async () => {
  const matricula = $("matricula").value.trim();
  const pin = $("pin").value.trim();

  if (!matricula || !pin) {
    return setMsg($("loginMsg"), "Informe matrícula e PIN.");
  }

  // Se tiver API, valida na planilha; senão fallback
  if (API_URL) {
    try {
      const j = await apiGet(
        `action=login&matricula=${encodeURIComponent(matricula)}&pin=${encodeURIComponent(pin)}`
      );
      if (!j.ok) return setMsg($("loginMsg"), j.error || "Falha no login.");

      session = { matricula, nome: j.nome || matricula, perfil: j.perfil || "MILITAR" };
    } catch (e) {
      return setMsg($("loginMsg"), "Erro ao conectar no servidor. Tente novamente.");
    }
  } else {
    const ok = PIN_FALLBACK[matricula] && PIN_FALLBACK[matricula] === pin;
    if (!ok) return setMsg($("loginMsg"), "PIN inválido (modo local).");
    session = { matricula, nome: matricula, perfil: "MILITAR" };
  }

  // entrou
  $("loginCard").classList.add("hidden");
  $("appCard").classList.remove("hidden");
  $("welcome").textContent = `Bem-vindo(a), ${session.nome} (${session.matricula})`;
  setMsg($("loginMsg"), "");

  // carrega automaticamente as escolhas do militar (se API ativa)
  await carregarMinhas();
});

// Sair
$("btnSair").addEventListener("click", () => {
  session = null;
  minhas = [];
  dadosMes = null;

  $("appCard").classList.add("hidden");
  $("loginCard").classList.remove("hidden");
  $("matricula").value = "";
  $("pin").value = "";

  $("listaVagas").innerHTML = "";
  $("listaMinhas").innerHTML = "";
  setMsg($("status"), "");
  setMsg($("loginMsg"), "");
});

// Botões
$("btnCarregar").addEventListener("click", carregarMes);

$("btnMinhas").addEventListener("click", async () => {
  await carregarMinhas();
});

// ====== MINHAS ESCOLHAS (API) ======
async function carregarMinhas() {
  if (!session) return;

  if (API_URL) {
    const j = await apiGet(`action=minhas&matricula=${encodeURIComponent(session.matricula)}`);
    if (!j.ok) {
      alert("Erro ao carregar suas escolhas: " + (j.error || "erro"));
      return;
    }
    minhas = j.itens || [];
  }

  renderMinhas();

  // Atualiza lista de vagas (para desativar botões de datas já escolhidas)
  if (dadosMes?.itens) renderVagas(dadosMes.itens);
}

// ====== ESCOLHER VAGA ======
async function escolherVaga(v) {
  if (!session) return;

  if (jaEscolheuData(v.data)) {
    alert("Você já registrou escolha para esta data.");
    return;
  }

  const obs = prompt("Observação (opcional):") || "";

  // envia para planilha (se tiver API)
  if (API_URL) {
    const j = await apiPost({
      action: "escolher",
      matricula: session.matricula,
      data: v.data,
      ala_servico: v.ala_servico,
      ala_sobreaviso: v.ala_sobreaviso,
      cobre_ala: v.cobre_ala,
      obs,
    });

    if (!j.ok) {
      alert("Não salvou na planilha: " + (j.error || "erro desconhecido"));
      return;
    }
  }

  // atualiza local (depois do ok)
  minhas.push({
    data: v.data,
    ala_servico: v.ala_servico,
    ala_sobreaviso: v.ala_sobreaviso,
    cobre_ala: v.cobre_ala,
    status: "PENDENTE",
    obs,
  });

  renderMinhas();
  if (dadosMes?.itens) renderVagas(dadosMes.itens);

  alert("Escolha registrada na planilha!");
}

// ====== EXPORTAR MINHAS ESCOLHAS ======
$("btnExportar").addEventListener("click", () => {
  if (!minhas || minhas.length === 0) return alert("Sem escolhas para exportar.");

  // XLSX está no index.html (CDN)
  const ws = XLSX.utils.json_to_sheet(sortPorData(minhas));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "MinhasEscolhas");

  const mat = session?.matricula || "usuario";
  XLSX.writeFile(wb, `minhas_escolhas_${mat}.xlsx`);
});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "MinhasEscolhas");
  XLSX.writeFile(wb, `minhas_escolhas_${session?.matricula || "usuario"}.xlsx`);
});
