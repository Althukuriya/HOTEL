import { useState, useEffect, useCallback, useRef } from "react";
import {
  Wifi, Coffee, Sparkles, MessageSquare, UtensilsCrossed, Settings,
  Plus, Minus, Send, Lock, Trash2, Check, X, Clock, Phone, KeyRound,
  Star, ExternalLink, RefreshCw, Inbox, ArrowRight, ChevronLeft, Link2
} from "lucide-react";

const DEFAULT_CONFIG = {
  hotelName: "The Wayfarer Hotel",
  wifiName: "Wayfarer-Guest",
  wifiPassword: "wayfarer2026",
  breakfast: "Buffet breakfast is served 7:00–10:30 AM in the Garden Room, ground floor. Included with your stay — just show your room key.",
  whatsappNumbers: [{ id: "n1", label: "Front Desk", number: "919876543210", active: true }],
  adminPin: "1234",
  dinnerStart: 18,
  dinnerEnd: 22,
  googleReviewUrl: "",
  sheetUrl: "",
};

const DEFAULT_MENU = [
  { id: "m1", category: "Starters", name: "Tomato Basil Soup", price: 180, desc: "Slow-roasted tomato, fresh basil, cream" },
  { id: "m2", category: "Starters", name: "Chicken Satay", price: 260, desc: "Grilled skewers, peanut sauce" },
  { id: "m3", category: "Mains", name: "Butter Chicken & Naan", price: 420, desc: "Served with jeera rice" },
  { id: "m4", category: "Mains", name: "Grilled Salmon", price: 650, desc: "Lemon butter, seasonal vegetables" },
  { id: "m5", category: "Mains", name: "Paneer Tikka Masala", price: 340, desc: "With butter naan or rice" },
  { id: "m6", category: "Desserts", name: "Chocolate Lava Cake", price: 220, desc: "Vanilla bean ice cream" },
];

const DEFAULT_QUICK = [
  { id: "q1", label: "Clean my room now", message: "Please send housekeeping to clean my room now." },
  { id: "q2", label: "Extra towels", message: "Could I get extra towels, please?" },
  { id: "q3", label: "Do not disturb", message: "Please do not disturb — I'll flag when housekeeping can come in." },
  { id: "q4", label: "Extra pillows & blankets", message: "Could I get an extra pillow and blanket, please?" },
];

function useShared(key, fallback) {
  const [value, setValue] = useState(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await window.storage.get(key, true);
        if (!cancelled && res) setValue({ ...fallback, ...JSON.parse(res.value) });
      } catch (e) {
        try { await window.storage.set(key, JSON.stringify(fallback), true); } catch (e2) {}
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line
  }, [key]);

  const save = useCallback(async (next) => {
    setValue(next);
    try { await window.storage.set(key, JSON.stringify(next), true); } catch (e) { console.error(e); }
  }, [key]);

  return [value, save, loaded];
}

function waLink(number, text) {
  const clean = (number || "").replace(/[^\d]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
}

function logToSheet(sheetUrl, payload) {
  if (!sheetUrl) return;
  fetch(sheetUrl, { method: "POST", body: JSON.stringify(payload) }).catch(() => {});
}

function Card({ children, className = "" }) {
  return <div className={`rounded-2xl bg-white border border-stone-200/80 shadow-[0_2px_12px_rgba(28,25,20,0.04)] ${className}`}>{children}</div>;
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-toast-in">
      <div className="bg-stone-900 text-white text-sm px-4 py-2.5 rounded-full shadow-xl flex items-center gap-2 whitespace-nowrap">
        <Check size={14} className="text-amber-400" /> {message}
      </div>
    </div>
  );
}

const GlobalStyle = () => (
  <style>{`
    .font-serif { font-family: 'Iowan Old Style', Georgia, 'Times New Roman', serif; }
    .font-sans { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes toastIn { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
    @keyframes popIn { 0% { transform: scale(0.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
    .animate-fade-up { animation: fadeUp 0.45s cubic-bezier(.22,1,.36,1) both; }
    .animate-toast-in { animation: toastIn 0.3s cubic-bezier(.22,1,.36,1) both; }
    .animate-pop { animation: popIn 0.3s cubic-bezier(.34,1.56,.64,1) both; }
    .press-scale { transition: transform .12s ease, box-shadow .12s ease; }
    .press-scale:active { transform: scale(0.96); }
    .stagger > * { animation: fadeUp 0.4s cubic-bezier(.22,1,.36,1) both; }
    .stagger > *:nth-child(1){animation-delay:.03s} .stagger > *:nth-child(2){animation-delay:.07s}
    .stagger > *:nth-child(3){animation-delay:.11s} .stagger > *:nth-child(4){animation-delay:.15s}
    .stagger > *:nth-child(5){animation-delay:.19s} .stagger > *:nth-child(6){animation-delay:.23s}
    .stagger > *:nth-child(n+7){animation-delay:.26s}
  `}</style>
);

