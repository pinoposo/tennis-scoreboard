import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "./lib/supabase/client";

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [saving, setSaving] = useState(false);

  const [organizations, setOrganizations] = useState([]);
  const [events, setEvents] = useState([]);
  const [courts, setCourts] = useState([]);
  const [players, setPlayers] = useState([]);
  const [matches, setMatches] = useState([]);
  const [brandingSettings, setBrandingSettings] = useState([]);

  const [selectedOrganization, setSelectedOrganization] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [selectedCourt, setSelectedCourt] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState("");

  const [playerA, setPlayerA] = useState("");
  const [playerB, setPlayerB] = useState("");
  const [matchMode, setMatchMode] = useState("Einzel");

  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventSubtitle, setNewEventSubtitle] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newCourtCount, setNewCourtCount] = useState(4);

  const [eventTitleInput, setEventTitleInput] = useState("");
  const [eventSubtitleInput, setEventSubtitleInput] = useState("");
  const [eventLocationInput, setEventLocationInput] = useState("");
  const [eventLogoUrlInput, setEventLogoUrlInput] = useState("");
  const [logoFile, setLogoFile] = useState(null);
  const [courtCountInput, setCourtCountInput] = useState(4);

  const [monitorTitle, setMonitorTitle] = useState("LIVE SCOREBOARD");
  const [monitorSubtitle, setMonitorSubtitle] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#90ff61");
  const [accentColor, setAccentColor] = useState("#13378b");
  const [backgroundStyle, setBackgroundStyle] = useState("dark");

  const [textColor, setTextColor] = useState("#ffffff");
  const [backgroundColor, setBackgroundColor] = useState("#0a1f44");
  const [borderColor, setBorderColor] = useState("#00ff9d");
  const [sponsorText, setSponsorText] = useState("Präsentiert von GP23 Sport");

  const [editorDirty, setEditorDirty] = useState(false);
  const [adminTab, setAdminTab] = useState("admin");

  const [playerAssignment, setPlayerAssignment] = useState(null);
  const [playerMatch, setPlayerMatch] = useState(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data.session || null);
      } finally {
        if (mounted) setAuthReady(true);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession || null);
      }
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setProfile(null);
      setPlayerAssignment(null);
      setPlayerMatch(null);
      setOrganizations([]);
      setEvents([]);
      setCourts([]);
      setPlayers([]);
      setMatches([]);
      setBrandingSettings([]);
      return;
    }

    loadProfile();
  }, [session]);

  useEffect(() => {
    if (!profile) return;

    if (profile.role === "admin") loadAdminData();
    if (profile.role === "player") loadPlayerData();
  }, [profile]);

  useEffect(() => {
    if (!selectedEvent) {
      setSelectedCourt("");
      return;
    }

    const matchingCourts = courts.filter(
      (c) => String(c.event_id) === String(selectedEvent)
    );

    if (matchingCourts.length === 0) {
      setSelectedCourt("");
      return;
    }

    const courtStillExists = matchingCourts.some(
      (c) => String(c.id) === String(selectedCourt)
    );

    if (!courtStillExists) {
      setSelectedCourt(String(matchingCourts[0].id));
    }
  }, [selectedEvent, courts, selectedCourt]);

  useEffect(() => {
    if (!selectedEvent) {
      resetEditorFields();
      setEditorDirty(false);
      return;
    }

    const currentEvent = events.find(
      (e) => String(e.id) === String(selectedEvent)
    );

    if (!currentEvent) {
      resetEditorFields();
      setEditorDirty(false);
      return;
    }

    const branding = brandingSettings.find(
      (b) => String(b.event_id) === String(selectedEvent)
    );

    if (editorDirty) return;

    setEventTitleInput(currentEvent.title || "");
    setEventSubtitleInput(currentEvent.subtitle || "");
    setEventLocationInput(currentEvent.location || "");
    setEventLogoUrlInput(branding?.logo_url || "");
    setLogoFile(null);

    const eventCourts = courts.filter(
      (c) => String(c.event_id) === String(selectedEvent)
    );
    setCourtCountInput(eventCourts.length || 1);

    if (currentEvent.organization_id) {
      setSelectedOrganization(String(currentEvent.organization_id));
    }

    setMonitorTitle(branding?.monitor_title || "LIVE SCOREBOARD");
    setMonitorSubtitle(branding?.monitor_subtitle || "");
    setPrimaryColor(branding?.primary_color || "#90ff61");
    setAccentColor(branding?.accent_color || "#13378b");
    setBackgroundStyle(branding?.background_style || "dark");

    setTextColor(branding?.text_color || "#ffffff");
    setBackgroundColor(branding?.background_color || "#0a1f44");
    setBorderColor(branding?.border_color || "#00ff9d");
    setSponsorText(branding?.sponsor_text || "Präsentiert von GP23 Sport");
  }, [selectedEvent, events, courts, brandingSettings, editorDirty]);

  function resetEditorFields() {
    setEventTitleInput("");
    setEventSubtitleInput("");
    setEventLocationInput("");
    setEventLogoUrlInput("");
    setLogoFile(null);
    setCourtCountInput(4);
    setMonitorTitle("LIVE SCOREBOARD");
    setMonitorSubtitle("");
    setPrimaryColor("#90ff61");
    setAccentColor("#13378b");
    setBackgroundStyle("dark");
    setTextColor("#ffffff");
    setBackgroundColor("#0a1f44");
    setBorderColor("#00ff9d");
    setSponsorText("Präsentiert von GP23 Sport");
  }

  async function loadProfile() {
    const userId = session.user.id;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Profil-Fehler:", error);
      setProfile(null);
      return;
    }

    setProfile(data);
  }

  async function loadAdminData() {
    setMessage("");

    const [orgRes, eventsRes, courtsRes, playersRes, matchesRes, brandingRes] =
      await Promise.all([
        supabase.from("organizations").select("*").order("created_at", { ascending: true }),
        supabase.from("events").select("*").order("created_at", { ascending: false }),
        supabase.from("courts").select("*").order("sort_order", { ascending: true }),
        supabase.from("profiles").select("*").eq("role", "player"),
        supabase.from("matches").select("*").order("created_at", { ascending: false }),
        supabase.from("branding_settings").select("*"),
      ]);

    if (orgRes.error) return setMessage(`Fehler Organisationen: ${orgRes.error.message}`);
    if (eventsRes.error) return setMessage(`Fehler Events: ${eventsRes.error.message}`);
    if (courtsRes.error) return setMessage(`Fehler Courts: ${courtsRes.error.message}`);
    if (playersRes.error) return setMessage(`Fehler Player: ${playersRes.error.message}`);
    if (matchesRes.error) return setMessage(`Fehler Matches: ${matchesRes.error.message}`);
    if (brandingRes.error) return setMessage(`Fehler Branding: ${brandingRes.error.message}`);

    const loadedOrganizations = orgRes.data || [];
    const loadedEvents = eventsRes.data || [];
    const loadedCourts = courtsRes.data || [];

    setOrganizations(loadedOrganizations);
    setEvents(loadedEvents);
    setCourts(loadedCourts);
    setPlayers(playersRes.data || []);
    setMatches(matchesRes.data || []);
    setBrandingSettings(brandingRes.data || []);

    if (loadedOrganizations.length > 0) {
      const orgStillExists = loadedOrganizations.some(
        (o) => String(o.id) === String(selectedOrganization)
      );
      if (!orgStillExists) setSelectedOrganization(String(loadedOrganizations[0].id));
    } else {
      setSelectedOrganization("");
    }

    if (loadedEvents.length === 0) {
      setSelectedEvent("");
      setSelectedCourt("");
      return;
    }

    const selectedStillExists = loadedEvents.some(
      (e) => String(e.id) === String(selectedEvent)
    );

    const nextSelectedEvent = selectedStillExists
      ? String(selectedEvent)
      : String(loadedEvents[0].id);

    setSelectedEvent(nextSelectedEvent);

    const selectedEventObj = loadedEvents.find(
      (e) => String(e.id) === String(nextSelectedEvent)
    );

    if (selectedEventObj?.organization_id) {
      setSelectedOrganization(String(selectedEventObj.organization_id));
    }

    const matchingCourts = loadedCourts.filter(
      (c) => String(c.event_id) === String(nextSelectedEvent)
    );

    if (matchingCourts.length === 0) {
      setSelectedCourt("");
      return;
    }

    const courtStillExists = matchingCourts.some(
      (c) => String(c.id) === String(selectedCourt)
    );

    if (!courtStillExists) {
      setSelectedCourt(String(matchingCourts[0].id));
    }
  }

  async function loadPlayerData() {
    setMessage("");

    const { data: assignments, error: assignmentError } = await supabase
      .from("player_assignments")
      .select("*")
      .eq("profile_id", session.user.id)
      .limit(1);

    if (assignmentError) {
      setMessage(`Fehler Spieler-Zuordnung: ${assignmentError.message}`);
      return;
    }

    if (!assignments || assignments.length === 0) {
      setPlayerAssignment(null);
      setPlayerMatch(null);
      setMessage("Kein Court für diesen Spieler zugeordnet.");
      return;
    }

    const assignment = assignments[0];
    setPlayerAssignment(assignment);

    const { data: matchesData, error: matchError } = await supabase
      .from("matches")
      .select("*")
      .eq("event_id", assignment.event_id)
      .eq("court_id", assignment.court_id)
      .limit(1);

    if (matchError) {
      setMessage(`Fehler Match: ${matchError.message}`);
      return;
    }

    if (!matchesData || matchesData.length === 0) {
      setPlayerMatch(null);
      setMessage("Kein Match auf diesem Court gefunden.");
      return;
    }

    setPlayerMatch(matchesData[0]);
  }

  async function handleLogin() {
    setLoggingIn(true);
    setMessage("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) setMessage(error.message);
    setLoggingIn(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    setProfile(null);
    setPlayerAssignment(null);
    setPlayerMatch(null);
    setMessage("");
  }

  async function createEvent() {
    if (!newEventTitle.trim()) return setMessage("Bitte einen Turniernamen eingeben.");
    if (!selectedOrganization) return setMessage("Bitte zuerst eine Organisation auswählen.");

    setSaving(true);
    setMessage("");

    const { data, error } = await supabase
      .from("events")
      .insert({
        organization_id: selectedOrganization,
        title: newEventTitle.trim(),
        subtitle: newEventSubtitle.trim() || null,
        location: newEventLocation.trim() || null,
      })
      .select()
      .single();

    if (error) {
      setSaving(false);
      setMessage(`Fehler Event: ${error.message}`);
      return;
    }

    try {
      await ensureCourtCount(data.id, newCourtCount || 1);
      await ensureBrandingRow(data.id);
    } catch (setupError) {
      setMessage(`Event erstellt, aber Setup unvollständig: ${setupError.message || setupError}`);
    }

    setSaving(false);
    setMessage("Event erstellt.");
    setNewEventTitle("");
    setNewEventSubtitle("");
    setNewEventLocation("");
    setNewCourtCount(4);

    await loadAdminData();

    if (data?.id) {
      setSelectedEvent(String(data.id));
      if (data.organization_id) setSelectedOrganization(String(data.organization_id));
    }
  }

  async function ensureCourtCount(eventId, desiredCount) {
    const safeCount = Math.max(1, Number(desiredCount) || 1);

    const { data: existingCourts, error } = await supabase
      .from("courts")
      .select("*")
      .eq("event_id", eventId)
      .order("sort_order", { ascending: true });

    if (error) throw error;

    const currentCount = existingCourts?.length || 0;
    if (currentCount >= safeCount) return;

    const inserts = [];
    for (let i = currentCount + 1; i <= safeCount; i += 1) {
      inserts.push({
        event_id: eventId,
        name: `Court ${i}`,
        sort_order: i,
      });
    }

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from("courts").insert(inserts);
      if (insertError) throw insertError;
    }
  }

  async function ensureBrandingRow(eventId) {
    const existing = brandingSettings.find(
      (b) => String(b.event_id) === String(eventId)
    );

    if (existing) return;

    const { error } = await supabase.from("branding_settings").insert({
      event_id: eventId,
      logo_url: null,
      monitor_title: "LIVE SCOREBOARD",
      monitor_subtitle: "",
      primary_color: "#90ff61",
      accent_color: "#13378b",
      background_style: "dark",
      text_color: "#ffffff",
      background_color: "#0a1f44",
      border_color: "#00ff9d",
      sponsor_text: "Präsentiert von GP23 Sport",
    });

    if (error) throw error;
  }

  async function createMatch() {
    if (!selectedEvent || !selectedCourt) return setMessage("Bitte Event und Court auswählen.");
    if (!playerA.trim() || !playerB.trim()) return setMessage("Bitte Spieler A und Spieler B eingeben.");

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("matches").insert({
      event_id: selectedEvent,
      court_id: selectedCourt,
      mode: matchMode,
      status: "planned",
      player_a: playerA.trim(),
      player_b: playerB.trim(),
      set1_a: 0,
      set1_b: 0,
      set2_a: 0,
      set2_b: 0,
      set3_a: 0,
      set3_b: 0,
    });

    setSaving(false);

    if (error) return setMessage(`Fehler Match: ${error.message}`);

    setMessage("Match erstellt.");
    setPlayerA("");
    setPlayerB("");
    await loadAdminData();
  }

  async function assignPlayer() {
    if (!selectedPlayer || !selectedEvent || !selectedCourt) {
      return setMessage("Bitte Player, Event und Court auswählen.");
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase.from("player_assignments").upsert({
      profile_id: selectedPlayer,
      event_id: selectedEvent,
      court_id: selectedCourt,
    });

    setSaving(false);

    if (error) return setMessage(`Fehler Player-Zuweisung: ${error.message}`);
    setMessage("Player zugewiesen.");
  }

  async function uploadEventLogo(file) {
    if (!selectedEvent) throw new Error("Bitte zuerst ein Event auswählen.");

    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const safeExtension = extension.replace(/[^a-z0-9]/g, "") || "png";
    const filePath = `${selectedEvent}/logo-${Date.now()}.${safeExtension}`;

    const { error: uploadError } = await supabase.storage
      .from("event-logos")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("event-logos").getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function saveBrandingEditor() {
    if (!selectedEvent) {
      setMessage("Bitte zuerst ein Event auswählen.");
      return false;
    }

    if (!selectedOrganization) {
      setMessage("Bitte eine Organisation auswählen.");
      return false;
    }

    setSaving(true);
    setMessage("");

    try {
      let finalLogoUrl = eventLogoUrlInput.trim() || null;

      if (logoFile) finalLogoUrl = await uploadEventLogo(logoFile);

      const { error: eventError } = await supabase
        .from("events")
        .update({
          organization_id: selectedOrganization,
          title: eventTitleInput.trim(),
          subtitle: eventSubtitleInput.trim() || null,
          location: eventLocationInput.trim() || null,
        })
        .eq("id", selectedEvent);

      if (eventError) throw eventError;

      const existingBranding = brandingSettings.find(
        (b) => String(b.event_id) === String(selectedEvent)
      );

      const brandingPayload = {
        event_id: selectedEvent,
        logo_url: finalLogoUrl,
        monitor_title: monitorTitle.trim() || "LIVE SCOREBOARD",
        monitor_subtitle: monitorSubtitle.trim() || null,
        primary_color: primaryColor,
        accent_color: accentColor,
        background_style: backgroundStyle,
        text_color: textColor,
        background_color: backgroundColor,
        border_color: borderColor,
        sponsor_text: sponsorText.trim() || null,
      };

      if (existingBranding) {
        const { error } = await supabase
          .from("branding_settings")
          .update(brandingPayload)
          .eq("event_id", selectedEvent);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("branding_settings").insert(brandingPayload);
        if (error) throw error;
      }

      await ensureCourtCount(selectedEvent, courtCountInput);

      setMessage("Branding und Event-Daten gespeichert.");
      setLogoFile(null);
      setEditorDirty(false);
      await loadAdminData();
      return true;
    } catch (error) {
      setMessage(`Fehler Branding: ${error.message || error}`);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function removeEventLogo() {
    if (!selectedEvent) return setMessage("Bitte zuerst ein Event auswählen.");

    setSaving(true);
    setMessage("");

    try {
      const { error } = await supabase
        .from("branding_settings")
        .update({ logo_url: null })
        .eq("event_id", selectedEvent);

      if (error) throw error;

      setEventLogoUrlInput("");
      setLogoFile(null);
      setEditorDirty(false);
      setMessage("Logo entfernt.");
      await loadAdminData();
    } catch (error) {
      setMessage(`Fehler Logo: ${error.message || error}`);
    } finally {
      setSaving(false);
    }
  }

  async function openMonitorForEvent() {
    if (!selectedEvent) return setMessage("Bitte zuerst ein Event auswählen.");

    const ok = await saveBrandingEditor();
    if (!ok) return;

    const url = `${window.location.origin}/monitor?event=${selectedEvent}`;
    window.open(url, "_blank");
  }

  function updateLocalScore(field, value) {
    setPlayerMatch((prev) => ({
      ...prev,
      [field]: Math.max(0, value),
    }));
  }

  function addPoint(field) {
    if (!playerMatch) return;
    updateLocalScore(field, (playerMatch[field] || 0) + 1);
  }

  function removePoint(field) {
    if (!playerMatch) return;
    updateLocalScore(field, Math.max(0, (playerMatch[field] || 0) - 1));
  }

  function changeStatus(status) {
    if (!playerMatch) return;
    setPlayerMatch((prev) => ({ ...prev, status }));
  }

  async function savePlayerMatch() {
    if (!playerMatch) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("matches")
      .update({
        status: playerMatch.status,
        set1_a: Number(playerMatch.set1_a) || 0,
        set1_b: Number(playerMatch.set1_b) || 0,
        set2_a: Number(playerMatch.set2_a) || 0,
        set2_b: Number(playerMatch.set2_b) || 0,
        set3_a: Number(playerMatch.set3_a) || 0,
        set3_b: Number(playerMatch.set3_b) || 0,
      })
      .eq("id", playerMatch.id);

    setSaving(false);

    if (error) return setMessage(`Fehler Speichern: ${error.message}`);

    setMessage("Ergebnis gespeichert.");
    await loadPlayerData();
  }

  const organizationName = (org) => org?.name || org?.title || org?.id || "-";
  const eventName = (event) => event?.title || event?.name || event?.id || "-";
  const courtName = (court) => court?.name || court?.id || "-";

  const selectedEventObj = useMemo(
    () => events.find((e) => String(e.id) === String(selectedEvent)),
    [events, selectedEvent]
  );

  const selectedBrandingObj = useMemo(
    () => brandingSettings.find((b) => String(b.event_id) === String(selectedEvent)),
    [brandingSettings, selectedEvent]
  );

  const previewLogoSrc = useMemo(() => {
    if (logoFile) return URL.createObjectURL(logoFile);
    if (eventLogoUrlInput) return eventLogoUrlInput;
    if (selectedBrandingObj?.logo_url) return selectedBrandingObj.logo_url;
    return null;
  }, [logoFile, eventLogoUrlInput, selectedBrandingObj]);

  const filteredCourts = useMemo(() => {
    return courts.filter((c) => String(c.event_id) === String(selectedEvent));
  }, [courts, selectedEvent]);

  const selectedCourtObj = useMemo(
    () => courts.find((c) => String(c.id) === String(selectedCourt)),
    [courts, selectedCourt]
  );

  const filteredMatchesByEvent = useMemo(() => {
    if (!selectedEvent) return matches;
    return matches.filter((m) => String(m.event_id) === String(selectedEvent));
  }, [matches, selectedEvent]);

  const headerLogo = selectedBrandingObj?.logo_url;

  if (window.location.pathname === "/player") {
    return <PlayerQRPage />;
  }

  if (!authReady) {
    return (
      <PageShell>
        <LoginCard title="Lade Login..." />
      </PageShell>
    );
  }

  if (!session) {
    return (
      <PageShell>
        <div style={{ ...styles.authCard, maxWidth: 460 }}>
          <div style={styles.authKicker}>LIVE TENNIS CONTROL</div>
          <h1 style={styles.authTitle}>Login</h1>
          {message && <InfoBox>{message}</InfoBox>}

          <input placeholder="E-Mail" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} />
          <input type="password" placeholder="Passwort" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} />

          <button type="button" onClick={handleLogin} style={styles.primaryButtonFull} disabled={loggingIn}>
            {loggingIn ? "Einloggen..." : "Einloggen"}
          </button>
        </div>
      </PageShell>
    );
  }

  if (!profile) {
    return (
      <PageShell>
        <div style={{ ...styles.authCard, maxWidth: 560 }}>
          <h1 style={styles.authTitle}>Kein Profil gefunden</h1>
          <p style={styles.muted}>Für diesen User gibt es keinen Eintrag in profiles.</p>
          <div style={{ marginTop: 20, lineHeight: 1.7 }}>
            <div><strong>User-ID:</strong> {session.user.id}</div>
            <div><strong>E-Mail:</strong> {session.user.email}</div>
          </div>
          <button type="button" onClick={handleLogout} style={styles.primaryButtonFull}>Logout</button>
        </div>
      </PageShell>
    );
  }

  if (profile.role === "admin") {
    return (
      <div style={styles.page}>
        <header style={styles.hero}>
          <div style={styles.heroLeft}>
            {headerLogo ? (
              <img src={headerLogo} alt="Logo" style={styles.logo} />
            ) : (
              <div style={styles.logoFallback}>TS</div>
            )}
            <div>
              <div style={styles.kicker}>LIVE TENNIS CONTROL</div>
              <h1 style={styles.heroTitle}>Online Turniersteuerung 2.3</h1>
              <div style={styles.heroSub}>Admin Panel · Event, Branding, Matches und Player-Zugänge</div>
            </div>
          </div>

          <div style={styles.heroRight}>
            <StatusPill color="#6be7ff">Online live</StatusPill>
            <StatusPill color="#ffffff">Turnierleitung</StatusPill>
            <StatusPill color="#ffffff">{session.user.email}</StatusPill>
          </div>
        </header>

        <nav style={styles.tabs}>
          <button type="button" style={adminTab === "admin" ? styles.tabActive : styles.tab} onClick={() => setAdminTab("admin")}>Admin</button>
          <button type="button" style={styles.tab} onClick={openMonitorForEvent}>Monitor</button>
          <button type="button" style={adminTab === "qr" ? styles.tabActive : styles.tab} onClick={() => setAdminTab("qr")}>QR-Codes</button>
          <button type="button" style={styles.tab} onClick={() => { setAdminTab("qr"); setTimeout(() => window.print(), 300); }}>Druck</button>
          <button type="button" style={styles.tab} onClick={handleLogout}>Logout</button>
        </nav>

        {message && <InfoBox>{message}</InfoBox>}

        <section style={styles.quickBar}>
          <div>
            <div style={styles.quickLabel}>Aktives Event</div>
            <div style={styles.quickValue}>{eventName(selectedEventObj)}</div>
          </div>
          <div>
            <div style={styles.quickLabel}>Courts</div>
            <div style={styles.quickValue}>{filteredCourts.length}</div>
          </div>
          <div>
            <div style={styles.quickLabel}>Matches</div>
            <div style={styles.quickValue}>{filteredMatchesByEvent.length}</div>
          </div>
          <button type="button" style={styles.monitorButton} onClick={openMonitorForEvent}>
            Monitor für aktives Event öffnen
          </button>
        </section>

        {adminTab === "qr" && (
          <QRPrintPanel eventId={selectedEvent} eventTitle={eventName(selectedEventObj)} courts={filteredCourts} />
        )}

        {adminTab === "admin" && (
          <main style={styles.adminGrid}>
            <aside style={styles.leftColumn}>
              <Panel title="Event erstellen" subtitle="Neues Turnier mit Courts anlegen">
                <FormLabel>Organisation</FormLabel>
                <select value={String(selectedOrganization || "")} onChange={(e) => setSelectedOrganization(String(e.target.value))} style={styles.input}>
                  <option value="">Organisation wählen</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={String(org.id)}>{organizationName(org)}</option>
                  ))}
                </select>

                <FormLabel>Neuer Turniername</FormLabel>
                <input value={newEventTitle} onChange={(e) => setNewEventTitle(e.target.value)} placeholder="z. B. Waske Open" style={styles.input} />

                <FormLabel>Untertitel</FormLabel>
                <input value={newEventSubtitle} onChange={(e) => setNewEventSubtitle(e.target.value)} placeholder="optional" style={styles.input} />

                <FormLabel>Ort</FormLabel>
                <input value={newEventLocation} onChange={(e) => setNewEventLocation(e.target.value)} placeholder="z. B. Frankfurt" style={styles.input} />

                <FormLabel>Anzahl Courts</FormLabel>
                <input type="number" min="1" value={newCourtCount} onChange={(e) => setNewCourtCount(Number(e.target.value) || 1)} style={styles.input} />

                <button type="button" onClick={createEvent} style={styles.primaryButtonFull} disabled={saving}>
                  {saving ? "Speichern..." : "Event erstellen"}
                </button>
              </Panel>

              <Panel title="Match erstellen" subtitle="Match einem Court zuweisen">
                <FormLabel>Event</FormLabel>
                <EventSelect events={events} selectedEvent={selectedEvent} setSelectedEvent={setSelectedEvent} setEditorDirty={setEditorDirty} eventName={eventName} />

                <FormLabel>Court</FormLabel>
                <CourtSelect courts={filteredCourts} selectedCourt={selectedCourt} setSelectedCourt={setSelectedCourt} courtName={courtName} />

                <div style={styles.twoCols}>
                  <div>
                    <FormLabel>Modus</FormLabel>
                    <select value={matchMode} onChange={(e) => setMatchMode(e.target.value)} style={styles.input}>
                      <option value="Einzel">Einzel</option>
                      <option value="Doppel">Doppel</option>
                      <option value="Mannschaft">Mannschaft</option>
                    </select>
                  </div>
                  <div>
                    <FormLabel>Status</FormLabel>
                    <input value="planned" readOnly style={styles.inputMuted} />
                  </div>
                </div>

                <FormLabel>Spieler / Team A</FormLabel>
                <input value={playerA} onChange={(e) => setPlayerA(e.target.value)} placeholder="Spieler A" style={styles.input} />

                <FormLabel>Spieler / Team B</FormLabel>
                <input value={playerB} onChange={(e) => setPlayerB(e.target.value)} placeholder="Spieler B" style={styles.input} />

                <button type="button" onClick={createMatch} style={styles.primaryButtonFull} disabled={saving}>
                  {saving ? "Speichern..." : "Match erstellen"}
                </button>
              </Panel>
            </aside>

            <section style={styles.rightColumn}>
              <Panel title="Admin Branding Editor" subtitle="Look & Feel des Monitors steuern">
                <div style={styles.editorGrid}>
                  <div>
                    <FormLabel>Event</FormLabel>
                    <EventSelect events={events} selectedEvent={selectedEvent} setSelectedEvent={setSelectedEvent} setEditorDirty={setEditorDirty} eventName={eventName} />

                    <FormLabel>Organisation</FormLabel>
                    <select value={String(selectedOrganization || "")} onChange={(e) => { setEditorDirty(true); setSelectedOrganization(String(e.target.value)); }} style={styles.input}>
                      <option value="">Organisation wählen</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={String(org.id)}>{organizationName(org)}</option>
                      ))}
                    </select>

                    <FormLabel>Turniername</FormLabel>
                    <input value={eventTitleInput} onChange={(e) => { setEditorDirty(true); setEventTitleInput(e.target.value); }} placeholder="z. B. Sommer Open 2026" style={styles.input} />

                    <FormLabel>Untertitel</FormLabel>
                    <input value={eventSubtitleInput} onChange={(e) => { setEditorDirty(true); setEventSubtitleInput(e.target.value); }} placeholder="optional" style={styles.input} />

                    <FormLabel>Ort</FormLabel>
                    <input value={eventLocationInput} onChange={(e) => { setEditorDirty(true); setEventLocationInput(e.target.value); }} placeholder="z. B. Frankfurt" style={styles.input} />

                    <FormLabel>Anzahl Courts</FormLabel>
                    <input type="number" min="1" value={courtCountInput} onChange={(e) => { setEditorDirty(true); setCourtCountInput(Number(e.target.value) || 1); }} style={styles.input} />
                  </div>

                  <div>
                    <FormLabel>Monitor-Titel</FormLabel>
                    <input value={monitorTitle} onChange={(e) => { setEditorDirty(true); setMonitorTitle(e.target.value); }} placeholder="LIVE SCOREBOARD" style={styles.input} />

                    <FormLabel>Monitor-Untertitel</FormLabel>
                    <input value={monitorSubtitle} onChange={(e) => { setEditorDirty(true); setMonitorSubtitle(e.target.value); }} placeholder="optional" style={styles.input} />

                    <div style={styles.colorGrid}>
                      <ColorField label="Primär" value={primaryColor} onChange={(v) => { setEditorDirty(true); setPrimaryColor(v); }} />
                      <ColorField label="Akzent" value={accentColor} onChange={(v) => { setEditorDirty(true); setAccentColor(v); }} />
                      <ColorField label="Text" value={textColor} onChange={(v) => { setEditorDirty(true); setTextColor(v); }} />
                      <ColorField label="Hintergrund" value={backgroundColor} onChange={(v) => { setEditorDirty(true); setBackgroundColor(v); }} />
                      <ColorField label="Rahmen" value={borderColor} onChange={(v) => { setEditorDirty(true); setBorderColor(v); }} />
                    </div>

                    <FormLabel>Hintergrund-Stil</FormLabel>
                    <select value={backgroundStyle} onChange={(e) => { setEditorDirty(true); setBackgroundStyle(e.target.value); }} style={styles.input}>
                      <option value="dark">dark</option>
                      <option value="light">light</option>
                      <option value="gradient">gradient</option>
                    </select>

                    <FormLabel>Sponsor-Text</FormLabel>
                    <input value={sponsorText} onChange={(e) => { setEditorDirty(true); setSponsorText(e.target.value); }} placeholder="z. B. GP23 Immobilien präsentiert" style={styles.input} />

                    <FormLabel>Logo hochladen</FormLabel>
                    <input type="file" accept="image/*" onChange={(e) => { setEditorDirty(true); setLogoFile(e.target.files?.[0] || null); }} style={styles.fileInput} />

                    {logoFile ? <div style={styles.fileNote}>Neue Datei: <strong>{logoFile.name}</strong></div> : null}
                  </div>
                </div>

                <div style={styles.previewRow}>
                  <div
                    style={{
                      ...styles.previewBox,
                      background:
                        backgroundStyle === "gradient"
                          ? `linear-gradient(135deg, ${backgroundColor} 0%, ${accentColor} 100%)`
                          : backgroundColor,
                      color: textColor,
                      border: `2px solid ${borderColor}`,
                      boxShadow: `0 0 22px ${hexToRgba(borderColor, 0.28)}`,
                    }}
                  >
                    <div style={styles.previewHeader}>
                      {previewLogoSrc ? (
                        <img src={previewLogoSrc} alt="Logo Vorschau" style={styles.previewLogo} onError={(e) => (e.currentTarget.style.display = "none")} />
                      ) : (
                        <div style={styles.previewLogoFallback}>TS</div>
                      )}

                      <div>
                        <div style={{ ...styles.previewKicker, color: primaryColor }}>LIVE TENNIS CONTROL</div>
                        <div style={{ ...styles.previewTitle, color: textColor }}>{eventTitleInput || "Turniername"}</div>
                        <div style={{ ...styles.previewSub, color: hexToRgba(textColor, 0.78) }}>
                          {monitorSubtitle || eventSubtitleInput || "Monitor Vorschau"}
                        </div>
                      </div>
                    </div>

                    <div style={styles.previewMiniNav}>
                      <span style={{ ...styles.previewPill, borderColor, color: textColor, background: hexToRgba(borderColor, 0.18) }}>Alle Matches</span>
                      <span style={{ ...styles.previewPill, borderColor: accentColor, color: accentColor, background: hexToRgba(accentColor, 0.18) }}>LIVE</span>
                    </div>
                  </div>

                  {selectedBrandingObj?.logo_url ? (
                    <div style={styles.logoPreviewBox}>
                      <div style={styles.miniLabel}>Aktuelles Logo</div>
                      <img src={selectedBrandingObj.logo_url} alt="Logo Vorschau" style={styles.logoPreview} />
                    </div>
                  ) : null}
                </div>

                <div style={styles.actionRow}>
                  <button type="button" onClick={saveBrandingEditor} style={styles.primaryButton} disabled={saving}>
                    {saving ? "Speichern..." : "Branding & Event speichern"}
                  </button>
                  <button type="button" onClick={removeEventLogo} style={styles.ghostButton} disabled={saving}>Logo entfernen</button>
                </div>
              </Panel>

              <div style={styles.bottomGrid}>
                <Panel title="Player zuweisen" subtitle="Player-Zugang an Court koppeln">
                  <FormLabel>Player</FormLabel>
                  <select value={selectedPlayer} onChange={(e) => setSelectedPlayer(e.target.value)} style={styles.input}>
                    <option value="">Player wählen</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name || p.id}</option>
                    ))}
                  </select>

                  <FormLabel>Event</FormLabel>
                  <EventSelect events={events} selectedEvent={selectedEvent} setSelectedEvent={setSelectedEvent} setEditorDirty={setEditorDirty} eventName={eventName} />

                  <FormLabel>Court</FormLabel>
                  <CourtSelect courts={filteredCourts} selectedCourt={selectedCourt} setSelectedCourt={setSelectedCourt} courtName={courtName} />

                  <div style={styles.selectionNote}>
                    <div><strong>Event:</strong> {eventName(selectedEventObj)}</div>
                    <div><strong>Court:</strong> {courtName(selectedCourtObj)}</div>
                  </div>

                  <button type="button" onClick={assignPlayer} style={styles.primaryButtonFull} disabled={saving}>
                    {saving ? "Speichern..." : "Player zuweisen"}
                  </button>
                </Panel>

                <Panel title="Vorhandene Matches" subtitle="Aktueller Stand des Events">
                  {filteredMatchesByEvent.length === 0 ? (
                    <div style={styles.emptyText}>Keine Matches für dieses Event vorhanden.</div>
                  ) : (
                    <div style={styles.matchList}>
                      {filteredMatchesByEvent.map((m) => {
                        const courtObj = courts.find((c) => String(c.id) === String(m.court_id));
                        return (
                          <div key={m.id} style={styles.matchItem}>
                            <div style={styles.matchItemTop}>
                              <strong>{m.player_a || "-"}</strong>
                              <span style={styles.vs}>vs</span>
                              <strong>{m.player_b || "-"}</strong>
                            </div>
                            <div style={styles.matchMeta}>{courtName(courtObj)} · {m.status} · {m.mode}</div>
                            <div style={styles.matchScore}>S1 {m.set1_a ?? 0}:{m.set1_b ?? 0} · S2 {m.set2_a ?? 0}:{m.set2_b ?? 0} · MTB {m.set3_a ?? 0}:{m.set3_b ?? 0}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </Panel>
              </div>
            </section>
          </main>
        )}
      </div>
    );
  }

  if (profile.role === "player") {
    return (
      <div style={styles.pageCentered}>
        <div style={styles.authCardWide}>
          <h1 style={styles.authTitle}>Player UI</h1>
          <div style={{ marginBottom: 20 }}>
            <div><strong>{profile.full_name}</strong></div>
            <div style={styles.muted}>Rolle: {profile.role}</div>
            <div style={styles.muted}>Court: {playerAssignment?.court_id || "-"}</div>
          </div>

          {message && <InfoBox>{message}</InfoBox>}

          {!playerMatch ? (
            <>
              <p>Kein Match geladen.</p>
              <button type="button" onClick={loadPlayerData} style={styles.primaryButtonFull}>Neu laden</button>
              <button type="button" onClick={handleLogout} style={styles.ghostButtonFull}>Logout</button>
            </>
          ) : (
            <>
              <div style={styles.playerMatchBox}>
                <div style={styles.playerMatchTitle}>{playerMatch.player_a || "Spieler A"} gegen {playerMatch.player_b || "Spieler B"}</div>
                <div style={styles.muted}>Modus: {playerMatch.mode || "-"}</div>
                <div style={styles.muted}>Status: <strong>{playerMatch.status || "-"}</strong></div>
              </div>

              <div style={styles.statusButtonRow}>
                <button type="button" onClick={() => changeStatus("planned")} style={smallButton(playerMatch.status === "planned")}>Planned</button>
                <button type="button" onClick={() => changeStatus("live")} style={smallButton(playerMatch.status === "live")}>Live</button>
                <button type="button" onClick={() => changeStatus("finished")} style={smallButton(playerMatch.status === "finished")}>Finished</button>
              </div>

              <div style={styles.scoreGridPlayer}>
                <ScoreCard title="Satz 1" leftLabel={playerMatch.player_a || "A"} rightLabel={playerMatch.player_b || "B"} leftValue={playerMatch.set1_a || 0} rightValue={playerMatch.set1_b || 0} onLeftPlus={() => addPoint("set1_a")} onLeftMinus={() => removePoint("set1_a")} onRightPlus={() => addPoint("set1_b")} onRightMinus={() => removePoint("set1_b")} />
                <ScoreCard title="Satz 2" leftLabel={playerMatch.player_a || "A"} rightLabel={playerMatch.player_b || "B"} leftValue={playerMatch.set2_a || 0} rightValue={playerMatch.set2_b || 0} onLeftPlus={() => addPoint("set2_a")} onLeftMinus={() => removePoint("set2_a")} onRightPlus={() => addPoint("set2_b")} onRightMinus={() => removePoint("set2_b")} />
                <ScoreCard title="MTB" leftLabel={playerMatch.player_a || "A"} rightLabel={playerMatch.player_b || "B"} leftValue={playerMatch.set3_a || 0} rightValue={playerMatch.set3_b || 0} onLeftPlus={() => addPoint("set3_a")} onLeftMinus={() => removePoint("set3_a")} onRightPlus={() => addPoint("set3_b")} onRightMinus={() => removePoint("set3_b")} />
              </div>

              <button type="button" onClick={savePlayerMatch} style={styles.primaryButtonFull} disabled={saving}>{saving ? "Speichern..." : "Ergebnis speichern"}</button>
              <button type="button" onClick={handleLogout} style={styles.ghostButtonFull}>Logout</button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <div style={{ ...styles.authCard, maxWidth: 500 }}>
        <h1 style={styles.authTitle}>Rolle erkannt</h1>
        <p>{profile.full_name}</p>
        <p>Rolle: {profile.role}</p>
        <button type="button" onClick={handleLogout} style={styles.primaryButtonFull}>Logout</button>
      </div>
    </PageShell>
  );
}

function PlayerQRPage() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get("event");
  const courtId = params.get("court");

  const [match, setMatch] = useState(null);
  const [eventName, setEventName] = useState("");
  const [courtName, setCourtName] = useState("");
  const [loadingMatch, setLoadingMatch] = useState(true);
  const [playerMessage, setPlayerMessage] = useState("");
  const [savingScore, setSavingScore] = useState(false);

  useEffect(() => {
    loadPlayerPageData();
  }, [eventId, courtId]);

  function isSetFinished(a, b) {
    const x = Number(a || 0);
    const y = Number(b || 0);

    if (x >= 6 || y >= 6) {
      if (Math.abs(x - y) >= 2) return true;
      if (x === 7 || y === 7) return true;
    }

    return false;
  }

  function isMatchTiebreakFinished(a, b) {
    const x = Number(a || 0);
    const y = Number(b || 0);

    return (x >= 10 || y >= 10) && Math.abs(x - y) >= 2;
  }

  function getSetWinner(a, b) {
    const x = Number(a || 0);
    const y = Number(b || 0);

    if (!isSetFinished(x, y)) return null;
    return x > y ? "A" : "B";
  }

  function getMatchScoreState(currentMatch) {
    const s1Winner = getSetWinner(currentMatch.set1_a, currentMatch.set1_b);
    const s2Winner = getSetWinner(currentMatch.set2_a, currentMatch.set2_b);

    const setsA = [s1Winner, s2Winner].filter((w) => w === "A").length;
    const setsB = [s1Winner, s2Winner].filter((w) => w === "B").length;

    const set1Finished = Boolean(s1Winner);
    const set2Finished = Boolean(s2Winner);

    const needsMatchTiebreak = set1Finished && set2Finished && setsA === 1 && setsB === 1;
    const matchWonAfterTwoSets = set1Finished && set2Finished && (setsA === 2 || setsB === 2);
    const matchTiebreakFinished = isMatchTiebreakFinished(currentMatch.set3_a, currentMatch.set3_b);

    return {
      set1Finished,
      set2Finished,
      needsMatchTiebreak,
      matchWonAfterTwoSets,
      matchTiebreakFinished,
      matchFinished: matchWonAfterTwoSets || matchTiebreakFinished,
    };
  }

  async function loadPlayerPageData() {
    setLoadingMatch(true);
    setPlayerMessage("");

    if (!eventId || !courtId) {
      setPlayerMessage("Event oder Court fehlt im QR-Code.");
      setLoadingMatch(false);
      return;
    }

    const [eventRes, courtRes, matchRes] = await Promise.all([
      supabase
        .from("events")
        .select("title")
        .eq("id", eventId)
        .single(),

      supabase
        .from("courts")
        .select("name")
        .eq("id", courtId)
        .single(),

      supabase
        .from("matches")
        .select("*")
        .eq("event_id", eventId)
        .eq("court_id", courtId)
        .in("status", ["live", "planned"])
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    setEventName(eventRes.data?.title || eventId);
    setCourtName(courtRes.data?.name || courtId);

    if (matchRes.error) {
      setPlayerMessage(`Fehler beim Laden des Matches: ${matchRes.error.message}`);
      setLoadingMatch(false);
      return;
    }

    if (!matchRes.data || matchRes.data.length === 0) {
      setMatch(null);
      setPlayerMessage("Kein aktives oder geplantes Match auf diesem Court gefunden.");
      setLoadingMatch(false);
      return;
    }

    setMatch(matchRes.data[0]);
    setLoadingMatch(false);
  }

  async function updateMatch(payload) {
    if (!match) return;

    setSavingScore(true);
    setPlayerMessage("");

    const { error } = await supabase
      .from("matches")
      .update(payload)
      .eq("id", match.id);

    setSavingScore(false);

    if (error) {
      setPlayerMessage(`Fehler beim Speichern: ${error.message}`);
      return;
    }

    await loadPlayerPageData();
  }

  function plus(field) {
    if (!match) return;

    const stateBefore = getMatchScoreState(match);

    if (stateBefore.matchFinished || match.status === "finished") {
      setPlayerMessage("Das Match ist bereits abgeschlossen.");
      return;
    }

    let s1a = Number(match.set1_a || 0);
    let s1b = Number(match.set1_b || 0);
    let s2a = Number(match.set2_a || 0);
    let s2b = Number(match.set2_b || 0);
    let s3a = Number(match.set3_a || 0);
    let s3b = Number(match.set3_b || 0);

    if (!stateBefore.set1Finished) {
      if (field !== "set1_a" && field !== "set1_b") {
        setPlayerMessage("Bitte zuerst Satz 1 abschließen.");
        return;
      }

      if (field === "set1_a") s1a += 1;
      if (field === "set1_b") s1b += 1;

      return updateMatch({
        set1_a: s1a,
        set1_b: s1b,
        status: "live",
      });
    }

    if (!stateBefore.set2Finished) {
      if (field !== "set2_a" && field !== "set2_b") {
        setPlayerMessage("Bitte zuerst Satz 2 abschließen.");
        return;
      }

      if (field === "set2_a") s2a += 1;
      if (field === "set2_b") s2b += 1;

      const tempMatch = {
        ...match,
        set2_a: s2a,
        set2_b: s2b,
      };

      const stateAfter = getMatchScoreState(tempMatch);

      return updateMatch({
        set2_a: s2a,
        set2_b: s2b,
        status: stateAfter.matchWonAfterTwoSets ? "finished" : "live",
      });
    }

    const stateAfterTwoSets = getMatchScoreState({
      ...match,
      set1_a: s1a,
      set1_b: s1b,
      set2_a: s2a,
      set2_b: s2b,
    });

    if (!stateAfterTwoSets.needsMatchTiebreak) {
      return updateMatch({
        status: "finished",
      });
    }

    if (field !== "set3_a" && field !== "set3_b") {
      setPlayerMessage("Jetzt ist der Match-Tiebreak dran.");
      return;
    }

    if (field === "set3_a") s3a += 1;
    if (field === "set3_b") s3b += 1;

    const mtbFinished = isMatchTiebreakFinished(s3a, s3b);

    return updateMatch({
      set3_a: s3a,
      set3_b: s3b,
      status: mtbFinished ? "finished" : "live",
    });
  }

  function minus(field) {
    if (!match) return;

    if (match.status === "finished") {
      setPlayerMessage("Das Match ist abgeschlossen. Rückgängig ist gesperrt.");
      return;
    }

    const state = getMatchScoreState(match);

    if ((field === "set1_a" || field === "set1_b") && state.set1Finished) {
      setPlayerMessage("Satz 1 ist abgeschlossen.");
      return;
    }

    if ((field === "set2_a" || field === "set2_b") && state.set2Finished) {
      setPlayerMessage("Satz 2 ist abgeschlossen.");
      return;
    }

    if ((field === "set3_a" || field === "set3_b") && state.matchTiebreakFinished) {
      setPlayerMessage("Der Match-Tiebreak ist abgeschlossen.");
      return;
    }

    updateMatch({
      [field]: Math.max(0, Number(match[field] || 0) - 1),
    });
  }

  function setStatus(status) {
    updateMatch({ status });
  }

  function getActiveHint() {
    if (!match) return "";

    const state = getMatchScoreState(match);

    if (match.status === "finished" || state.matchFinished) {
      return "Match abgeschlossen.";
    }

    if (!state.set1Finished) {
      return "Aktuell: Satz 1";
    }

    if (!state.set2Finished) {
      return "Aktuell: Satz 2";
    }

    if (state.needsMatchTiebreak) {
      return "Aktuell: Match-Tiebreak bis 10 mit 2 Punkten Vorsprung";
    }

    return "Match abgeschlossen.";
  }

  function isScoreCardLocked(setNumber) {
    if (!match) return true;

    const state = getMatchScoreState(match);

    if (match.status === "finished" || state.matchFinished) return true;

    if (setNumber === 1) return state.set1Finished;
    if (setNumber === 2) return !state.set1Finished || state.set2Finished;
    if (setNumber === 3) return !state.set1Finished || !state.set2Finished || !state.needsMatchTiebreak;

    return true;
  }

  return (
    <div style={styles.pageCentered}>
      <div style={styles.authCardWide}>
        <h1 style={styles.authTitle}>🎾 Spieler Eingabe</h1>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 22, fontWeight: 900 }}>
            {eventName || "Event wird geladen..."}
          </div>

          <div style={{ ...styles.muted, marginTop: 6, fontSize: 18 }}>
            {courtName || "Court wird geladen..."}
          </div>
        </div>

        {playerMessage && <InfoBox>{playerMessage}</InfoBox>}

        {loadingMatch ? (
          <p style={styles.muted}>Match wird geladen...</p>
        ) : !match ? (
          <>
            <p>Kein Match gefunden.</p>
            <button
              type="button"
              onClick={loadPlayerPageData}
              style={styles.primaryButtonFull}
            >
              Neu laden
            </button>
          </>
        ) : (
          <>
            <div style={styles.playerMatchBox}>
              <div style={styles.playerMatchTitle}>
                {match.player_a || "Spieler A"} gegen {match.player_b || "Spieler B"}
              </div>

              <div style={styles.muted}>Modus: {match.mode || "-"}</div>
              <div style={styles.muted}>
                Status: <strong>{match.status || "-"}</strong>
              </div>

              <div style={{ marginTop: 12, fontWeight: 900, color: "#6be7ff" }}>
                {getActiveHint()}
              </div>
            </div>

            <div style={styles.statusButtonRow}>
              <button
                type="button"
                onClick={() => setStatus("planned")}
                style={smallButton(match.status === "planned")}
              >
                Planned
              </button>

              <button
                type="button"
                onClick={() => setStatus("live")}
                style={smallButton(match.status === "live")}
              >
                Live
              </button>

              <button
                type="button"
                onClick={() => setStatus("finished")}
                style={smallButton(match.status === "finished")}
              >
                Finished
              </button>
            </div>

            <div style={styles.scoreGridPlayer}>
              <div style={{ opacity: isScoreCardLocked(1) ? 0.45 : 1 }}>
                <ScoreCard
                  title="Satz 1"
                  leftLabel={match.player_a || "A"}
                  rightLabel={match.player_b || "B"}
                  leftValue={match.set1_a || 0}
                  rightValue={match.set1_b || 0}
                  onLeftPlus={() => plus("set1_a")}
                  onLeftMinus={() => minus("set1_a")}
                  onRightPlus={() => plus("set1_b")}
                  onRightMinus={() => minus("set1_b")}
                />
              </div>

              <div style={{ opacity: isScoreCardLocked(2) ? 0.45 : 1 }}>
                <ScoreCard
                  title="Satz 2"
                  leftLabel={match.player_a || "A"}
                  rightLabel={match.player_b || "B"}
                  leftValue={match.set2_a || 0}
                  rightValue={match.set2_b || 0}
                  onLeftPlus={() => plus("set2_a")}
                  onLeftMinus={() => minus("set2_a")}
                  onRightPlus={() => plus("set2_b")}
                  onRightMinus={() => minus("set2_b")}
                />
              </div>

              <div style={{ opacity: isScoreCardLocked(3) ? 0.45 : 1 }}>
                <ScoreCard
                  title="Match-Tiebreak"
                  leftLabel={match.player_a || "A"}
                  rightLabel={match.player_b || "B"}
                  leftValue={match.set3_a || 0}
                  rightValue={match.set3_b || 0}
                  onLeftPlus={() => plus("set3_a")}
                  onLeftMinus={() => minus("set3_a")}
                  onRightPlus={() => plus("set3_b")}
                  onRightMinus={() => minus("set3_b")}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={loadPlayerPageData}
              style={styles.primaryButtonFull}
              disabled={savingScore}
            >
              {savingScore ? "Speichern..." : "Aktualisieren"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
function QRPrintPanel({ eventId, eventTitle, courts }) {
  const baseUrl = window.location.origin;

  const buildUrl = (courtId) => {
    return `${baseUrl}/player?event=${eventId}&court=${courtId}`;
  };

  if (!eventId) {
    return (
      <section style={styles.panel}>
        <h2 style={styles.panelCardTitle}>QR-Codes</h2>
        <p style={styles.muted}>Bitte zuerst ein Event auswählen.</p>
      </section>
    );
  }

  return (
    <>
      <style>
        {`
          @media print {
            body {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            body * {
              visibility: hidden !important;
            }

            .qr-print-area,
            .qr-print-area * {
              visibility: visible !important;
            }

            .qr-print-area {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: white !important;
              color: black !important;
              padding: 0 !important;
              margin: 0 !important;
            }

            .qr-print-header {
              display: none !important;
            }

            .qr-print-grid {
              display: block !important;
            }

            .qr-print-card {
              width: 100% !important;
              height: 277mm !important;
              min-height: 277mm !important;
              page-break-after: always !important;
              break-after: page !important;
              page-break-inside: avoid !important;
              break-inside: avoid !important;

              display: flex !important;
              flex-direction: column !important;
              justify-content: center !important;
              align-items: center !important;

              border: none !important;
              border-radius: 0 !important;
              background: white !important;
              color: black !important;
              box-shadow: none !important;
              padding: 18mm !important;
              box-sizing: border-box !important;
              text-align: center !important;
            }

            .qr-print-card:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }

            .qr-print-event {
              display: block !important;
              font-size: 22pt !important;
              font-weight: 700 !important;
              margin-bottom: 12mm !important;
              color: black !important;
            }

            .qr-print-card h3 {
              font-size: 42pt !important;
              font-weight: 900 !important;
              margin: 0 0 18mm 0 !important;
              color: black !important;
            }

            .qr-print-card svg {
              width: 95mm !important;
              height: 95mm !important;
            }

            .qr-print-text {
              font-size: 24pt !important;
              font-weight: 900 !important;
              margin-top: 18mm !important;
              color: black !important;
            }

            .qr-print-hint {
              display: block !important;
              font-size: 13pt !important;
              margin-top: 8mm !important;
              color: #333 !important;
            }

            @page {
              size: A4 portrait;
              margin: 10mm;
            }
          }
        `}
      </style>

      <section className="qr-print-area" style={styles.qrPanel}>
        <div className="qr-print-header" style={styles.qrHeader}>
          <div>
            <h2 style={styles.panelCardTitle}>QR-Codes</h2>
            <div style={styles.panelCardSub}>{eventTitle}</div>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            style={styles.primaryButton}
          >
            QR-Codes drucken
          </button>
        </div>

        <div className="qr-print-grid" style={styles.qrGrid}>
          {courts.map((court) => (
            <div key={court.id} className="qr-print-card" style={styles.qrCard}>
              <div className="qr-print-event" style={{ display: "none" }}>
                {eventTitle}
              </div>

              <h3 style={styles.qrCourtName}>{court.name}</h3>

              <QRCodeSVG
                value={buildUrl(court.id)}
                size={230}
                level="H"
                includeMargin
              />

              <div className="qr-print-text" style={styles.qrText}>
                Spieler-Login
              </div>

              <div className="qr-print-hint" style={{ display: "none" }}>
                QR-Code scannen und Spielstand für diesen Platz eintragen
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
function PageShell({ children }) {
  return <div style={styles.pageCentered}>{children}</div>;
}

function LoginCard({ title }) {
  return (
    <div style={{ ...styles.authCard, maxWidth: 420 }}>
      <h1 style={styles.authTitle}>{title}</h1>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <section style={styles.panel}>
      <h2 style={styles.panelCardTitle}>{title}</h2>
      {subtitle ? <div style={styles.panelCardSub}>{subtitle}</div> : null}
      <div style={styles.panelContent}>{children}</div>
    </section>
  );
}

function FormLabel({ children }) {
  return <label style={styles.label}>{children}</label>;
}

function EventSelect({ events, selectedEvent, setSelectedEvent, setEditorDirty, eventName }) {
  return (
    <select
      value={String(selectedEvent || "")}
      onChange={(e) => {
        setEditorDirty(false);
        setSelectedEvent(String(e.target.value));
      }}
      style={styles.input}
    >
      <option value="">Event wählen</option>
      {events.map((e) => (
        <option key={e.id} value={String(e.id)}>{eventName(e)}</option>
      ))}
    </select>
  );
}

function CourtSelect({ courts, selectedCourt, setSelectedCourt, courtName }) {
  return (
    <select value={String(selectedCourt || "")} onChange={(e) => setSelectedCourt(String(e.target.value))} style={styles.input}>
      <option value="">Court wählen</option>
      {courts.map((c) => (
        <option key={c.id} value={String(c.id)}>{courtName(c)}</option>
      ))}
    </select>
  );
}

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <div style={styles.colorLabel}>{label}</div>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={styles.colorInput} />
    </div>
  );
}

function StatusPill({ children, color }) {
  return (
    <div style={{ ...styles.statusPill, color, borderColor: hexToRgba(color, 0.45), background: hexToRgba(color, 0.08) }}>
      {children}
    </div>
  );
}

function InfoBox({ children }) {
  return <div style={styles.infoBox}>{children}</div>;
}

function ScoreCard({ title, leftLabel, rightLabel, leftValue, rightValue, onLeftPlus, onLeftMinus, onRightPlus, onRightMinus }) {
  return (
    <div style={styles.scoreCard}>
      <div style={styles.scoreCardTitle}>{title}</div>
      <PlayerRow label={leftLabel} value={leftValue} onPlus={onLeftPlus} onMinus={onLeftMinus} />
      <PlayerRow label={rightLabel} value={rightValue} onPlus={onRightPlus} onMinus={onRightMinus} />
    </div>
  );
}

function PlayerRow({ label, value, onPlus, onMinus }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ marginBottom: 8, fontWeight: "bold" }}>{label}</div>
      <div style={styles.playerRowControls}>
        <button type="button" onClick={onMinus} style={scoreButtonStyle()}>−</button>
        <div style={styles.scoreNumber}>{value}</div>
        <button type="button" onClick={onPlus} style={scoreButtonStyle()}>+</button>
      </div>
    </div>
  );
}

function scoreButtonStyle() {
  return {
    width: 48,
    height: 48,
    borderRadius: 12,
    border: "1px solid rgba(107,231,255,0.35)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontSize: 26,
    fontWeight: "bold",
    cursor: "pointer",
  };
}

function smallButton(active) {
  return {
    padding: "10px 14px",
    borderRadius: 12,
    border: active ? "2px solid #6be7ff" : "1px solid rgba(255,255,255,0.16)",
    background: active ? "rgba(107,231,255,0.18)" : "rgba(255,255,255,0.06)",
    color: "white",
    cursor: "pointer",
    fontWeight: "bold",
  };
}

function hexToRgba(hex, alpha = 1) {
  if (!hex) return `rgba(255,255,255,${alpha})`;
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) clean = clean.split("").map((char) => char + char).join("");
  if (clean.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #06152f 0%, #0b1f45 55%, #07142f 100%)",
    color: "#ffffff",
    fontFamily: "Arial, sans-serif",
    padding: 10,
    boxSizing: "border-box",
  },
  pageCentered: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #06152f 0%, #0b1f45 55%, #07142f 100%)",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "Arial, sans-serif",
    padding: 20,
    boxSizing: "border-box",
  },
  hero: {
    minHeight: 118,
    padding: "18px 22px",
    borderRadius: 22,
    background: "linear-gradient(135deg, rgba(4,12,31,0.96), rgba(7,20,48,0.96))",
    border: "1px solid rgba(107,231,255,0.16)",
    boxShadow: "0 18px 60px rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 24,
  },
  heroLeft: { display: "flex", alignItems: "center", gap: 18 },
  logo: {
    width: 86,
    height: 86,
    borderRadius: 18,
    objectFit: "contain",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    padding: 6,
  },
  logoFallback: {
    width: 86,
    height: 86,
    borderRadius: 18,
    background: "rgba(107,231,255,0.12)",
    border: "1px solid rgba(107,231,255,0.28)",
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 24,
  },
  kicker: { color: "#00ff9d", fontSize: 12, letterSpacing: 3, fontWeight: 900, marginBottom: 6 },
  heroTitle: { margin: 0, fontSize: 32, lineHeight: 1, fontWeight: 900, letterSpacing: 0.5 },
  heroSub: { marginTop: 8, fontSize: 14, color: "#b9c8e6" },
  heroRight: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
  statusPill: { padding: "9px 13px", borderRadius: 999, border: "1px solid", fontWeight: 800, fontSize: 13 },
  tabs: { marginTop: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  tab: {
    padding: "11px 15px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.04)",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
  },
  tabActive: {
    padding: "11px 15px",
    borderRadius: 12,
    border: "1px solid rgba(107,231,255,0.65)",
    background: "rgba(44,122,217,0.62)",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 0 18px rgba(107,231,255,0.20)",
  },
  quickBar: {
    marginTop: 14,
    display: "grid",
    gridTemplateColumns: "1.4fr 0.5fr 0.5fr auto",
    gap: 12,
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    background: "rgba(6,15,38,0.72)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  quickLabel: { color: "#9fb4d9", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, fontWeight: 900 },
  quickValue: { marginTop: 4, color: "#ffffff", fontSize: 20, fontWeight: 900 },
  monitorButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(107,231,255,0.55)",
    background: "rgba(107,231,255,0.10)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 900,
  },
  adminGrid: { marginTop: 14, display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, alignItems: "start" },
  leftColumn: { display: "grid", gap: 16 },
  rightColumn: { display: "grid", gap: 16 },
  panel: {
    borderRadius: 20,
    background: "rgba(6,15,38,0.82)",
    border: "1px solid rgba(255,255,255,0.11)",
    padding: 18,
    boxShadow: "0 14px 45px rgba(0,0,0,0.22)",
  },
  panelCardTitle: { margin: 0, color: "#ffffff", fontSize: 26, lineHeight: 1, fontWeight: 900 },
  panelCardSub: { marginTop: 8, color: "#b9c8e6", fontSize: 13 },
  panelContent: { marginTop: 14 },
  label: { display: "block", marginTop: 12, marginBottom: 7, color: "#dce8ff", fontWeight: 800, fontSize: 14 },
  input: {
    width: "100%",
    minHeight: 44,
    padding: "11px 13px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.13)",
    background: "rgba(255,255,255,0.96)",
    color: "#020e2c",
    boxSizing: "border-box",
    fontWeight: 700,
  },
  inputMuted: {
    width: "100%",
    minHeight: 44,
    padding: "11px 13px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.13)",
    background: "rgba(255,255,255,0.08)",
    color: "#b9c8e6",
    boxSizing: "border-box",
    fontWeight: 700,
  },
  fileInput: {
    width: "100%",
    padding: "11px 13px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.13)",
    background: "rgba(255,255,255,0.06)",
    color: "#ffffff",
    boxSizing: "border-box",
  },
  fileNote: { marginTop: 10, color: "#b9c8e6", fontSize: 13 },
  twoCols: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  editorGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 },
  colorGrid: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10, marginTop: 12 },
  colorLabel: { color: "#b9c8e6", fontSize: 12, fontWeight: 900, marginBottom: 6 },
  colorInput: { width: "100%", height: 46, border: "none", background: "transparent", cursor: "pointer" },
  primaryButtonFull: {
    marginTop: 15,
    padding: "12px 16px",
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(107,231,255,0.55)",
    background: "rgba(107,231,255,0.12)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 900,
  },
  primaryButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(107,231,255,0.55)",
    background: "rgba(107,231,255,0.12)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 900,
  },
  ghostButton: {
    padding: "12px 16px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.05)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 900,
  },
  ghostButtonFull: {
    marginTop: 12,
    padding: "12px 16px",
    width: "100%",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.05)",
    color: "#ffffff",
    cursor: "pointer",
    fontWeight: 900,
  },
  previewRow: { marginTop: 16, display: "grid", gridTemplateColumns: "1fr auto", gap: 14, alignItems: "stretch" },
  previewBox: {
    padding: 18,
    borderRadius: 18,
    background: "linear-gradient(135deg, rgba(4,12,31,0.96), rgba(18,30,61,0.92))",
    border: "1px solid rgba(107,231,255,0.18)",
  },
  previewHeader: { display: "flex", alignItems: "center", gap: 16 },
  previewLogo: {
    width: 72,
    height: 72,
    borderRadius: 14,
    objectFit: "contain",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.16)",
    padding: 6,
  },
  previewLogoFallback: {
    width: 72,
    height: 72,
    borderRadius: 14,
    display: "grid",
    placeItems: "center",
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.16)",
    fontWeight: 900,
  },
  previewMiniNav: { display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" },
  previewPill: {
    display: "inline-block",
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid",
    fontWeight: 900,
    fontSize: 13,
  },
  previewKicker: { color: "#00ff9d", fontWeight: 900, letterSpacing: 2, fontSize: 12 },
  previewTitle: { marginTop: 8, fontSize: 28, fontWeight: 900 },
  previewSub: { marginTop: 6, color: "#b9c8e6" },
  logoPreviewBox: {
    minWidth: 160,
    padding: 14,
    borderRadius: 18,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.12)",
  },
  miniLabel: { color: "#b9c8e6", fontSize: 12, fontWeight: 900, marginBottom: 8 },
  logoPreview: { maxHeight: 82, maxWidth: 150, objectFit: "contain", borderRadius: 10 },
  actionRow: { marginTop: 16, display: "flex", gap: 10, flexWrap: "wrap" },
  bottomGrid: { display: "grid", gridTemplateColumns: "0.8fr 1.2fr", gap: 16 },
  selectionNote: { marginTop: 14, padding: 12, borderRadius: 14, background: "rgba(255,255,255,0.05)", color: "#b9c8e6", lineHeight: 1.6 },
  matchList: { display: "grid", gap: 10, maxHeight: 460, overflow: "auto", paddingRight: 4 },
  matchItem: { padding: 14, borderRadius: 14, background: "rgba(18,30,61,0.92)", border: "1px solid rgba(255,255,255,0.10)" },
  matchItemTop: { display: "flex", alignItems: "center", gap: 10, color: "#ffffff", fontSize: 16 },
  vs: { color: "#6f7f9f", fontWeight: 900 },
  matchMeta: { marginTop: 6, color: "#b9c8e6", fontSize: 13 },
  matchScore: { marginTop: 6, color: "#ffffff", fontSize: 13, fontWeight: 800 },
  emptyText: { color: "#b9c8e6", padding: 16, borderRadius: 14, background: "rgba(255,255,255,0.04)" },
  infoBox: {
    marginTop: 14,
    marginBottom: 14,
    padding: "13px 16px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.13)",
    color: "#ffffff",
    fontWeight: 800,
  },
  authCard: {
    padding: 30,
    borderRadius: 22,
    background: "rgba(6,15,38,0.86)",
    border: "1px solid rgba(255,255,255,0.12)",
    width: "100%",
    boxSizing: "border-box",
    textAlign: "center",
  },
  authCardWide: {
    padding: 30,
    borderRadius: 22,
    background: "rgba(6,15,38,0.86)",
    border: "1px solid rgba(255,255,255,0.12)",
    width: "100%",
    maxWidth: 1120,
    boxSizing: "border-box",
    textAlign: "center",
  },
  authKicker: { color: "#00ff9d", fontSize: 12, letterSpacing: 3, fontWeight: 900, marginBottom: 8 },
  authTitle: { margin: 0, marginBottom: 16, fontSize: 36, fontWeight: 900 },
  muted: { color: "#b9c8e6" },
  playerMatchBox: { padding: 20, borderRadius: 16, background: "rgba(255,255,255,0.06)", marginBottom: 24 },
  playerMatchTitle: { fontSize: 22, fontWeight: 900, marginBottom: 8 },
  statusButtonRow: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 24 },
  scoreGridPlayer: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 18, marginBottom: 24 },
  scoreCard: { padding: 18, borderRadius: 16, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" },
  scoreCardTitle: { fontSize: 22, fontWeight: 900, marginBottom: 18 },
  playerRowControls: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10 },
  scoreNumber: { minWidth: 70, padding: "12px 16px", borderRadius: 12, background: "rgba(0,0,0,0.22)", fontSize: 28, fontWeight: 900, color: "#6be7ff" },
  qrPanel: {
    marginTop: 14,
    borderRadius: 20,
    background: "rgba(6,15,38,0.82)",
    border: "1px solid rgba(255,255,255,0.11)",
    padding: 18,
  },
  qrHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    alignItems: "center",
    marginBottom: 18,
  },
  qrGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 18,
  },
  qrCard: {
    background: "#ffffff",
    color: "#061226",
    borderRadius: 18,
    padding: 22,
    textAlign: "center",
    border: "2px solid #061226",
    breakInside: "avoid",
    pageBreakInside: "avoid",
  },
  qrCourtName: {
    margin: "0 0 16px 0",
    fontSize: 22,
    fontWeight: 900,
  },
  qrText: {
    marginTop: 14,
    fontWeight: 800,
    fontSize: 14,
  },
  qrSmallUrl: {
    marginTop: 10,
    fontSize: 10,
    wordBreak: "break-all",
    opacity: 0.75,
  },
};