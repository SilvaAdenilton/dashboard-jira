import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from "recharts";

const CSV_FILES = [
  "2026 - 6.200 (JIRA).csv",
  "2026 - 6.300 (JIRA).csv",
  "2026 - 6.400 (JIRA).csv",
  "2026 - 6.500 (JIRA).csv",
  "2026 - 6.600 (JIRA).csv",
  "2026 - 6.700 (JIRA).csv",
  "2026 - 6.800 (JIRA).csv",
  "2026 - Tempo por Unidade (JIRA).csv",
  "2026-FEV (JIRA).csv",
  "2026-JAN (JIRA).csv",
  "Jira.csv",
  "Jira.csv_1.csv",
  "Jira.csv_2.csv",
  "Jira.csv_3.csv",
  "Jira.csv_4.csv",
];

const COLORS = ["#38bdf8", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#eab308"];

function cleanKey(value) {
  return String(value || "")
    .replace("\ufeff", "")
    .trim();
}

function getValue(row, names) {
  for (const name of names) {
    const foundKey = Object.keys(row).find(
      (key) => cleanKey(key).toLowerCase() === cleanKey(name).toLowerCase()
    );
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== "") {
      return row[foundKey];
    }
  }
  return "";
}

function parseDate(value) {
  if (!value) return null;

  const raw = String(value).trim();

  const months = {
    jan: "01",
    fev: "02",
    mar: "03",
    abr: "04",
    mai: "05",
    jun: "06",
    jul: "07",
    ago: "08",
    set: "09",
    out: "10",
    nov: "11",
    dez: "12",
  };

  const match = raw.toLowerCase().match(/(\d{1,2})\/([a-zç]{3})\/(\d{2,4})/);
  if (match) {
    const day = match[1].padStart(2, "0");
    const month = months[match[2].substring(0, 3)] || "01";
    let year = match[3];
    if (year.length === 2) year = `20${year}`;
    return new Date(`${year}-${month}-${day}T00:00:00`);
  }

  const direct = new Date(raw);
  if (!isNaN(direct.getTime())) return direct;

  return null;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "-";
  return date.toLocaleDateString("pt-BR");
}