export default function RoomServiceApp() {
  const [config, saveConfig, configLoaded] = useShared("config", DEFAULT_CONFIG);
  const [menu, saveMenu, menuLoaded] = useShared("menu", DEFAULT_MENU);
  const [quick, saveQuick, quickLoaded] = useShared("quickOrders", DEFAULT_QUICK);

  const [mode, setMode] = useState("guest");
  const [room, setRoom] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  const showToast = useCallback((msg) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  }, []);

  const ready = configLoaded && menuLoaded && quickLoaded;
  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-950">
        <div className="text-amber-500/70 text-xs tracking-[0.3em] uppercase animate-pulse">Loading</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      <GlobalStyle />
      <Toast message={toast} />
      {mode === "guest" ? (
        !room ? (
          <WelcomeGate config={config} onEnter={setRoom} goAdmin={() => setMode("admin")} />
        ) : (
          <GuestView
            config={config} menu={menu} quick={quick}
            room={room} onChangeRoom={() => setRoom("")}
            showToast={showToast}
          />
        )
      ) : (
        <AdminView
          config={config} saveConfig={saveConfig}
          menu={menu} saveMenu={saveMenu}
          quick={quick} saveQuick={saveQuick}
          goGuest={() => setMode("guest")}
          showToast={showToast}
        />
      )}
      {mode === "guest" && room && (
        <button
          onClick={() => setMode("admin")}
          className="fixed bottom-3 right-3 opacity-20 hover:opacity-70 transition-opacity p-2"
          aria-label="Admin"
        >
          <Settings size={14} />
        </button>
      )}
    </div>
  );
}

/* ---------------- WELCOME / ROOM GATE ---------------- */

function WelcomeGate({ config, onEnter, goAdmin }) {
  const [val, setVal] = useState("");
  const submit = () => { if (val.trim()) onEnter(val.trim()); };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-6"
      style={{ background: "radial-gradient(circle at 50% 0%, #262019 0%, #171310 55%, #0d0b09 100%)" }}>
      <button onClick={goAdmin} className="absolute top-5 right-5 text-stone-600 hover:text-stone-300 transition-colors p-2" aria-label="Admin">
        <Settings size={16} />
      </button>
      <div className="w-full max-w-xs text-center animate-fade-up">
        <div className="mx-auto mb-6 w-14 h-14 rounded-full border border-amber-500/30 flex items-center justify-center animate-pop">
          <KeyRound size={22} className="text-amber-400" />
        </div>
        <div className="text-[11px] tracking-[0.35em] uppercase text-amber-500/70 mb-2">Welcome to</div>
        <h1 className="font-serif text-3xl text-stone-50 mb-8 leading-tight">{config.hotelName}</h1>

        <div className="text-left mb-3">
          <label className="text-[11px] tracking-widest uppercase text-stone-500 block mb-2">Your room number</label>
          <input
            autoFocus
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="e.g. 214"
            className="w-full bg-stone-900/60 border border-stone-700 focus:border-amber-500 rounded-xl px-4 py-3.5 text-stone-50 text-center text-lg tracking-wide outline-none transition-colors placeholder-stone-600"
          />
        </div>
        <button
          onClick={submit}
          disabled={!val.trim()}
          className="press-scale w-full mt-3 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-800 disabled:text-stone-600 text-stone-950 font-semibold rounded-xl py-3.5 flex items-center justify-center gap-2 transition-colors"
        >
          Continue <ArrowRight size={16} />
        </button>
        <div className="text-[11px] text-stone-600 mt-5">Enter your room number to unlock services, the dinner menu, and hotel info.</div>
      </div>
    </div>
  );
}

/* ---------------- GUEST VIEW ---------------- */

