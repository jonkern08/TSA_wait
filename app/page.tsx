"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { WaitTimeRow } from "@/lib/supabase";
import styles from "./page.module.css";

const TERMINALS = ["T1", "T4", "T5", "T7", "T8"] as const;
type Terminal = (typeof TERMINALS)[number];

const TERMINAL_COLORS: Record<Terminal, string> = {
  T1: "#E63946",
  T4: "#2563EB",
  T5: "#0D9488",
  T7: "#D97706",
  T8: "#7C3AED",
};

function getStatusColor(min: number | null): string {
  if (min === null || min === undefined) return "#6B7280";
  if (min < 15) return "#16a34a";
  if (min <= 30) return "#d97706";
  return "#dc2626";
}

function getTodayET(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
}

function buildDayOptions(): string[] {
  const result: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push(d.toLocaleDateString("en-CA", { timeZone: "America/New_York" }));
  }
  return result;
}

function getDayLabel(isoDate: string, index: number): { label: string; date: string } {
  if (index === 0) return { label: "Today", date: fmtShortDate(isoDate) };
  if (index === 1) return { label: "Yesterday", date: fmtShortDate(isoDate) };
  const [y, m, d] = isoDate.split("-").map(Number);
  const dayName = new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "short" });
  return { label: dayName, date: fmtShortDate(isoDate) };
}

function fmtShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${m}/${d}`;
}

function fmtHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  if (hour < 12) return `${hour}am`;
  return `${hour - 12}pm`;
}

function fmtTime(d: string | Date): string {
  return new Date(d).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/New_York",
  });
}

type HourlyPoint = {
  hour: number;
  T1: number | null;
  T4: number | null;
  T5: number | null;
  T7: number | null;
  T8: number | null;
};

function aggregateByHour(rows: WaitTimeRow[]): HourlyPoint[] {
  const buckets: Record<number, Record<Terminal, number[]>> = {};

  for (const row of rows) {
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date(row.collected_at));
    const hour = parseInt(hourStr, 10);

    if (!buckets[hour]) {
      buckets[hour] = { T1: [], T4: [], T5: [], T7: [], T8: [] };
    }

    const vals: Record<Terminal, number | null> = {
      T1: row.t1_general,
      T4: row.t4_general,
      T5: row.t5_general,
      T7: row.t7_general,
      T8: row.t8_general,
    };

    for (const t of TERMINALS) {
      if (vals[t] !== null && vals[t] !== undefined) {
        buckets[hour][t].push(vals[t] as number);
      }
    }
  }

  const avg = (vals: number[]): number | null =>
    vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;

  return Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    T1: buckets[i] ? avg(buckets[i].T1) : null,
    T4: buckets[i] ? avg(buckets[i].T4) : null,
    T5: buckets[i] ? avg(buckets[i].T5) : null,
    T7: buckets[i] ? avg(buckets[i].T7) : null,
    T8: buckets[i] ? avg(buckets[i].T8) : null,
  }));
}

type CurrentData = Record<Terminal, { general: number | null; precheck: number | null }>;

function extractCurrentData(rows: WaitTimeRow[], isToday: boolean): CurrentData | null {
  if (rows.length === 0) return null;

  if (isToday) {
    const latest = rows[rows.length - 1];
    return {
      T1: { general: latest.t1_general, precheck: latest.t1_precheck },
      T4: { general: latest.t4_general, precheck: latest.t4_precheck },
      T5: { general: latest.t5_general, precheck: latest.t5_precheck },
      T7: { general: latest.t7_general, precheck: latest.t7_precheck },
      T8: { general: latest.t8_general, precheck: latest.t8_precheck },
    };
  }

  const avg = (vals: (number | null)[]): number | null => {
    const nonNull = vals.filter((v): v is number => v !== null);
    return nonNull.length > 0
      ? Math.round(nonNull.reduce((a, b) => a + b, 0) / nonNull.length)
      : null;
  };

  return {
    T1: { general: avg(rows.map((r) => r.t1_general)), precheck: avg(rows.map((r) => r.t1_precheck)) },
    T4: { general: avg(rows.map((r) => r.t4_general)), precheck: avg(rows.map((r) => r.t4_precheck)) },
    T5: { general: avg(rows.map((r) => r.t5_general)), precheck: avg(rows.map((r) => r.t5_precheck)) },
    T7: { general: avg(rows.map((r) => r.t7_general)), precheck: avg(rows.map((r) => r.t7_precheck)) },
    T8: { general: avg(rows.map((r) => r.t8_general)), precheck: avg(rows.map((r) => r.t8_precheck)) },
  };
}

function TerminalCard({
  terminal,
  data,
  isToday,
}: {
  terminal: Terminal;
  data: CurrentData[Terminal];
  isToday: boolean;
}) {
  const color = TERMINAL_COLORS[terminal];

  return (
    <div className={styles.terminalCard} style={{ borderTopColor: color }}>
      <div className={styles.terminalName} style={{ color }}>
        {terminal}
      </div>
      <div className={styles.metricRow}>
        {(["general", "precheck"] as const).map((type) => {
          const val = data[type];
          return (
            <div key={type} className={styles.metric}>
              <div className={styles.metricLabel}>
                {type === "general" ? "General" : "PreCheck"}
              </div>
              <div className={styles.metricValue}>
                <div
                  className={styles.statusDot}
                  style={{ backgroundColor: getStatusColor(val) }}
                />
                <span
                  className={styles.metricNumber}
                  style={{ color: getStatusColor(val) }}
                >
                  {val !== null ? val : "—"}
                </span>
                {val !== null && <span className={styles.metricUnit}>min</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className={`${styles.badge} ${isToday ? styles.badgeLive : styles.badgeAvg}`}>
        {isToday ? "Live" : "Avg"}
      </div>
    </div>
  );
}

export default function JFKTracker() {
  const todayISO = useMemo(() => getTodayET(), []);
  const [dayOptions] = useState(() => buildDayOptions());
  const [selectedDay, setSelectedDay] = useState<string>(dayOptions[0]);
  const [history, setHistory] = useState<WaitTimeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/history?date=${date}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setHistory(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(selectedDay);
    if (selectedDay !== todayISO) return;
    const id = setInterval(() => loadHistory(selectedDay), 60 * 1000);
    return () => clearInterval(id);
  }, [selectedDay, loadHistory, todayISO]);

  const isToday = selectedDay === todayISO;
  const latest = isToday && history.length > 0 ? history[history.length - 1] : null;
  const currentData = extractCurrentData(history, isToday);
  const hourlyData = useMemo(() => aggregateByHour(history), [history]);
  const hasChartData = hourlyData.some((p) => TERMINALS.some((t) => p[t] !== null));

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1>JFK TSA</h1>
          <p>Security Wait Times</p>
        </div>
        <div className={styles.headerRight}>
          {latest && (
            <div className={styles.lastUpdated}>
              Last updated <span>{fmtTime(latest.collected_at)}</span>
            </div>
          )}
          <button
            className={styles.refreshButton}
            onClick={() => loadHistory(selectedDay)}
            disabled={loading}
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Warning banner */}
      <div className={styles.warningBanner}>
        <span>⚠</span>
        <span>
          Government funding lapse is causing TSA staffing shortages. Wait times may be
          significantly longer than reported.
        </span>
      </div>

      {/* Day selector */}
      <div className={styles.daySelector}>
        {dayOptions.map((date, i) => {
          const { label, date: shortDate } = getDayLabel(date, i);
          return (
            <button
              key={date}
              className={`${styles.dayButton} ${selectedDay === date ? styles.active : ""}`}
              onClick={() => setSelectedDay(date)}
            >
              <span className={styles.dayButtonLabel}>{label}</span>
              <span className={styles.dayButtonDate}>{shortDate}</span>
            </button>
          );
        })}
      </div>

      {/* Error */}
      {error && <div className={styles.errorBanner}>Error: {error}</div>}

      {/* Loading spinner */}
      {loading && !currentData && (
        <div className={styles.loadingSpinner}>
          <div className={styles.spinnerInner}>
            <div className={styles.spinner} />
            Loading wait times…
          </div>
        </div>
      )}

      {/* No data */}
      {!loading && !currentData && !error && (
        <div className={styles.emptyState}>No data available for this day.</div>
      )}

      {/* Terminal cards */}
      {currentData && (
        <>
          <div className={styles.terminalGrid}>
            {TERMINALS.map((t) => (
              <TerminalCard key={t} terminal={t} data={currentData[t]} isToday={isToday} />
            ))}
          </div>

          <div className={styles.statusLegend}>
            <div className={styles.legendItem}>
              <div className={styles.statusDot} style={{ backgroundColor: "#16a34a" }} />
              Under 15 min
            </div>
            <div className={styles.legendItem}>
              <div className={styles.statusDot} style={{ backgroundColor: "#d97706" }} />
              15–30 min
            </div>
            <div className={styles.legendItem}>
              <div className={styles.statusDot} style={{ backgroundColor: "#dc2626" }} />
              30+ min
            </div>
          </div>
        </>
      )}

      {/* Chart */}
      <div className={styles.chartSection}>
        <div className={styles.chartHeader}>
          <h2>Average Wait by Hour of Day</h2>
          <p>
            General lane · Times in ET
            {isToday ? " · Today" : ` · ${fmtShortDate(selectedDay)}`}
          </p>
        </div>
        {!hasChartData ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              fontSize: "13px",
              color: "var(--text-muted)",
            }}
          >
            No data available for this period.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={hourlyData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="hour"
                tickFormatter={fmtHour}
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                stroke="var(--border)"
                interval={2}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                stroke="var(--border)"
                label={{
                  value: "min",
                  angle: -90,
                  position: "insideLeft",
                  style: { fontSize: 11, fill: "var(--text-muted)" },
                }}
              />
              <Tooltip
                contentStyle={{
                  background: "#fff",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  fontSize: "12px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                }}
                labelFormatter={(h) => `${fmtHour(h as number)} ET`}
                formatter={(v) => [v != null ? `${v} min` : "N/A"]}
              />
              <Legend wrapperStyle={{ fontSize: "11px" }} />
              {TERMINALS.map((t) => (
                <Line
                  key={t}
                  type="monotone"
                  dataKey={t}
                  name={t}
                  stroke={TERMINAL_COLORS[t]}
                  strokeWidth={2}
                  dot={{ r: 2, fill: TERMINAL_COLORS[t] }}
                  connectNulls={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        Data scraped from jfkairport.com. Wait times are estimates and may not reflect real-time
        conditions.
        <br />
        Terminal 2 closed Jan 2026 (Delta consolidated to T4).
      </div>
    </div>
  );
}
