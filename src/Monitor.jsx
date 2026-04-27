import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./lib/supabase/client";

export default function Monitor() {
  const [eventData, setEventData] = useState(null);
  const [branding, setBranding] = useState(null);
  const [matches, setMatches] = useState([]);
  const [now, setNow] = useState(new Date());
  const [liveStatus, setLiveStatus] = useState("Verbindung prüfen");
  const [filterMode, setFilterMode] = useState("all");
  const [changedMatchIds, setChangedMatchIds] = useState([]);

  const prevMatchesRef = useRef([]);
  const eventId = new URLSearchParams(window.location.search).get("event");

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!eventId) return;

    loadAll();

    const refresh = setInterval(loadAll, 5000);

    const channel = supabase
      .channel(`monitor-${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
          filter: `event_id=eq.${eventId}`,
        },
        () => loadMatches(true)
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setLiveStatus("LIVE");
      });

    return () => {
      clearInterval(refresh);
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  async function loadAll() {
    await Promise.all([loadEvent(), loadBranding(), loadMatches(false)]);
  }

  async function loadEvent() {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .single();

    setEventData(data || null);
  }

  async function loadBranding() {
    const { data } = await supabase
      .from("branding_settings")
      .select("*")
      .eq("event_id", eventId)
      .single();

    setBranding(data || null);
  }

  async function loadMatches(fromRealtime = false) {
    const { data } = await supabase
      .from("matches")
      .select(
        `
        *,
        courts (
          id,
          name,
          sort_order
        )
      `
      )
      .eq("event_id", eventId);

    const next = data || [];
    detectChanges(prevMatchesRef.current, next, fromRealtime);
    prevMatchesRef.current = next;
    setMatches(next);
  }

  function detectChanges(oldMatches, newMatches, fromRealtime) {
    const changed = [];

    for (const m of newMatches) {
      const old = oldMatches.find((x) => x.id === m.id);
      if (!old) continue;

      if (
        old.set1_a !== m.set1_a ||
        old.set1_b !== m.set1_b ||
        old.set2_a !== m.set2_a ||
        old.set2_b !== m.set2_b ||
        old.set3_a !== m.set3_a ||
        old.set3_b !== m.set3_b ||
        old.status !== m.status
      ) {
        changed.push(m.id);
      }
    }

    if (changed.length) {
      setChangedMatchIds(changed);
      setTimeout(() => setChangedMatchIds([]), fromRealtime ? 2200 : 1400);
    }
  }

  const theme = useMemo(() => {
    return {
      bg: branding?.background_color || "#06152f",
      text: branding?.text_color || "#ffffff",
      muted: "#b9c8e6",
      cyan: branding?.border_color || "#6be7ff",
      green: "#00ff9d",
      red: "#ff6b7a",
      yellow: "#ffd166",
      logo: branding?.logo_url || null,
      title: eventData?.title || branding?.monitor_title || "LIVE SCOREBOARD",
      subtitle:
        branding?.monitor_subtitle ||
        "Live Scoreboard · Echtzeit Monitor · Turniersteuerung",
      sponsor: branding?.sponsor_text || "GP23 Sport · Tennis Scoreboard",
    };
  }, [branding, eventData]);

  const sortedMatches = useMemo(() => {
    const order = { live: 0, planned: 1, finished: 2 };
    let list = [...matches];

    if (filterMode === "live") {
      list = list.filter((m) => m.status === "live");
    }

    return list.sort((a, b) => {
      const statusCompare = (order[a.status] ?? 9) - (order[b.status] ?? 9);
      if (statusCompare !== 0) return statusCompare;

      const courtA = getCourtSortValue(a.courts);
      const courtB = getCourtSortValue(b.courts);

      return courtA - courtB;
    });
  }, [matches, filterMode]);

  return (
    <div style={{ ...styles.page, background: theme.bg, color: theme.text }}>
      <header style={styles.hero}>
        <div style={styles.heroLeft}>
          {theme.logo ? (
            <img
              src={theme.logo}
              alt="Logo"
              style={styles.logo}
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div style={styles.logoFallback}>TS</div>
          )}

          <div>
            <div style={{ ...styles.kicker, color: theme.green }}>
              LIVE TENNIS CONTROL
            </div>

            <h1 style={styles.heroTitle}>{theme.title}</h1>

            <div style={styles.heroSub}>{theme.subtitle}</div>
          </div>
        </div>

        <div style={styles.heroRight}>
          <StatusPill color={theme.red}>Verbindung prüfen</StatusPill>
          <StatusPill color={theme.green}>Turnierleitung</StatusPill>
          <StatusPill color={theme.text}>{formatTime(now)}</StatusPill>
        </div>
      </header>

      <nav style={styles.nav}>
        <button
          type="button"
          style={{
            ...styles.navButton,
            ...(filterMode === "all" ? activeButton(theme.cyan) : {}),
          }}
          onClick={() => setFilterMode("all")}
        >
          Alle Matches
        </button>

        <button
          type="button"
          style={{
            ...styles.navButton,
            ...(filterMode === "live" ? activeButton(theme.green) : {}),
          }}
          onClick={() => setFilterMode("live")}
        >
          Nur Live
        </button>

        <div style={styles.navInfo}>
          Matches: <strong>{sortedMatches.length}</strong>
        </div>

        <div style={{ ...styles.navInfo, color: theme.green }}>
          {liveStatus}
        </div>
      </nav>

      <main style={styles.mainPanel}>
        <div style={styles.panelHeader}>
          <div>
            <h2 style={styles.panelTitle}>Aktive Courts</h2>
            <div style={styles.panelSub}>
              
            </div>
          </div>
        </div>

        {sortedMatches.length === 0 ? (
          <div style={styles.empty}>Keine Matches vorhanden.</div>
        ) : (
          <div style={styles.grid}>
            {sortedMatches.map((m) => (
              <MatchCard
                key={m.id}
                match={m}
                theme={theme}
                changed={changedMatchIds.includes(m.id)}
              />
            ))}
          </div>
        )}
      </main>

      <footer style={styles.footer}>{theme.sponsor}</footer>
    </div>
  );
}

function MatchCard({ match, theme, changed }) {
  const isLive = match.status === "live";
  const statusColor =
    match.status === "live"
      ? theme.green
      : match.status === "planned"
      ? theme.yellow
      : theme.muted;

  return (
    <div
      style={{
        ...styles.matchCard,
        borderColor: isLive ? theme.green : "rgba(255,255,255,0.12)",
        boxShadow: changed
          ? "0 0 28px rgba(255, 209, 102, 0.95)"
          : isLive
          ? `0 0 24px ${hexToRgba(theme.green, 0.35)}`
          : "none",
        transform: changed ? "scale(1.025)" : isLive ? "scale(1.01)" : "scale(1)",
      }}
    >
      <div style={styles.cardTop}>
        <div style={{ ...styles.courtName, color: isLive ? theme.green : theme.text }}>
          {cleanCourtName(match.courts)}
        </div>

        <div
          style={{
            ...styles.badge,
            color: statusColor,
            borderColor: hexToRgba(statusColor, 0.55),
            background: hexToRgba(statusColor, 0.12),
          }}
        >
          {labelStatus(match.status)}
        </div>
      </div>

      <div style={styles.players}>
        <span>{match.player_a || "Spieler A"}</span>
        <span style={styles.vs}>vs</span>
        <span>{match.player_b || "Spieler B"}</span>
      </div>

      <div style={styles.mode}>{match.mode || "Einzel"}</div>

      <table style={styles.scoreTable}>
        <thead>
          <tr>
            <th style={styles.th}>Spieler</th>
            <th style={styles.th}>S1</th>
            <th style={styles.th}>S2</th>
            <th style={styles.th}>MTB</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td style={styles.tdName}>{match.player_a || "Spieler A"}</td>
            <td style={styles.tdScore}>{match.set1_a ?? 0}</td>
            <td style={styles.tdScore}>{match.set2_a ?? 0}</td>
            <td style={styles.tdScore}>{match.set3_a ?? 0}</td>
          </tr>

          <tr>
            <td style={styles.tdName}>{match.player_b || "Spieler B"}</td>
            <td style={styles.tdScore}>{match.set1_b ?? 0}</td>
            <td style={styles.tdScore}>{match.set2_b ?? 0}</td>
            <td style={styles.tdScore}>{match.set3_b ?? 0}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function cleanCourtName(court) {
  if (!court?.name) return "Court";

  const name = String(court.name).trim();

  if (name.toLowerCase().includes("center")) return "Center Court";
  if (name.toLowerCase().includes("centre")) return "Center Court";

  return name;
}

function getCourtSortValue(court) {
  const name = cleanCourtName(court).toLowerCase();

  if (name === "center court") return Number(court?.sort_order) || 999;

  return Number(court?.sort_order) || 999;
}

function StatusPill({ children, color }) {
  return (
    <div
      style={{
        ...styles.statusPill,
        color,
        borderColor: hexToRgba(color, 0.45),
        background: hexToRgba(color, 0.08),
      }}
    >
      {children}
    </div>
  );
}

function labelStatus(status) {
  if (status === "live") return "LIVE";
  if (status === "planned") return "GEPLANT";
  if (status === "finished") return "BEENDET";
  return status || "-";
}

function formatTime(date) {
  return new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(255,255,255,${alpha})`;

  let clean = hex.replace("#", "").trim();

  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }

  if (clean.length !== 6) {
    return `rgba(255,255,255,${alpha})`;
  }

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function activeButton(color) {
  return {
    background: hexToRgba(color, 0.22),
    borderColor: color,
    color: "#ffffff",
    boxShadow: `0 0 18px ${hexToRgba(color, 0.35)}`,
  };
}