function GuestView({ config, menu, quick, room, onChangeRoom, showToast }) {
  const [tab, setTab] = useState("info");
  const [customMsg, setCustomMsg] = useState("");
  const [cart, setCart] = useState({});
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const hour = now.getHours();
  const dinnerOpen = hour >= config.dinnerStart && hour < config.dinnerEnd;
  const primaryNumber = config.whatsappNumbers?.find(n => n.active)?.number || config.whatsappNumbers?.[0]?.number;
  const roomTag = `Room ${room}`;

  const dispatch = (type, details, extra = {}) => {
    const text = `${roomTag}\n\n${details}${extra.amount ? `\n\nTotal: ₹${extra.amount}` : ""}`;
    window.open(waLink(primaryNumber, text), "_blank");
    logToSheet(config.sheetUrl, { type, room, details, ...extra });
  };

  const sendQuick = (item) => { dispatch("Request", item.message); showToast("Sent to front desk"); };
  const sendCustom = () => {
    if (!customMsg.trim()) return;
    dispatch("Request", customMsg.trim());
    setCustomMsg("");
    showToast("Message sent");
  };

  const cartItems = Object.entries(cart).filter(([, qty]) => qty > 0);
  const cartTotal = cartItems.reduce((sum, [id, qty]) => {
    const item = menu.find(m => m.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const sendOrder = () => {
    if (cartItems.length === 0) return;
    const lines = cartItems.map(([id, qty]) => {
      const item = menu.find(m => m.id === id);
      return `${qty} x ${item.name} — ₹${item.price * qty}`;
    }).join("\n");
    dispatch("Order", lines, { amount: cartTotal });
    setCart({});
    showToast("Order sent — bon appétit!");
  };

  const sendFeedback = (rating, comment) => {
    dispatch("Feedback", `${rating}★ — ${comment || "(no comment)"}`, { rating });
    showToast("Thank you for the feedback");
  };

  const categories = [...new Set(menu.map(m => m.category))];

  return (
    <div className="max-w-md mx-auto pb-24">
      <div className="px-6 pt-7 pb-5 rounded-b-[28px] relative text-stone-50"
        style={{ background: "linear-gradient(160deg, #201a13 0%, #0f0d0a 100%)" }}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] tracking-[0.3em] uppercase text-amber-500/70 mb-1">In-Room Services</div>
            <h1 className="font-serif text-2xl leading-tight">{config.hotelName}</h1>
          </div>
          <button onClick={onChangeRoom} className="flex items-center gap-1.5 bg-stone-800/70 border border-stone-700 rounded-full pl-2.5 pr-3 py-1.5 text-xs text-amber-300 press-scale">
            <KeyRound size={12} /> {room}
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 px-4 mt-4">
        {[
          { id: "info", label: "Info", icon: Wifi },
          { id: "services", label: "Services", icon: Sparkles },
          { id: "menu", label: "Menu", icon: UtensilsCrossed },
          { id: "feedback", label: "Feedback", icon: Star },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`press-scale flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-[11px] font-medium border transition-colors ${
              tab === t.id ? "bg-stone-900 text-amber-400 border-stone-900" : "bg-white text-stone-400 border-stone-200"
            }`}
          >
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      <div key={tab} className="px-4 mt-5 animate-fade-up">
        {tab === "info" && <InfoTab config={config} />}
        {tab === "services" && (
          <ServicesTab quick={quick} sendQuick={sendQuick} customMsg={customMsg} setCustomMsg={setCustomMsg} sendCustom={sendCustom} />
        )}
        {tab === "menu" && (
          <MenuTab menu={menu} categories={categories} cart={cart} setCart={setCart} dinnerOpen={dinnerOpen} config={config} now={now} />
        )}
        {tab === "feedback" && <FeedbackTab config={config} onSubmit={sendFeedback} />}
      </div>

      {tab === "menu" && cartItems.length > 0 && dinnerOpen && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto px-4 pb-4 animate-fade-up">
          <button onClick={sendOrder} className="press-scale w-full bg-amber-600 hover:bg-amber-500 text-stone-950 rounded-2xl py-4 flex items-center justify-center gap-2 shadow-xl font-semibold">
            <Send size={16} /> Send order via WhatsApp — ₹{cartTotal}
          </button>
        </div>
      )}
    </div>
  );
}

function InfoTab({ config }) {
  return (
    <div className="space-y-3 stagger">
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-700"><Wifi size={18} /></div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-stone-900">Wi-Fi</div>
            <div className="text-sm text-stone-600 mt-1">Network: <span className="font-medium text-stone-900">{config.wifiName}</span></div>
            <div className="text-sm text-stone-600">Password: <span className="font-medium text-stone-900">{config.wifiPassword}</span></div>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-700"><Coffee size={18} /></div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-stone-900">Breakfast</div>
            <div className="text-sm text-stone-600 mt-1 leading-relaxed">{config.breakfast}</div>
          </div>
        </div>
      </Card>
      {config.googleReviewUrl && (
        <a href={config.googleReviewUrl} target="_blank" rel="noopener noreferrer"
          className="press-scale block rounded-2xl p-4 text-white relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, #92400e, #b45309 60%, #d97706)" }}>
          <div className="flex items-center gap-3 relative z-10">
            <div className="p-2 rounded-lg bg-white/15"><Star size={18} className="fill-white" /></div>
            <div className="flex-1">
              <div className="text-sm font-semibold">Enjoying your stay?</div>
              <div className="text-xs text-amber-50/90 mt-0.5">Share a quick review on Google</div>
            </div>
            <ExternalLink size={15} className="text-amber-50/80" />
          </div>
        </a>
      )}
    </div>
  );
}

