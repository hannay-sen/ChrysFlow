import React, { useState, useEffect, useMemo } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

// ---------------------------------------------------------------
// Currency Exchange Tracker
// Data source: Frankfurter API (https://frankfurter.dev)
// - Free, no API key required, supports CORS
// - /v1/currencies          -> list of supported currencies
// - /v1/latest?base=X       -> latest rates for base currency X
// - /v1/{start}..{end}?...  -> historical rates for a date range
// ---------------------------------------------------------------

const API = "https://api.frankfurter.dev/v1";

// Preset ranges for the historical chart
const RANGES = [
  { label: "1M", days: 30 },
  { label: "3M", days: 91 },
  { label: "6M", days: 182 },
  { label: "1Y", days: 365 },
];

// Format a Date as YYYY-MM-DD (what the API expects)
function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

export default function CurrencyExchangeTracker() {
  // ---- state ----
  const [currencies, setCurrencies] = useState({});      // { USD: "United States Dollar", ... }
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("EUR");
  const [amount, setAmount] = useState("100");
  const [rate, setRate] = useState(null);                // latest rate for from->to
  const [rateDate, setRateDate] = useState("");          // date the rate was published
  const [history, setHistory] = useState([]);            // [{ date, rate }] for the chart
  const [rangeDays, setRangeDays] = useState(91);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---- load the currency list once on mount ----
  useEffect(() => {
    fetch(`${API}/currencies`)
      .then((res) => {
        if (!res.ok) throw new Error(`Currency list failed (${res.status})`);
        return res.json();
      })
      .then(setCurrencies)
      .catch(() => setError("Couldn't load the currency list. Check your connection and reload."));
  }, []);

  // ---- fetch latest rate + history whenever the pair or range changes ----
  useEffect(() => {
    if (from === to) {
      // Same currency: rate is exactly 1, no need to call the API
      setRate(1);
      setRateDate(toISODate(new Date()));
      setHistory([]);
      setLoading(false);
      return;
    }

    let cancelled = false; // guards against out-of-order responses
    setLoading(true);
    setError("");

    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - rangeDays);

    const latestReq = fetch(`${API}/latest?base=${from}&symbols=${to}`);
    const historyReq = fetch(
      `${API}/${toISODate(start)}..${toISODate(end)}?base=${from}&symbols=${to}`
    );

    Promise.all([latestReq, historyReq])
      .then(async ([latestRes, histRes]) => {
        if (!latestRes.ok || !histRes.ok) throw new Error("API request failed");
        const latest = await latestRes.json();
        const hist = await histRes.json();
        if (cancelled) return;

        setRate(latest.rates[to]);
        setRateDate(latest.date);

        // hist.rates is { "2026-04-01": { EUR: 0.92 }, ... } -> array for the chart
        const points = Object.entries(hist.rates)
          .map(([date, rates]) => ({ date, rate: rates[to] }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setHistory(points);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't fetch exchange rates. Try again in a moment.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; }; // cleanup if the user changes inputs mid-fetch
  }, [from, to, rangeDays]);

  // ---- derived values (recomputed only when inputs change) ----
  const numericAmount = parseFloat(amount) || 0;
  const converted = rate != null ? numericAmount * rate : null;

  const trend = useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0].rate;
    const last = history[history.length - 1].rate;
    const pct = ((last - first) / first) * 100;
    return { pct, up: pct >= 0 };
  }, [history]);

  const codes = Object.keys(currencies).sort();

  function swap() {
    setFrom(to);
    setTo(from);
  }

  // ---- styles (plain objects so everything lives in one file) ----
  const s = {
    page: {
      minHeight: "100vh", background: "#0E1B25", color: "#EAF2F6",
      fontFamily: "'Avenir Next', 'Segoe UI', system-ui, sans-serif",
      display: "flex", justifyContent: "center", padding: "40px 16px",
    },
    shell: { width: "100%", maxWidth: 760 },
    eyebrow: {
      fontSize: 12, letterSpacing: "0.18em", textTransform: "uppercase",
      color: "#5FA8A0", marginBottom: 6,
    },
    h1: { fontSize: 26, fontWeight: 600, margin: "0 0 28px" },
    card: {
      background: "#13242F", border: "1px solid #1E3542",
      borderRadius: 14, padding: 24, marginBottom: 20,
    },
    row: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" },
    field: { display: "flex", flexDirection: "column", gap: 6, flex: "1 1 140px" },
    label: { fontSize: 12, color: "#8FB3BF" },
    input: {
      background: "#0E1B25", color: "#EAF2F6", border: "1px solid #2A4657",
      borderRadius: 8, padding: "10px 12px", fontSize: 15, width: "100%", boxSizing: "border-box",
    },
    swapBtn: {
      background: "#1E3542", color: "#9FD8CF", border: "1px solid #2A4657",
      borderRadius: 8, padding: "10px 14px", cursor: "pointer", fontSize: 15,
    },
    bigRate: { fontSize: 40, fontWeight: 650, margin: "18px 0 2px", fontVariantNumeric: "tabular-nums" },
    sub: { color: "#8FB3BF", fontSize: 13 },
    rangeBar: { display: "flex", gap: 8, marginBottom: 14 },
    rangeBtn: (active) => ({
      background: active ? "#5FA8A0" : "transparent",
      color: active ? "#0E1B25" : "#8FB3BF",
      border: `1px solid ${active ? "#5FA8A0" : "#2A4657"}`,
      borderRadius: 6, padding: "5px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600,
    }),
    error: {
      background: "#3A1F24", border: "1px solid #6E3540", color: "#F2B8C0",
      borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 14,
    },
    trendTag: (up) => ({
      display: "inline-block", marginLeft: 10, fontSize: 14, fontWeight: 600,
      color: up ? "#7FD8A8" : "#F2949C",
    }),
  };

  return (
    <div style={s.page}>
      <div style={s.shell}>
        <div style={s.eyebrow}>Live market data · Frankfurter API</div>
        <h1 style={s.h1}>Currency Exchange Tracker</h1>

        {error && <div style={s.error}>{error}</div>}

        {/* ---- converter card ---- */}
        <div style={s.card}>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label} htmlFor="amount">Amount</label>
              <input
                id="amount" style={s.input} type="number" min="0"
                value={amount} onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div style={s.field}>
              <label style={s.label} htmlFor="from">From</label>
              <select id="from" style={s.input} value={from} onChange={(e) => setFrom(e.target.value)}>
                {codes.map((c) => <option key={c} value={c}>{c} — {currencies[c]}</option>)}
              </select>
            </div>

            <button style={s.swapBtn} onClick={swap} aria-label="Swap currencies">⇅ Swap</button>

            <div style={s.field}>
              <label style={s.label} htmlFor="to">To</label>
              <select id="to" style={s.input} value={to} onChange={(e) => setTo(e.target.value)}>
                {codes.map((c) => <option key={c} value={c}>{c} — {currencies[c]}</option>)}
              </select>
            </div>
          </div>

          <div style={s.bigRate}>
            {loading ? "…" : converted != null
              ? `${converted.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${to}`
              : "—"}
            {trend && !loading && (
              <span style={s.trendTag(trend.up)}>
                {trend.up ? "▲" : "▼"} {Math.abs(trend.pct).toFixed(2)}%
              </span>
            )}
          </div>
          <div style={s.sub}>
            {rate != null && !loading &&
              `1 ${from} = ${rate.toFixed(4)} ${to} · updated ${rateDate}`}
          </div>
        </div>

        {/* ---- historical chart card ---- */}
        <div style={s.card}>
          <div style={s.rangeBar}>
            {RANGES.map((r) => (
              <button
                key={r.label}
                style={s.rangeBtn(rangeDays === r.days)}
                onClick={() => setRangeDays(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>

          {from === to ? (
            <div style={s.sub}>Select two different currencies to see a trend.</div>
          ) : history.length === 0 && !loading ? (
            <div style={s.sub}>No historical data for this pair.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="rateFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5FA8A0" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#5FA8A0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1E3542" vertical={false} />
                <XAxis
                  dataKey="date" tick={{ fill: "#8FB3BF", fontSize: 11 }}
                  tickLine={false} axisLine={false} minTickGap={40}
                />
                <YAxis
                  domain={["auto", "auto"]} tick={{ fill: "#8FB3BF", fontSize: 11 }}
                  tickLine={false} axisLine={false} width={60}
                  tickFormatter={(v) => v.toFixed(3)}
                />
                <Tooltip
                  contentStyle={{
                    background: "#13242F", border: "1px solid #2A4657",
                    borderRadius: 8, color: "#EAF2F6", fontSize: 13,
                  }}
                  formatter={(v) => [`${v.toFixed(4)} ${to}`, `1 ${from}`]}
                />
                <Area
                  type="monotone" dataKey="rate" stroke="#5FA8A0"
                  strokeWidth={2} fill="url(#rateFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
          <div style={{ ...s.sub, marginTop: 10 }}>
            {from !== to && `Historical ${from}/${to} rate · last ${RANGES.find(r => r.days === rangeDays)?.label}`}
          </div>
        </div>
      </div>
    </div>
  );
}