const styles = {
  page: {
    width: "100vw",
    minHeight: "100vh",
    padding: 2,
    margin: 0,
    boxSizing: "border-box",
    fontFamily: "Arial, sans-serif",
    overflowX: "hidden",
  },

  hero: {
    minHeight: 124,
    padding: "16px 26px",
    borderRadius: 20,
    background:
      "linear-gradient(135deg, rgba(4,12,31,0.96), rgba(7,20,48,0.96))",
    border: "1px solid rgba(107,231,255,0.18)",
    boxShadow: "0 20px 70px rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
    width: "100%",
    boxSizing: "border-box",
  },

  heroLeft: {
    display: "flex",
    alignItems: "center",
    gap: 24,
  },

  logo: {
    width: 112,
    height: 112,
    borderRadius: 20,
    objectFit: "contain",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    padding: 8,
  },

  logoFallback: {
    width: 112,
    height: 112,
    borderRadius: 20,
    background: "rgba(107,231,255,0.12)",
    border: "1px solid rgba(107,231,255,0.28)",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 30,
  },

  kicker: {
    fontSize: 14,
    letterSpacing: 4,
    fontWeight: 900,
    marginBottom: 8,
  },

  heroTitle: {
    margin: 0,
    fontSize: 52,
    lineHeight: 1,
    fontWeight: 900,
    letterSpacing: 0.5,
    color: "#ffffff",
  },

  heroSub: {
    marginTop: 12,
    fontSize: 18,
    color: "#b9c8e6",
  },

  heroRight: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },

  statusPill: {
    padding: "12px 16px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 800,
    fontSize: 14,
  },

  nav: {
    marginTop: 8,
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  navButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.05)",
    color: "#fff",
    fontWeight: 900,
    cursor: "pointer",
  },

  navInfo: {
    padding: "12px 16px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    color: "#b9c8e6",
    fontWeight: 700,
  },

  mainPanel: {
    marginTop: 8,
    borderRadius: 18,
    background: "rgba(6,15,38,0.86)",
    border: "1px solid rgba(255,255,255,0.11)",
    padding: 18,
    minHeight: "calc(100vh - 255px)",
    width: "100%",
    boxSizing: "border-box",
  },

  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  panelTitle: {
    margin: 0,
    fontSize: 30,
    fontWeight: 900,
    color: "#ffffff",
  },

  panelSub: {
    marginTop: 6,
    color: "#b9c8e6",
    fontSize: 14,
  },

  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
  },

  matchCard: {
    borderRadius: 18,
    background: "rgba(18,30,61,0.9)",
    border: "2px solid",
    padding: 18,
    transition: "all 0.25s ease",
    minHeight: 300,
  },

  cardTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },

  courtName: {
    fontSize: 32,
    fontWeight: 900,
  },

  badge: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 900,
    fontSize: 12,
  },

  players: {
    display: "flex",
    justifyContent: "center",
    gap: 14,
    alignItems: "center",
    fontSize: 30,
    fontWeight: 900,
    marginBottom: 8,
    textAlign: "center",
    color: "#ffffff",
  },

  vs: {
    opacity: 0.35,
    fontSize: 20,
  },

  mode: {
    textAlign: "center",
    color: "#b9c8e6",
    fontSize: 16,
    marginBottom: 18,
  },

  scoreTable: {
    width: "100%",
    borderCollapse: "collapse",
    background: "rgba(0,0,0,0.13)",
    borderRadius: 14,
    overflow: "hidden",
  },

  th: {
    padding: "10px 12px",
    color: "#9fb4d9",
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },

  tdName: {
    padding: "14px 12px",
    fontWeight: 900,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    color: "#ffffff",
  },

  tdScore: {
    padding: "14px 12px",
    textAlign: "center",
    fontSize: 22,
    fontWeight: 900,
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    color: "#ffffff",
  },

  empty: {
    padding: 40,
    textAlign: "center",
    color: "#b9c8e6",
  },

  footer: {
    marginTop: 8,
    padding: "12px 18px",
    borderRadius: 14,
    background: "rgba(6,15,38,0.86)",
    border: "1px solid rgba(255,255,255,0.11)",
    textAlign: "center",
    fontWeight: 900,
    color: "#b9c8e6",
  },
};