function ServicesTab({ quick, sendQuick, customMsg, setCustomMsg, sendCustom }) {
  return (
    <div className="space-y-4">
      <div>
        <div className="text-[11px] tracking-widest uppercase text-stone-400 font-semibold mb-2">Quick requests</div>
        <div className="grid grid-cols-2 gap-2 stagger">
          {quick.map(q => (
            <button key={q.id} onClick={() => sendQuick(q)}
              className="press-scale text-left p-3 rounded-xl bg-white border border-stone-200 hover:border-amber-500 text-sm text-stone-800 flex items-center justify-between gap-2">
              {q.label}
              <Send size={13} className="text-amber-700 shrink-0" />
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="text-[11px] tracking-widest uppercase text-stone-400 font-semibold mb-2">Write your own message</div>
        <Card className="p-3">
          <textarea value={customMsg} onChange={e => setCustomMsg(e.target.value)}
            placeholder="e.g. Could someone help carry our bags to Room 214?"
            rows={3} className="w-full text-sm outline-none resize-none placeholder-stone-400" />
          <button onClick={sendCustom} disabled={!customMsg.trim()}
            className="press-scale mt-2 w-full bg-stone-900 disabled:bg-stone-300 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2">
            <MessageSquare size={14} /> Send via WhatsApp
          </button>
        </Card>
      </div>
    </div>
  );
}

function MenuTab({ menu, categories, cart, setCart, dinnerOpen, config, now }) {
  const setQty = (id, qty) => setCart(prev => ({ ...prev, [id]: Math.max(0, qty) }));
  const fmtHour = (h) => { const p = h >= 12 ? "PM" : "AM"; const h12 = h % 12 === 0 ? 12 : h % 12; return `${h12}:00 ${p}`; };

  if (!dinnerOpen) {
    return (
      <Card className="p-6 text-center animate-pop">
        <Clock className="mx-auto text-amber-700 mb-2" size={24} />
        <div className="font-serif text-lg text-stone-900 mb-1">Dinner menu is closed</div>
        <div className="text-sm text-stone-500">
          Ordering opens daily from {fmtHour(config.dinnerStart)} to {fmtHour(config.dinnerEnd)}.
          <br />It's currently {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} on this device.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="text-xs bg-amber-50 text-amber-800 rounded-lg px-3 py-2 flex items-center gap-2">
        <Clock size={13} /> Dinner ordering open until {fmtHour(config.dinnerEnd)}
      </div>
      {categories.map(cat => (
        <div key={cat}>
          <div className="text-[11px] tracking-widest uppercase text-stone-400 font-semibold mb-2">{cat}</div>
          <div className="space-y-2 stagger">
            {menu.filter(m => m.category === cat).map(item => {
              const qty = cart[item.id] || 0;
              return (
                <Card key={item.id} className="p-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm font-medium text-stone-900">{item.name}</div>
                    <div className="text-xs text-stone-500 mt-0.5">{item.desc}</div>
                    <div className="text-sm text-amber-700 font-medium mt-1">₹{item.price}</div>
                  </div>
                  {qty === 0 ? (
                    <button onClick={() => setQty(item.id, 1)} className="press-scale p-2 rounded-full bg-amber-700 text-white">
                      <Plus size={14} />
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 bg-stone-100 rounded-full px-1 animate-pop">
                      <button onClick={() => setQty(item.id, qty - 1)} className="p-1.5 text-stone-700"><Minus size={12} /></button>
                      <span className="text-sm font-medium w-4 text-center">{qty}</span>
                      <button onClick={() => setQty(item.id, qty + 1)} className="p-1.5 text-stone-700"><Plus size={12} /></button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FeedbackTab({ config, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submit = () => {
    if (rating === 0) return;
    onSubmit(rating, comment.trim());
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="animate-pop">
        <Card className="p-6 text-center">
          <div className="w-12 h-12 mx-auto rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
            <Check size={20} />
          </div>
          <div className="font-serif text-lg text-stone-900 mb-1">Thank you</div>
          <div className="text-sm text-stone-500">Your feedback has been sent to the team.</div>
        </Card>

        {rating >= 4 && config.googleReviewUrl && (
          <a href={config.googleReviewUrl} target="_blank" rel="noopener noreferrer"
            className="press-scale block mt-3 rounded-2xl p-4 text-white text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #92400e, #b45309 60%, #d97706)" }}>
            <Star size={20} className="mx-auto fill-white mb-1" />
            <div className="text-sm font-semibold">We're thrilled you enjoyed it!</div>
            <div className="text-xs text-amber-50/90 mt-0.5 mb-2">Mind sharing that on Google? It takes 20 seconds.</div>
            <div className="inline-flex items-center gap-1 text-xs font-medium bg-white/15 rounded-full px-3 py-1.5">
              Leave a review <ExternalLink size={12} />
            </div>
          </a>
        )}
      </div>
    );
  }

  return (
    <Card className="p-5 animate-fade-up">
      <div className="text-sm font-semibold text-stone-900 mb-1">How's your stay so far?</div>
      <div className="text-xs text-stone-500 mb-4">Your feedback goes straight to the hotel team.</div>
      <div className="flex justify-center gap-2 mb-4">
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} onClick={() => setRating(n)}
            className="press-scale p-1">
            <Star size={30} className={(hover || rating) >= n ? "fill-amber-500 text-amber-500" : "text-stone-300"} />
          </button>
        ))}
      </div>
      <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
        placeholder="Tell us more (optional)"
        className="w-full text-sm border border-stone-200 rounded-xl p-3 outline-none resize-none placeholder-stone-400 focus:border-amber-500 transition-colors" />
      <button onClick={submit} disabled={rating === 0}
        className="press-scale mt-3 w-full bg-stone-900 disabled:bg-stone-300 text-white rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2">
        <Send size={14} /> Send feedback
      </button>
    </Card>
  );
}

/* ---------------- ADMIN ---------------- */

function AdminView({ config, saveConfig, menu, saveMenu, quick, saveQuick, goGuest, showToast }) {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("requests");

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6"
        style={{ background: "radial-gradient(circle at 50% 0%, #262019 0%, #171310 55%, #0d0b09 100%)" }}>
        <Card className="p-6 w-full max-w-xs text-center animate-pop">
          <Lock className="mx-auto text-amber-700 mb-2" size={22} />
          <div className="font-serif text-lg mb-3">Admin access</div>
          <input type="password" value={pin} onChange={e => { setPin(e.target.value); setErr(""); }}
            onKeyDown={e => e.key === "Enter" && (pin === config.adminPin ? setAuthed(true) : setErr("Incorrect PIN"))}
            placeholder="Enter PIN"
            className="w-full border border-stone-300 rounded-lg px-3 py-2 text-center outline-none focus:border-amber-600" />
          {err && <div className="text-xs text-red-600 mt-2">{err}</div>}
          <button onClick={() => pin === config.adminPin ? setAuthed(true) : setErr("Incorrect PIN")}
            className="press-scale mt-3 w-full bg-stone-900 text-white rounded-lg py-2 text-sm font-medium">Enter</button>
          <button onClick={goGuest} className="mt-3 text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1 justify-center w-full">
            <ChevronLeft size={12} /> Back to guest view
          </button>
        </Card>
      </div>
    );
  }

  const tabs = [
    { id: "requests", label: "Requests" },
    { id: "menu", label: "Menu & prices" },
    { id: "quick", label: "Quick requests" },
    { id: "info", label: "Hotel info" },
    { id: "whatsapp", label: "WhatsApp numbers" },
    { id: "connections", label: "Connections" },
    { id: "security", label: "PIN" },
  ];

  return (
    <div className="max-w-2xl mx-auto pb-16">
      <div className="text-stone-50 px-6 pt-8 pb-5 rounded-b-3xl flex items-center justify-between"
        style={{ background: "linear-gradient(160deg, #201a13 0%, #0f0d0a 100%)" }}>
        <div>
          <div className="text-[11px] tracking-[0.3em] uppercase text-amber-500/70 mb-1">Admin Panel</div>
          <h1 className="font-serif text-2xl">{config.hotelName}</h1>
        </div>
        <button onClick={goGuest} className="press-scale text-xs bg-stone-800 hover:bg-stone-700 rounded-lg px-3 py-2 border border-stone-700">Guest view →</button>
      </div>

      <div className="flex gap-2 px-4 mt-4 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`press-scale px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${tab === t.id ? "bg-amber-700 text-white border-amber-700" : "bg-white text-stone-500 border-stone-200"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div key={tab} className="px-4 mt-5 animate-fade-up">
        {tab === "requests" && <RequestsFeed config={config} />}
        {tab === "menu" && <MenuEditor menu={menu} saveMenu={saveMenu} />}
        {tab === "quick" && <QuickEditor quick={quick} saveQuick={saveQuick} />}
        {tab === "info" && <InfoEditor config={config} saveConfig={saveConfig} showToast={showToast} />}
        {tab === "whatsapp" && <NumbersEditor config={config} saveConfig={saveConfig} />}
        {tab === "connections" && <ConnectionsEditor config={config} saveConfig={saveConfig} showToast={showToast} />}
        {tab === "security" && <PinEditor config={config} saveConfig={saveConfig} showToast={showToast} />}
      </div>
    </div>
  );
}

function RequestsFeed({ config }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errored, setErrored] = useState(false);

  const load = useCallback(async () => {
    if (!config.sheetUrl) return;
    setLoading(true); setErrored(false);
    try {
      const res = await fetch(config.sheetUrl);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setErrored(true);
    } finally {
      setLoading(false);
    }
  }, [config.sheetUrl]);

  useEffect(() => { load(); }, [load]);

  if (!config.sheetUrl) {
    return (
      <Card className="p-6 text-center">
        <Inbox className="mx-auto text-stone-300 mb-2" size={26} />
        <div className="text-sm font-medium text-stone-700 mb-1">No Google Sheet connected yet</div>
        <div className="text-xs text-stone-500">Add your Apps Script Web App URL in the Connections tab to see live guest requests here.</div>
      </Card>
    );
  }

  const iconFor = (type) => {
    const t = (type || "").toLowerCase();
    if (t === "order") return <UtensilsCrossed size={14} />;
    if (t === "feedback") return <Star size={14} />;
    return <MessageSquare size={14} />;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-stone-500">{rows.length} logged</div>
        <button onClick={load} className="press-scale text-xs flex items-center gap-1.5 text-amber-700 font-medium">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> Refresh
        </button>
      </div>
      {errored && <div className="text-xs text-red-600 mb-3">Couldn't reach the sheet. Check the URL in Connections.</div>}
      <div className="space-y-2 stagger">
        {rows.map((r, i) => (
          <Card key={i} className="p-3 flex items-start gap-3">
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700 shrink-0">{iconFor(r.type)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-stone-400">
                <span className="font-medium text-stone-700">{r.type}</span>
                <span>·</span>
                <span>Room {r.room}</span>
                <span>·</span>
                <span>{r.timestamp ? new Date(r.timestamp).toLocaleString() : ""}</span>
              </div>
              <div className="text-sm text-stone-800 mt-1 whitespace-pre-line break-words">{r.details}</div>
              {r.amount ? <div className="text-xs text-amber-700 font-medium mt-1">₹{r.amount}</div> : null}
            </div>
          </Card>
        ))}
        {rows.length === 0 && !loading && <div className="text-sm text-stone-400 text-center py-8">No requests yet.</div>}
      </div>
    </div>
  );
}

function MenuEditor({ menu, saveMenu }) {
  const [draft, setDraft] = useState({ category: "", name: "", price: "", desc: "" });
  const update = (id, field, value) => saveMenu(menu.map(m => m.id === id ? { ...m, [field]: field === "price" ? Number(value) : value } : m));
  const remove = (id) => saveMenu(menu.filter(m => m.id !== id));
  const add = () => {
    if (!draft.name.trim() || !draft.category.trim()) return;
    saveMenu([...menu, { id: `m${Date.now()}`, category: draft.category, name: draft.name, price: Number(draft.price) || 0, desc: draft.desc }]);
    setDraft({ category: "", name: "", price: "", desc: "" });
  };
  return (
    <div className="space-y-3 stagger">
      {menu.map(item => (
        <Card key={item.id} className="p-3">
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input value={item.category} onChange={e => update(item.id, "category", e.target.value)} className="text-xs border border-stone-200 rounded px-2 py-1.5" placeholder="Category" />
            <input value={item.name} onChange={e => update(item.id, "name", e.target.value)} className="text-xs border border-stone-200 rounded px-2 py-1.5" placeholder="Item name" />
          </div>
          <div className="flex gap-2 items-center">
            <input type="number" value={item.price} onChange={e => update(item.id, "price", e.target.value)} className="text-xs border border-stone-200 rounded px-2 py-1.5 w-24" placeholder="Price" />
            <input value={item.desc} onChange={e => update(item.id, "desc", e.target.value)} className="text-xs border border-stone-200 rounded px-2 py-1.5 flex-1" placeholder="Description" />
            <button onClick={() => remove(item.id)} className="text-red-500 p-1.5"><Trash2 size={14} /></button>
          </div>
        </Card>
      ))}
      <Card className="p-3 border-dashed">
        <div className="text-xs font-semibold text-stone-500 mb-2">Add item</div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <input value={draft.category} onChange={e => setDraft({ ...draft, category: e.target.value })} className="text-xs border border-stone-200 rounded px-2 py-1.5" placeholder="Category" />
          <input value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="text-xs border border-stone-200 rounded px-2 py-1.5" placeholder="Item name" />
        </div>
        <div className="flex gap-2">
          <input type="number" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} className="text-xs border border-stone-200 rounded px-2 py-1.5 w-24" placeholder="Price" />
          <input value={draft.desc} onChange={e => setDraft({ ...draft, desc: e.target.value })} className="text-xs border border-stone-200 rounded px-2 py-1.5 flex-1" placeholder="Description" />
          <button onClick={add} className="press-scale bg-stone-900 text-white rounded px-3 text-xs flex items-center gap-1"><Plus size={12} />Add</button>
        </div>
      </Card>
    </div>
  );
}

function QuickEditor({ quick, saveQuick }) {
  const [draft, setDraft] = useState({ label: "", message: "" });
  const update = (id, field, value) => saveQuick(quick.map(q => q.id === id ? { ...q, [field]: value } : q));
  const remove = (id) => saveQuick(quick.filter(q => q.id !== id));
  const add = () => {
    if (!draft.label.trim() || !draft.message.trim()) return;
    saveQuick([...quick, { id: `q${Date.now()}`, ...draft }]);
    setDraft({ label: "", message: "" });
  };
  return (
    <div className="space-y-3 stagger">
      {quick.map(q => (
        <Card key={q.id} className="p-3 flex gap-2 items-center">
          <input value={q.label} onChange={e => update(q.id, "label", e.target.value)} className="text-xs border border-stone-200 rounded px-2 py-1.5 w-40" placeholder="Button label" />
          <input value={q.message} onChange={e => update(q.id, "message", e.target.value)} className="text-xs border border-stone-200 rounded px-2 py-1.5 flex-1" placeholder="WhatsApp message" />
          <button onClick={() => remove(q.id)} className="text-red-500 p-1.5"><Trash2 size={14} /></button>
        </Card>
      ))}
      <Card className="p-3 border-dashed">
        <div className="text-xs font-semibold text-stone-500 mb-2">Add quick request</div>
        <div className="flex gap-2">
          <input value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} className="text-xs border border-stone-200 rounded px-2 py-1.5 w-40" placeholder="Button label" />
          <input value={draft.message} onChange={e => setDraft({ ...draft, message: e.target.value })} className="text-xs border border-stone-200 rounded px-2 py-1.5 flex-1" placeholder="WhatsApp message" />
          <button onClick={add} className="press-scale bg-stone-900 text-white rounded px-3 text-xs flex items-center gap-1"><Plus size={12} />Add</button>
        </div>
      </Card>
    </div>
  );
}

function InfoEditor({ config, saveConfig, showToast }) {
  const [local, setLocal] = useState(config);
  useEffect(() => setLocal(config), [config]);

  const doSave = () => { saveConfig(local); showToast("Saved"); };

  return (
    <Card className="p-4 space-y-3">
      <div>
        <label className="text-xs font-semibold text-stone-500">Hotel name</label>
        <input value={local.hotelName} onChange={e => setLocal({ ...local, hotelName: e.target.value })} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-stone-500">Wi-Fi network name</label>
          <input value={local.wifiName} onChange={e => setLocal({ ...local, wifiName: e.target.value })} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-500">Wi-Fi password</label>
          <input value={local.wifiPassword} onChange={e => setLocal({ ...local, wifiPassword: e.target.value })} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1" />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-stone-500">Breakfast details</label>
        <textarea value={local.breakfast} onChange={e => setLocal({ ...local, breakfast: e.target.value })} rows={3} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1 resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-stone-500">Dinner ordering starts (24h)</label>
          <input type="number" min={0} max={23} value={local.dinnerStart} onChange={e => setLocal({ ...local, dinnerStart: Number(e.target.value) })} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs font-semibold text-stone-500">Dinner ordering ends (24h)</label>
          <input type="number" min={0} max={23} value={local.dinnerEnd} onChange={e => setLocal({ ...local, dinnerEnd: Number(e.target.value) })} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1" />
        </div>
      </div>
      <button onClick={doSave} className="press-scale bg-stone-900 text-white rounded-lg px-4 py-2 text-sm font-medium">Save changes</button>
    </Card>
  );
}

function NumbersEditor({ config, saveConfig }) {
  const [draft, setDraft] = useState({ label: "", number: "" });
  const numbers = config.whatsappNumbers || [];
  const update = (id, field, value) => saveConfig({ ...config, whatsappNumbers: numbers.map(n => n.id === id ? { ...n, [field]: value } : n) });
  const setActive = (id) => saveConfig({ ...config, whatsappNumbers: numbers.map(n => ({ ...n, active: n.id === id })) });
  const remove = (id) => saveConfig({ ...config, whatsappNumbers: numbers.filter(n => n.id !== id) });
  const add = () => {
    if (!draft.number.trim()) return;
    saveConfig({ ...config, whatsappNumbers: [...numbers, { id: `n${Date.now()}`, label: draft.label || "Untitled", number: draft.number, active: numbers.length === 0 }] });
    setDraft({ label: "", number: "" });
  };
  return (
    <div className="space-y-3 stagger">
      <div className="text-xs text-stone-500 bg-stone-100 rounded-lg px-3 py-2">
        Guest requests open WhatsApp addressed to the <b>active</b> number below. Add as many as you like and switch which one is active any time.
      </div>
      {numbers.map(n => (
        <Card key={n.id} className={`p-3 flex items-center gap-2 ${n.active ? "border-amber-500" : ""}`}>
          <Phone size={14} className="text-stone-400 shrink-0" />
          <input value={n.label} onChange={e => update(n.id, "label", e.target.value)} className="text-xs border border-stone-200 rounded px-2 py-1.5 w-32" placeholder="Label" />
          <input value={n.number} onChange={e => update(n.id, "number", e.target.value)} className="text-xs border border-stone-200 rounded px-2 py-1.5 flex-1" placeholder="Country code + number" />
          <button onClick={() => setActive(n.id)} className={`press-scale text-xs px-2.5 py-1.5 rounded-lg font-medium ${n.active ? "bg-amber-700 text-white" : "bg-stone-100 text-stone-600"}`}>
            {n.active ? "Active" : "Set active"}
          </button>
          <button onClick={() => remove(n.id)} className="text-red-500 p-1.5"><Trash2 size={14} /></button>
        </Card>
      ))}
      <Card className="p-3 border-dashed">
        <div className="text-xs font-semibold text-stone-500 mb-2">Add WhatsApp number</div>
        <div className="flex gap-2">
          <input value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} className="text-xs border border-stone-200 rounded px-2 py-1.5 w-32" placeholder="Label e.g. Kitchen" />
          <input value={draft.number} onChange={e => setDraft({ ...draft, number: e.target.value })} className="text-xs border border-stone-200 rounded px-2 py-1.5 flex-1" placeholder="919876543210" />
          <button onClick={add} className="press-scale bg-stone-900 text-white rounded px-3 text-xs flex items-center gap-1"><Plus size={12} />Add</button>
        </div>
      </Card>
    </div>
  );
}

function ConnectionsEditor({ config, saveConfig, showToast }) {
  const [local, setLocal] = useState(config);
  useEffect(() => setLocal(config), [config]);
  const doSave = () => { saveConfig(local); showToast("Saved"); };

  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Link2 size={14} className="text-amber-700" />
          <div className="text-sm font-semibold text-stone-900">Google Sheet backend</div>
        </div>
        <div className="text-xs text-stone-500 mb-3">Paste the Web App URL from your Google Apps Script deployment. Every request, order, and feedback will log there — and appear in the Requests tab here.</div>
        <input value={local.sheetUrl} onChange={e => setLocal({ ...local, sheetUrl: e.target.value })}
          placeholder="https://script.google.com/macros/s/.../exec"
          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Star size={14} className="text-amber-700" />
          <div className="text-sm font-semibold text-stone-900">Google review link</div>
        </div>
        <div className="text-xs text-stone-500 mb-3">Shown to guests on the Info tab, and prominently after a 4–5★ feedback rating.</div>
        <input value={local.googleReviewUrl} onChange={e => setLocal({ ...local, googleReviewUrl: e.target.value })}
          placeholder="https://g.page/r/your-hotel/review"
          className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm" />
      </Card>
      <button onClick={doSave} className="press-scale bg-stone-900 text-white rounded-lg px-4 py-2 text-sm font-medium">Save changes</button>
    </div>
  );
}

function PinEditor({ config, saveConfig, showToast }) {
  const [pin, setPin] = useState(config.adminPin);
  return (
    <Card className="p-4">
      <label className="text-xs font-semibold text-stone-500">Admin PIN</label>
      <input value={pin} onChange={e => setPin(e.target.value)} className="w-full border border-stone-200 rounded-lg px-3 py-2 text-sm mt-1" />
      <button onClick={() => { saveConfig({ ...config, adminPin: pin }); showToast("PIN updated"); }}
        className="press-scale mt-3 bg-stone-900 text-white rounded-lg px-4 py-2 text-sm font-medium">Save PIN</button>
    </Card>
  );
}
