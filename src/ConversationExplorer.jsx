import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as ReTooltip,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Search,
  PhoneOff,
  Cpu,
  Database,
  User,
  Bot,
  Info,
} from "lucide-react";
import saveAs from "file-saver";

// ------------------------------------------------------------
// SAMPLE DATA
// ------------------------------------------------------------
const SAMPLE_DATA = {
  conversations: [
    {
      conversation_id: "conv_001",
      duration_seconds: 45,
      turns: [
        {
          role: "caller",
          turn_id: 1,
          text: "I need to set a new address",
          timestamp: "2025-09-25T09:01:00Z",
          intent: "address_change",
          sentiment: "neutral",
          ended_call: false,
        },
        {
          role: "bot",
          turn_id: 2,
          timestamp: "2025-09-25T09:01:05Z",
          text: "Let me help with that. I have updated your address.",
          intent: "address_change",
          sentiment: "neutral",
          agentic_action: [
            {
              type: "tool_call",
              tool_name: "update_database",
              request: { field: "address", new_value: "TBD" },
            },
            {
              type: "tool_output",
              tool_name: "update_database",
              response: { status: "success", updated_field: "address" },
            },
          ],
        },
        {
          role: "caller",
          turn_id: 3,
          text: "",
          timestamp: "2025-09-25T09:01:25Z",
          intent: "None",
          sentiment: "neutral",
          ended_call: true,
        },
      ],
    },
    {
      conversation_id: "conv_002",
      duration_seconds: 70,
      turns: [
        {
          role: "caller",
          turn_id: 1,
          text: "Your service is terrible, I want to speak to a human!",
          timestamp: "2025-09-25T10:05:00Z",
          intent: "complaint",
          sentiment: "negative",
          ended_call: false,
        },
        {
          role: "bot",
          turn_id: 2,
          timestamp: "2025-09-25T10:05:10Z",
          text: "I am transferring you to an agent. Please hold on.",
          intent: "routing",
          sentiment: "neutral",
          agentic_action: [
            {
              type: "tool_call",
              tool_name: "forward_to_human",
              request: { routing_target: "customer_service_team" },
            },
            { type: "agent_invocation", description: "" },
          ],
        },
        {
          role: "caller",
          turn_id: 3,
          text: "",
          timestamp: "2025-09-25T10:05:20Z",
          intent: "None",
          sentiment: "neutral",
          ended_call: true,
        },
      ],
    },
    {
      conversation_id: "conv_003",
      duration_seconds: 65,
      turns: [
        {
          role: "caller",
          turn_id: 1,
          text: "What are your opening hours tomorrow?",
          timestamp: "2025-09-25T11:15:00Z",
          intent: "faq_query",
          sentiment: "neutral",
          ended_call: false,
        },
        {
          role: "bot",
          turn_id: 2,
          timestamp: "2025-09-25T11:15:05Z",
          text: "Let me check our knowledge base. We are open from 9 AM to 5 PM tomorrow.",
          intent: "faq_query",
          sentiment: "neutral",
          agentic_action: [
            {
              type: "tool_call",
              tool_name: "query_knowledgebase",
              request: { query: "opening hours tomorrow" },
            },
            {
              type: "tool_output",
              tool_name: "query_knowledgebase",
              response: { hours: "09:00-17:00" },
            },
          ],
        },
        {
          role: "caller",
          turn_id: 3,
          text: "Perfect, thank you!",
          timestamp: "2025-09-25T11:15:15Z",
          intent: "gratitude",
          sentiment: "positive",
          ended_call: true,
        },
      ],
    },
  ],
};

// ---------- Helpers & Styling Logic ----------

// Map sentiment name to pie colors
const PIE_COLORS = {
  positive: "#34d399", // green
  negative: "#f87171", // red
  neutral: "#94a3b8",  // light gray
};

// Format seconds → “Hh Mm Ss”, omit hours if zero
function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts = [];
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(" ");
}

// Determine left/right side by role
const roleSide = (role) => (role === "caller" ? "left" : "right");

// Color container box by sentiment
function containerColorClass(sentiment) {
  if (sentiment === "positive") return "bg-emerald-50 border-emerald-300";
  if (sentiment === "negative") return "bg-rose-50 border-rose-300";
  return "bg-white border-slate-200";
}

function downloadJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  try {
    if (typeof saveAs === "function") {
      saveAs(blob, filename);
      return;
    }
  } catch (_) {}
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}