function daysBetween(start, end) {
  const a = parseDate(start);
  const b = parseDate(end);
  if (!a || !b) return null;
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

function groupCount(data, field, fallback = "Não informado") {
  const map = {};
  data.forEach((item) => {
    const key = item[field] || fallback;
    map[key] = (map[key] || 0) + 1;
  });
  return Object.entries(map)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

function normalizeRow(row, fileName) {
  const resumo = getValue(row, ["Resumo"]);
  const chave = getValue(row, ["Chave da item", "Chave do item", "Issue key", "Chave"]);
  const tipo = getValue(row, ["Tipo de item", "Issue Type", "Tipo"]);
  const status = getValue(row, ["Status"]);
  const prioridade = getValue(row, ["Prioridade", "Priority"]);
  const responsavel = getValue(row, ["Responsável", "Assignee"]);
  const relator = getValue(row, ["Relator", "Reporter"]);
  const criado = getValue(row, ["Criado", "Created"]);
  const atualizado = getValue(row, ["Atualizado(a)", "Atualizado", "Updated"]);
  const resolvido = getValue(row, ["Resolvido", "Resolved"]);
  const projeto = getValue(row, ["Nome do projeto", "Projeto"]);
  const cliente =
    getValue(row, [
      "Campo personalizado (Cliente)",
      "Campo personalizado (CLIENTE)",
      "Campo personalizado (Nome do Cliente)",
      "Cliente",
    ]) || "Não informado";

  const complexidade =
    getValue(row, ["Campo personalizado (Complexidade Técnica)", "Complexidade Técnica", "Complexidade"]) ||
    "Não informado";

  const origem =
    getValue(row, ["Campo personalizado (Origem)", "Campo personalizado (Meio de Comunicação)", "Origem"]) ||
    "Não informado";

  const unidadeFromFile = fileName
    .replace("2026 - ", "")
    .replace(" (JIRA).csv", "")
    .replace(".csv", "")
    .trim();

  const tempoResolucao = daysBetween(criado, resolvido);

  return {
    resumo,
    chave,
    tipo: tipo || "Não informado",
    status: status || "Não informado",
    prioridade: prioridade || "Não informado",
    responsavel: responsavel || "Não informado",
    relator: relator || "Não informado",
    criado,
    atualizado,
    resolvido,
    projeto: projeto || "Não informado",
    cliente,
    complexidade,
    origem,
    unidade: unidadeFromFile || "Geral",
    tempoResolucao,
    arquivo: fileName,
  };
}

function isDone(status) {
  const s = String(status || "").toLowerCase();
  return (
    s.includes("concluído") ||
    s.includes("concluido") ||
    s.includes("done") ||
    s.includes("finalizado") ||
    s.includes("resolvido") ||
    s.includes("closed")
  );
}

function App() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState("Todas");
  const [selectedStatus, setSelectedStatus] = useState("Todos");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadCsvs() {
      const loaded = [];

      for (const file of CSV_FILES) {
        try {
          const response = await fetch(`/data/${encodeURIComponent(file)}`);
          if (!response.ok) continue;

          const text = await response.text();

          const parsed = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            delimiter: "",
          });

          parsed.data.forEach((row) => {
            const normalized = normalizeRow(row, file);
            if (normalized.resumo || normalized.chave || normalized.status) {
              loaded.push(normalized);
            }
          });
        } catch (error) {
          console.warn("Erro ao carregar CSV:", file, error);
        }
      }

      setRows(loaded);
      setLoading(false);
    }

    loadCsvs();
  }, []);

  const units = useMemo(() => ["Todas", ...Array.from(new Set(rows.map((r) => r.unidade))).sort()], [rows]);
  const statuses = useMemo(() => ["Todos", ...Array.from(new Set(rows.map((r) => r.status))).sort()], [rows]);

  const filtered = useMemo(() => {
    return rows.filter((item) => {
      const matchUnit = selectedUnit === "Todas" || item.unidade === selectedUnit;
      const matchStatus = selectedStatus === "Todos" || item.status === selectedStatus;
      const text = `${item.resumo} ${item.chave} ${item.cliente} ${item.responsavel} ${item.status}`.toLowerCase();
      const matchSearch = text.includes(search.toLowerCase());
      return matchUnit && matchStatus && matchSearch;
    });
  }, [rows, selectedUnit, selectedStatus, search]);

  const total = filtered.length;
  const done = filtered.filter((r) => isDone(r.status)).length;
  const open = total - done;
  const percentDone = total ? ((done / total) * 100).toFixed(1) : 0;

  const avgDays = useMemo(() => {
    const valid = filtered.map((r) => r.tempoResolucao).filter((v) => typeof v === "number");
    if (!valid.length) return 0;
    return (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1);
  }, [filtered]);

  const byStatus = groupCount(filtered, "status").slice(0, 8);
  const byUnit = groupCount(filtered, "unidade").slice(0, 10);
  const byType = groupCount(filtered, "tipo").slice(0, 8);
  const byComplexity = groupCount(filtered, "complexidade").slice(0, 8);
  const byOrigin = groupCount(filtered, "origem").slice(0, 8);

  const monthly = useMemo(() => {
    const map = {};
    filtered.forEach((item) => {
      const date = parseDate(item.criado);
      if (!date) return;
      const key = `${String(date.getMonth() + 1).padStart(2, "0")}/${date.getFullYear()}`;
      if (!map[key]) map[key] = { mes: key, criados: 0, concluidos: 0 };
      map[key].criados += 1;
      if (isDone(item.status)) map[key].concluidos += 1;
    });

    return Object.values(map).sort((a, b) => {
      const [ma, ya] = a.mes.split("/");
      const [mb, yb] = b.mes.split("/");
      return new Date(`${ya}-${ma}-01`) - new Date(`${yb}-${mb}-01`);
    });
  }, [filtered]);

  const topResponsaveis = groupCount(filtered, "responsavel").slice(0, 10);

  const recentItems = [...filtered]
    .sort((a, b) => {
      const da = parseDate(a.criado)?.getTime() || 0;
      const db = parseDate(b.criado)?.getTime() || 0;
      return db - da;
    })
    .slice(0, 30);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingBox}>
          <h1>Carregando Dashboard Jira...</h1>
          <p>Lendo os arquivos CSV da pasta public/data.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>Dashboard Jira</h1>
          <p style={styles.subtitle}>Visão executiva dos chamados, unidades, status e tempos de atendimento.</p>
        </div>
        <div style={styles.badge}>Base CSV GitHub + Vercel</div>
      </header>

      <section style={styles.filters}>
        <input
          style={styles.input}
          placeholder="Pesquisar por resumo, chave, cliente, responsável..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select style={styles.select} value={selectedUnit} onChange={(e) => setSelectedUnit(e.target.value)}>
          {units.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>

        <select style={styles.select} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </section>

      <section style={styles.kpiGrid}>
        <Kpi title="Total de Chamados" value={total} description="Itens filtrados na base" />
        <Kpi title="Concluídos" value={done} description={`${percentDone}% de conclusão`} />
        <Kpi title="Em Aberto" value={open} description="Pendentes ou em andamento" />
        <Kpi title="Tempo Médio" value={`${avgDays} dias`} description="Criado até resolvido" />
      </section>

      <section style={styles.gridTwo}>
        <ChartCard title="Chamados por Status">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byStatus}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={styles.tooltip} />
              <Bar dataKey="value" fill="#38bdf8" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Chamados por Unidade">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byUnit}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="name" stroke="#94a3b8" tick={{ fontSize: 11 }} />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={styles.tooltip} />
              <Bar dataKey="value" fill="#22c55e" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section style={styles.gridTwo}>
        <ChartCard title="Evolução Mensal">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="mes" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip contentStyle={styles.tooltip} />
              <Legend />
              <Line type="monotone" dataKey="criados" stroke="#38bdf8" strokeWidth={3} />
              <Line type="monotone" dataKey="concluidos" stroke="#22c55e" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Distribuição por Tipo">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {byType.map((_, index) => (
                  <Cell key={index} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={styles.tooltip} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </section>

      <section style={styles.gridThree}>
        <MiniRanking title="Complexidade Técnica" data={byComplexity} />
        <MiniRanking title="Origem / Canal" data={byOrigin} />
        <MiniRanking title="Responsáveis" data={topResponsaveis} />
      </section>

      <section style={styles.tableCard}>
        <div style={styles.tableHeader}>
          <h2 style={styles.cardTitle}>Tabela Dinâmica dos Chamados</h2>
          <span style={styles.smallText}>{recentItems.length} itens exibidos</span>
        </div>

        <div style={styles.tableWrapper}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Chave</th>
                <th style={styles.th}>Resumo</th>
                <th style={styles.th}>Unidade</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Tipo</th>
                <th style={styles.th}>Responsável</th>
                <th style={styles.th}>Criado</th>
                <th style={styles.th}>Resolvido</th>
                <th style={styles.th}>Dias</th>
              </tr>
            </thead>
            <tbody>
              {recentItems.map((item, index) => (
                <tr key={`${item.chave}-${index}`}>
                  <td style={styles.td}>{item.chave || "-"}</td>
                  <td style={styles.tdResumo}>{item.resumo || "-"}</td>
                  <td style={styles.td}>{item.unidade}</td>
                  <td style={styles.td}>
                    <span style={isDone(item.status) ? styles.statusDone : styles.statusOpen}>{item.status}</span>
                  </td>
                  <td style={styles.td}>{item.tipo}</td>
                  <td style={styles.td}>{item.responsavel}</td>
                  <td style={styles.td}>{formatDate(item.criado)}</td>
                  <td style={styles.td}>{formatDate(item.resolvido)}</td>
                  <td style={styles.td}>{item.tempoResolucao ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ title, value, description }) {
  return (
    <div style={styles.kpiCard}>
      <p style={styles.kpiTitle}>{title}</p>
      <h2 style={styles.kpiValue}>{value}</h2>
      <p style={styles.kpiDesc}>{description}</p>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div style={styles.chartCard}>
      <h2 style={styles.cardTitle}>{title}</h2>
      {children}
    </div>
  );
}

function MiniRanking({ title, data }) {
  return (
    <div style={styles.chartCard}>
      <h2 style={styles.cardTitle}>{title}</h2>
      <div style={styles.rankingList}>
        {data.map((item, index) => (
          <div key={item.name} style={styles.rankingItem}>
            <span style={styles.rankingName}>
              {index + 1}. {item.name}
            </span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#020617",
    color: "#e5e7eb",
    padding: "28px",
    fontFamily: "Arial, sans-serif",
  },
  loadingBox: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "18px",
    padding: "32px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: "20px",
    alignItems: "center",
    marginBottom: "24px",
  },
  title: {
    fontSize: "34px",
    margin: 0,
    color: "#f8fafc",
  },
  subtitle: {
    marginTop: "8px",
    color: "#94a3b8",
  },
  badge: {
    background: "#0f172a",
    border: "1px solid #334155",
    borderRadius: "999px",
    padding: "10px 16px",
    color: "#93c5fd",
    whiteSpace: "nowrap",
  },
  filters: {
    display: "grid",
    gridTemplateColumns: "1fr 240px 240px",
    gap: "12px",
    marginBottom: "20px",
  },
  input: {
    background: "#0f172a",
    color: "#e5e7eb",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "14px",
    outline: "none",
  },
  select: {
    background: "#0f172a",
    color: "#e5e7eb",
    border: "1px solid #334155",
    borderRadius: "12px",
    padding: "14px",
    outline: "none",
  },
  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "16px",
    marginBottom: "20px",
  },
  kpiCard: {
    background: "linear-gradient(135deg, #0f172a, #1e293b)",
    border: "1px solid #334155",
    borderRadius: "18px",
    padding: "22px",
  },
  kpiTitle: {
    margin: 0,
    color: "#94a3b8",
    fontSize: "14px",
  },
  kpiValue: {
    margin: "10px 0",
    fontSize: "32px",
    color: "#f8fafc",
  },
  kpiDesc: {
    margin: 0,
    color: "#64748b",
    fontSize: "13px",
  },
  gridTwo: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginBottom: "16px",
  },
  gridThree: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: "16px",
    marginBottom: "16px",
  },
  chartCard: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "18px",
    padding: "20px",
    minHeight: "260px",
  },
  cardTitle: {
    margin: "0 0 16px 0",
    fontSize: "18px",
    color: "#f8fafc",
  },
  tooltip: {
    background: "#020617",
    border: "1px solid #334155",
    borderRadius: "10px",
    color: "#e5e7eb",
  },
  rankingList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  rankingItem: {
    display: "flex",
    justifyContent: "space-between",
    gap: "14px",
    background: "#020617",
    border: "1px solid #1e293b",
    borderRadius: "12px",
    padding: "12px",
  },
  rankingName: {
    color: "#cbd5e1",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  tableCard: {
    background: "#0f172a",
    border: "1px solid #1e293b",
    borderRadius: "18px",
    padding: "20px",
  },
  tableHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
  },
  smallText: {
    color: "#94a3b8",
    fontSize: "13px",
  },
  tableWrapper: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: "13px",
  },
  th: {
    textAlign: "left",
    padding: "12px",
    color: "#93c5fd",
    borderBottom: "1px solid #334155",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "12px",
    borderBottom: "1px solid #1e293b",
    color: "#cbd5e1",
    verticalAlign: "top",
    whiteSpace: "nowrap",
  },
  tdResumo: {
    padding: "12px",
    borderBottom: "1px solid #1e293b",
    color: "#e5e7eb",
    minWidth: "360px",
    verticalAlign: "top",
  },
  statusDone: {
    background: "rgba(34, 197, 94, 0.15)",
    color: "#86efac",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    borderRadius: "999px",
    padding: "4px 10px",
  },
  statusOpen: {
    background: "rgba(245, 158, 11, 0.15)",
    color: "#facc15",
    border: "1px solid rgba(245, 158, 11, 0.3)",
    borderRadius: "999px",
    padding: "4px 10px",
  },
};

export default App;