// Aggregation helpers
function computeConversationSentimentRate(conv) {
  const counts = { positive: 0, neutral: 0, negative: 0 };
  conv.turns.forEach((t) => {
    const key = t.sentiment ?? "neutral";
    counts[key] = (counts[key] ?? 0) + 1;
  });
  const total = conv.turns.length || 1;
  return Object.entries(counts).map(([name, count]) => ({
    name,
    count,
    value: count,
    percent: total ? Math.round((count / total) * 100) : 0,
  }));
}
function computeGlobalSentiment(convs) {
  const counts = { positive: 0, neutral: 0, negative: 0 };
  let totalTurns = 0;
  convs.forEach((c) => {
    c.turns.forEach((t) => {
      const key = t.sentiment ?? "neutral";
      counts[key] = (counts[key] ?? 0) + 1;
      totalTurns += 1;
    });
  });
  return Object.entries(counts).map(([name, count]) => ({
    name,
    count,
    value: count,
    percent: totalTurns ? Math.round((count / totalTurns) * 100) : 0,
  }));
}

// UI primitives
const Btn = ({ children, onClick, variant = "default", size = "md", className = "", type = "button" }) => (
  <button
    type={type}
    onClick={onClick}
    className={`inline-flex items-center justify-center rounded-xl border ${
      variant === "outline"
        ? "bg-white hover:bg-slate-50 border-slate-200"
        : "bg-slate-900 text-white hover:bg-slate-800 border-slate-900"
    } ${size === "icon" ? "w-8 h-8 p-0" : "px-3 py-1.5 text-sm"} ${className}`}
  >
    {children}
  </button>
);
const Card = ({ children, className = "" }) => <div className={`border rounded-2xl bg-white ${className}`}>{children}</div>;
const CardHeader = ({ children, className = "" }) => <div className={`px-4 pt-3 ${className}`}>{children}</div>;
const CardContent = ({ children, className = "" }) => <div className={`px-4 pb-4 ${className}`}>{children}</div>;
const CardTitle = ({ children, className = "" }) => <h2 className={`font-semibold ${className}`}>{children}</h2>;
const TextInput = (props) => <input {...props} className={`w-full rounded-xl border px-3 py-2 text-sm ${props.className || ""}`} />;
const Label = ({ children, className = "" }) => <label className={`text-xs text-slate-600 ${className}`}>{children}</label>;
const Checkbox = ({ checked, onChange }) => <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />;
const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
    {options.map((o) => (
      <option key={o} value={o}>
        {o}
      </option>
    ))}
  </select>
);
const Badge = ({ children }) => (
  <span className="px-2 py-0.5 text-[10px] rounded-full border bg-slate-50 text-slate-700">{children}</span>
);
const ROLE_STYLES = {
  caller: "bg-amber-50 text-amber-700 border border-amber-200",
  bot: "bg-sky-50 text-sky-700 border border-sky-200",
};
const RoleBadge = ({ role }) => {
  const Icon = role === "caller" ? User : Bot;
  const classes = ROLE_STYLES[role] || "bg-slate-100 text-slate-700 border border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold uppercase ${classes}`}>
      <Icon className="w-3.5 h-3.5" />
      {role}
    </span>
  );
};

const InfoTooltip = ({ message }) => {
  const [visible, setVisible] = useState(false);
  const hide = () => setVisible(false);

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={hide}
      onFocus={() => setVisible(true)}
      onBlur={hide}
    >
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="inline-flex items-center justify-center rounded-full p-0.5 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-slate-300"
        aria-label="Regex search help"
      >
        <Info className="w-3.5 h-3.5 text-slate-400" />
      </button>
      {visible && (
        <span className="absolute left-1/2 top-full z-20 mt-1 -translate-x-1/2 whitespace-pre rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] leading-snug text-slate-700 shadow-lg">
          {message}
        </span>
      )}
    </span>
  );
};

const SentimentTooltip = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const entry = payload[0];
  const { name, payload: data } = entry;
  const percent = data?.percent ?? Math.round(entry.value ?? 0);
  const count = data?.count ?? entry.value ?? 0;
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg">
      <div className="font-semibold capitalize">{name}</div>
      <div>
        {percent}% [{count} {count === 1 ? "turn" : "turns"}]
      </div>
    </div>
  );
};

// Main component
export default function ConversationExplorer() {
  const [data, setData] = useState(SAMPLE_DATA);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Filter & state fields
  const [scope, setScope] = useState("Conversation");
  const [positionFilter, setPositionFilter] = useState("Anywhere");
  const [regexQuery, setRegexQuery] = useState("");
  const [sentiments, setSentiments] = useState({ positive: true, neutral: true, negative: true });
  const [intent, setIntent] = useState("any");
  const [tool, setTool] = useState("any");
  const [endedBy, setEndedBy] = useState("any");
  const [minTurns, setMinTurns] = useState(0);
  const [maxTurns, setMaxTurns] = useState(200);
  const [minSecs, setMinSecs] = useState(0);
  const [maxSecs, setMaxSecs] = useState(3600);

  const allConvs = data.conversations || [];

  const allIntents = useMemo(() => {
    const s = new Set();
    allConvs.forEach((c) => c.turns.forEach((t) => t.intent && s.add(t.intent)));
    return ["any", ...Array.from(s).sort()];
  }, [allConvs]);

  const allTools = useMemo(() => {
    const s = new Set();
    allConvs.forEach((c) =>
      c.turns.forEach((t) => (t.agentic_action || []).forEach((a) => a.tool_name && s.add(a.tool_name)))
    );
    return ["any", ...Array.from(s).sort()];
  }, [allConvs]);

  const regex = useMemo(() => {
    if (!regexQuery) return null;
    try {
      return new RegExp(regexQuery, "i");
    } catch {
      return null;
    }
  }, [regexQuery]);

  const filteredConversations = useMemo(() => {
    return allConvs.filter((conv) => {
      if (conv.turns.length < minTurns || conv.turns.length > maxTurns) return false;
      if (conv.duration_seconds < minSecs || conv.duration_seconds > maxSecs) return false;

      if (endedBy !== "any") {
        const last = conv.turns[conv.turns.length - 1];
        const endedRole = last?.ended_call
          ? last.role
          : last?.role === "bot" && last?.intent === "conversation_end"
          ? "bot"
          : undefined;
        if (!endedRole || endedRole !== endedBy) return false;
      }

      if (intent !== "any") {
        if (!conv.turns.some((t) => t.intent === intent)) return false;
      }

      const matchesScope = (role) => {
        if (scope === "Conversation") return true;
        if (scope === "Caller Message") return role === "caller";
        if (scope === "Bot Message") return role === "bot";
        return true;
      };

      const matchesPosition = (idx, length) => {
        if (positionFilter === "Anywhere") return true;
        if (positionFilter === "First Message") return idx === 0;
        if (positionFilter === "Last Message") return idx === length - 1;
        return true;
      };

      const sentimentOk = conv.turns.some((t, idx) => {
        const s = t.sentiment ?? "neutral";
        if (!sentiments[s]) return false;
        if (!matchesScope(t.role)) return false;
        if (!matchesPosition(idx, conv.turns.length)) return false;
        return true;
      });
      if (!sentimentOk) return false;

      if (regex) {
        const anyMatch = conv.turns.some((t, idx) => {
          if (!matchesScope(t.role)) return false;
          if (!matchesPosition(idx, conv.turns.length)) return false;
          const hay = t.text ?? "";
          return regex.test(hay);
        });
        if (!anyMatch) return false;
      }

      if (tool !== "any") {
        if (!conv.turns.some((t) => (t.agentic_action || []).some((a) => a.tool_name === tool))) return false;
      }

      return true;
    });
  }, [
    allConvs,
    minTurns,
    maxTurns,
    minSecs,
    maxSecs,
    endedBy,
    intent,
    sentiments,
    scope,
    positionFilter,
    regex,
    tool,
  ]);

  useEffect(() => {
    if (selectedIndex >= filteredConversations.length) setSelectedIndex(0);
  }, [filteredConversations.length, selectedIndex]);

  const selected = filteredConversations[selectedIndex];
  const globalPie = useMemo(() => computeGlobalSentiment(filteredConversations), [filteredConversations]);
  const localPie = useMemo(() => (selected ? computeConversationSentimentRate(selected) : []), [selected]);
  const totalDuration = useMemo(
    () => filteredConversations.reduce((acc, c) => acc + (c.duration_seconds || 0), 0),
    [filteredConversations]
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight") setSelectedIndex((i) => Math.min(i + 1, filteredConversations.length - 1));
      if (e.key === "ArrowLeft") setSelectedIndex((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filteredConversations.length]);

  const fileInputRef = useRef(null);
  const handleFile = async (file) => {
    const text = await file.text();
    try {
      const json = JSON.parse(text);
      if (json.conversations) setData(json);
    } catch {
      alert("Invalid JSON file");
    }
  };

  const convCounter = `${Math.min(selectedIndex + 1, filteredConversations.length)} / ${filteredConversations.length}`;
  const regexTooltipMessage = [
    "The search supports regular expressions:",
    "",
    "Examples:",
    "• hello – matches 'hello'",
    "• goodbye|stupid – matches goodbye or stupid",
    "• \\brefund(s)?\\b – matches refund or refunds as whole words",
    "• hello\\s+(there|team) – finds greetings like 'hello there' or 'hello team'",
    "• (?=.*address).*update – requires the text to mention address and update",
  ].join("\n");

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 border-b bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center gap-2">
          <h1 className="font-semibold text-lg">Conversation Explorer</h1>
          <div className="ml-auto flex items-center gap-2">
            <input
              type="file"
              accept="application/json"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              className="hidden"
            />
            <Btn variant="outline" onClick={() => fileInputRef.current?.click()}>
              Load Conversations
            </Btn>
            <Btn onClick={() => downloadJSON("filtered_conversations.json", { conversations: filteredConversations })}>
              <Download className="w-4 h-4 mr-2" /> Download Selection
            </Btn>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl grid grid-cols-12 gap-4 p-4">
        {/* Left Sidebar: Filters */}
        <aside className="col-span-12 lg:col-span-3 space-y-3">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Search & Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="flex items-center gap-2">
                  Search Message
                  <InfoTooltip message={regexTooltipMessage} />
                </Label>
                <div className="relative mt-1">
                  <Search className="w-4 h-4 absolute left-2 top-2.5 text-slate-400" />
                  <TextInput
                    value={regexQuery}
                    onChange={(e) => setRegexQuery(e.target.value)}
                    placeholder="e.g. goodbye|stupid"
                    className="pl-8"
                  />
                </div>
                {regexQuery && !regex && <p className="text-[11px] text-rose-600 mt-1">Invalid regex</p>}
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label>Scope</Label>
                  <div className="mt-2">
                    <Select
                      value={scope}
                      onChange={setScope}
                      options={["Conversation", "Caller Message", "Bot Message"]}
                    />
                  </div>
                </div>

                <div>
                  <Label>Position</Label>
                  <div className="mt-2">
                    <Select
                      value={positionFilter}
                      onChange={setPositionFilter}
                      options={["Anywhere", "First Message", "Last Message"]}
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label>Sentiment</Label>
                <div className="mt-2 grid grid-cols-3 gap-2 text-sm items-center">
                  {["positive", "neutral", "negative"].map((s) => (
                    <label key={s} className="flex items-center gap-2">
                      <Checkbox checked={sentiments[s]} onChange={(v) => setSentiments((old) => ({ ...old, [s]: v }))} />
                      {s}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Intent</Label>
                <Select value={intent} onChange={setIntent} options={allIntents} />
              </div>

              <div>
                <Label>Tool name</Label>
                <Select value={tool} onChange={setTool} options={allTools} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Min turns</Label>
                  <TextInput
                    type="number"
                    value={minTurns}
                    min={0}
                    onChange={(e) => setMinTurns(Number(e.target.value || 0))}
                  />
                </div>
                <div>
                  <Label>Max turns</Label>
                  <TextInput
                    type="number"
                    value={maxTurns}
                    min={0}
                    onChange={(e) => setMaxTurns(Number(e.target.value || 0))}
                  />
                </div>
                <div>
                  <Label>Min seconds</Label>
                  <TextInput
                    type="number"
                    value={minSecs}
                    min={0}
                    onChange={(e) => setMinSecs(Number(e.target.value || 0))}
                  />
                </div>
                <div>
                  <Label>Max seconds</Label>
                  <TextInput
                    type="number"
                    value={maxSecs}
                    min={0}
                    onChange={(e) => setMaxSecs(Number(e.target.value || 0))}
                  />
                </div>
              </div>

              <div>
                <Label>Who ended the call?</Label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {["any", "caller", "bot"].map((v) => (
                    <Btn key={v} variant={endedBy === v ? "default" : "outline"} onClick={() => setEndedBy(v)}>
                      {v}
                    </Btn>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        {/* Conversation display */}
        <section className="col-span-12 lg:col-span-6 flex flex-col gap-3">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Btn variant="outline" onClick={() => setSelectedIndex((i) => Math.max(i - 1, 0))}>
                    <ChevronLeft className="w-4 h-4" />
                  </Btn>
                  <Btn
                    variant="outline"
                    onClick={() => setSelectedIndex((i) => Math.min(i + 1, filteredConversations.length - 1))}  
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Btn>
                  <span className="text-sm text-slate-600 ml-2">{convCounter}</span>
                </div>
                <div className="text-sm text-slate-500">Filtered from {allConvs.length} total</div>
              </div>
            </CardHeader>
            <CardContent>
              {!selected ? (
                <div className="text-sm text-slate-500">No conversations match your filters.</div>
              ) : (
                <div className="space-y-3 max-h-[70vh] overflow-auto pr-2">
                  {selected.turns.map((t, idx) => (
                    <motion.div
                      key={t.turn_id ?? idx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${roleSide(t.role) === "left" ? "justify-start" : "justify-end"}`}
                    >
                      <div className={`max-w-[80%] rounded-2xl p-3 shadow-sm border ${containerColorClass(t.sentiment)}`}>
                        <div className="flex items-center gap-2 mb-1">
                          {/* role icon + role label */}
                          <RoleBadge role={t.role} />
                          <Badge>turn #{t.turn_id}</Badge>
                          {t.intent && <span className="px-2 py-0.5 text-[10px] rounded-full border">{t.intent}</span>}
                        </div>
                        <div className="font-medium leading-snug">
                          {t.text || <span className="italic text-slate-400">(no text)</span>}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-2">
                          <span>{new Date(t.timestamp || Date.now()).toLocaleString()}</span>
                          <span>• sentiment: {t.sentiment ?? "neutral"}</span>
                          {t.ended_call && (
                            <span className="inline-flex items-center gap-1">
                              <PhoneOff className="w-3 h-3" /> ended call
                            </span>
                          )}
                        </div>

                        {t.role === "bot" && Array.isArray(t.agentic_action) && t.agentic_action.length > 0 && (
                          <div className="mt-2 border-t pt-2 space-y-1">
                            {t.agentic_action.map((a, i) => (
                              <div key={i} className="text-[11px] text-slate-600 flex items-center gap-2">
                                {a.type === "tool_call" && <Cpu className="w-3 h-3" />}
                                {a.type === "tool_output" && <Database className="w-3 h-3" />}
                                {a.type === "persistent_storage" && <Database className="w-3 h-3" />}
                                {a.tool_name && <span className="px-2 py-0.5 text-[10px] rounded-full border">{a.tool_name}</span>}
                                <code className="bg-slate-100 rounded px-1 py-0.5 overflow-x-auto">
                                  {JSON.stringify(a.request || a.response || {}, null, 0)}
                                </code>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Metrics */}
        <aside className="col-span-12 lg:col-span-3 space-y-3">
          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Global Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-white rounded-xl border">
                  <div className="text-slate-500"># Conversations</div>
                  <div className="text-lg font-semibold">{filteredConversations.length}</div>
                </div>
                <div className="p-2 bg-white rounded-xl border">
                  <div className="text-slate-500">Total Duration</div>
                  <div className="text-lg font-semibold">{formatDuration(totalDuration)}</div>
                </div>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={globalPie} dataKey="value" nameKey="name" outerRadius={70}>
                      {globalPie.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name] || PIE_COLORS.neutral} />
                      ))}
                    </Pie>
                    <ReTooltip content={<SentimentTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Conversation Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="p-2 bg-white rounded-xl border">
                  <div className="text-slate-500"># Turns</div>
                  <div className="text-lg font-semibold">{selected?.turns.length ?? 0}</div>
                </div>
                <div className="p-2 bg-white rounded-xl border">
                  <div className="text-slate-500">Duration</div>
                  <div className="text-lg font-semibold">{formatDuration(selected?.duration_seconds ?? 0)}</div>
                </div>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={localPie} dataKey="value" nameKey="name" outerRadius={70}>
                      {localPie.map((entry, index) => (
                        <Cell key={`cell-local-${index}`} fill={PIE_COLORS[entry.name] || PIE_COLORS.neutral} />
                      ))}
                    </Pie>
                    <ReTooltip content={<SentimentTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
