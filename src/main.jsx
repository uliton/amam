import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Asterisk,
  BarChart3,
  Check,
  Clock3,
  Flower2,
  Heart,
  History,
  LogIn,
  LogOut,
  Milk,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  API_URL,
  CHILDREN,
  readStored,
  store,
  elapsed,
  dateKey,
  timeLabel,
  localInput,
  inputISO,
  demoFeedings,
  request,
} from "./data";
import "./styles.css";

const offsetLabel = (n) => `UTC${n >= 0 ? "+" : ""}${n}`;
const prettyDate = (key, options = { day: "numeric", month: "long" }) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("uk-UA", {
    ...options,
    timeZone: "UTC",
  });

function Dialog({ title, children, close, className = "" }) {
  const ref = useRef();
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={className}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="dialog-head">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="Закрити" onClick={close}>
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

function App() {
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(() =>
    readStored("amam.offset", -new Date().getTimezoneOffset() / 60),
  );
  const [page, setPage] = useState("home");
  const [mode, setMode] = useState(() =>
    readStored("amam.mode", API_URL ? "live" : "demo"),
  );
  const [key, setKey] = useState(() => readStored("amam.key", ""));
  const [records, setRecords] = useState([]);
  const [latest, setLatest] = useState([]);
  const [demo, setDemo] = useState(
    () => readStored("amam.demo", null) || demoFeedings(),
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");
  const [filter, setFilter] = useState("all");
  const [period, setPeriod] = useState(7);
  const loadId = useRef(0);
  const demoMode = mode === "demo";
  const connected = Boolean(key && API_URL);
  const today = dateKey(now, offset);
  const data = demoMode ? demo : records;
  const allLatest = demoMode
    ? CHILDREN.map(
        (c) =>
          data
            .filter((r) => r.childId === c.id)
            .sort((a, b) => +new Date(b.fedAt) - +new Date(a.fedAt))[0],
      ).filter(Boolean)
    : latest;
  async function load() {
    if (demoMode || !connected) return;
    const id = ++loadId.current;
    setLoading(true);
    try {
      const from = new Date(Date.now() - 32 * 86400000).toISOString();
      let items = [],
        cursor = "";
      do {
        const batch = await request(
          `/feedings?from=${encodeURIComponent(from)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
        );
        items.push(...batch.items);
        cursor = batch.nextCursor;
      } while (cursor);
      const last = await request("/feedings/latest");
      if (id === loadId.current) {
        setRecords(items);
        setLatest(last.items);
        setError("");
      }
    } catch (e) {
      if (id === loadId.current) setError(e.message);
    } finally {
      if (id === loadId.current) setLoading(false);
    }
  }
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(() => {
      if (!document.hidden) load();
    }, 30000);
    return () => {
      clearInterval(t);
      ++loadId.current;
    };
  }, [mode, key]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  function changeMode(value) {
    ++loadId.current;
    store("amam.mode", value);
    setMode(value);
    setRecords([]);
    setLatest([]);
    setError("");
    setModal(null);
  }
  function start(child, record = null) {
    setEditing({ child, record });
    setModal("feeding");
  }
  const todayRecords = data.filter((r) => dateKey(r.fedAt, offset) === today);
  const todayMl = todayRecords.reduce((s, r) => s + r.consumedMl, 0);
  const sorted = [...data].sort(
    (a, b) =>
      +new Date(b.fedAt) - +new Date(a.fedAt) || b._id.localeCompare(a._id),
  );
  const previousInterval = (record) => {
    const index = sorted.findIndex((r) => r._id === record._id);
    const previous = sorted
      .slice(index + 1)
      .find((r) => r.childId === record.childId);
    return previous
      ? +new Date(record.fedAt) - +new Date(previous.fedAt)
      : null;
  };
  const firstDay = dateKey(
    new Date(`${today}T12:00:00Z`).getTime() - (period - 1) * 86400000,
    0,
  );
  const filtered = sorted.filter(
    (r) =>
      dateKey(r.fedAt, offset) >= firstDay &&
      dateKey(r.fedAt, offset) <= today &&
      (filter === "all" || r.childId === filter),
  );
  const totalMl = filtered.reduce((s, r) => s + r.consumedMl, 0);
  const intervals = filtered.map(previousInterval).filter((x) => x !== null);
  const avgInterval = intervals.length
    ? elapsed(intervals.reduce((a, b) => a + b, 0) / intervals.length)
    : "—";
  const days = Array.from({ length: period }, (_, i) =>
    dateKey(
      new Date(`${today}T12:00:00Z`).getTime() - (period - 1 - i) * 86400000,
      0,
    ),
  );
  const maxDay = Math.max(
    1,
    ...days.map((day) =>
      filtered
        .filter((r) => dateKey(r.fedAt, offset) === day)
        .reduce((s, r) => s + r.consumedMl, 0),
    ),
  );

  function recordList(items, isStats = false) {
    if (!items.length)
      return (
        <div className="empty">
          <span>🍼</span>
          <h3>
            {loading
              ? "Завантажуємо годування…"
              : "Тут починається ваша історія"}
          </h3>
          <p>
            {loading
              ? "Ще мить — і все буде на місці."
              : "Додайте перше годування — ми запам’ятаємо час і кожну краплинку."}
          </p>
        </div>
      );
    return (
      <div className="records">
        {items.map((r) => {
          const child = CHILDREN.find((c) => c.id === r.childId);
          const interval = previousInterval(r);
          return (
            <div className="record" key={r._id}>
              <span className={`record-avatar ${child.color}`}>
                {child.emoji}
              </span>
              <div className="record-name">
                <strong>{child.name}</strong>
                <span>
                  {dateKey(r.fedAt, offset) === today
                    ? "Сьогодні"
                    : prettyDate(dateKey(r.fedAt, offset), {
                        day: "numeric",
                        month: "short",
                      })}{" "}
                  о {timeLabel(r.fedAt, offset)}
                </span>
              </div>
              <div className="record-ml">
                <strong>
                  {r.consumedMl} <small>мл</small>
                </strong>
                <span>із {r.offeredMl} мл</span>
              </div>
              {isStats && (
                <div className="record-interval">
                  <span>Інтервал</span>
                  <strong>{interval === null ? "—" : elapsed(interval)}</strong>
                </div>
              )}
              <span className={`spit-badge ${r.spitUp ? "yes" : ""}`}>
                {r.spitUp ? "💧 Було зригування" : "✨ Без зригування"}
              </span>
              <button
                className="icon-btn"
                aria-label={`Редагувати годування ${child.name}, ${timeLabel(r.fedAt, offset)}`}
                onClick={() => start(child, r)}
              >
                <Pencil size={16} />
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <>
      <header className="header">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage("home");
          }}
        >
          <span className="brand-icon">🍼</span>
          <span>
            am-am<span className="brand-dot">.</span>
          </span>
        </a>
        <nav aria-label="Головна навігація">
          <button
            className={page === "home" ? "active" : ""}
            onClick={() => setPage("home")}
          >
            <Milk size={17} />
            Годування
          </button>
          <button
            className={page === "stats" ? "active" : ""}
            onClick={() => setPage("stats")}
          >
            <BarChart3 size={17} />
            Статистика
          </button>
        </nav>
        <button className="header-family" onClick={() => setModal("access")}>
          <span className="family-emojis">🦁 🐻</span>
          <span>Наша родина</span>
          <Settings2 size={16} />
        </button>
      </header>
      <main>
        {demoMode && (
          <div className="demo-banner">
            <span>🌱 Демо-простір · ці записи лише для знайомства</span>
            <button
              onClick={() => {
                changeMode("live");
                setModal("access");
              }}
            >
              Підключити родину <ArrowRight size={14} />
            </button>
          </div>
        )}
        {error && (
          <div className="error-banner" role="alert">
            <span>{error}</span>
            <button onClick={load}>
              Спробувати знову <RefreshCw size={15} />
            </button>
          </div>
        )}
        {!demoMode && !connected && (
          <div className="connect-banner">
            <span>
              🔐 Підключіть сімейний щоденник, щоб зберігати годування.
            </span>
            <button onClick={() => setModal("access")}>
              Увійти <ArrowRight size={15} />
            </button>
          </div>
        )}
        <section className="hero">
          <div>
            <p className="eyebrow">
              <span /> МАЛЕНЬКІ МОМЕНТИ, ЩОДНЯ
            </p>
            <h1>
              {page === "home" ? (
                <>
                  Маленькі годування.
                  <br />
                  <span>Велика турбота.</span>
                </>
              ) : (
                <>
                  Кожна краплинка
                  <br />
                  <span>має свою історію.</span>
                </>
              )}
            </h1>
            <p className="hero-text">
              {page === "home"
                ? "Трохи менше пам’ятати. Трохи більше бути поруч 🤍"
                : "Годування, інтервали й маленькі спостереження — в одному місці."}
            </p>
          </div>
          <div className="clock-card">
            <div className="clock-label">
              <Clock3 size={15} /> ЗАРАЗ САМЕ ЧАС
            </div>
            <div className="clock-time">
              {timeLabel(now, offset)}
              <Asterisk className="clock-spark" aria-hidden="true" strokeWidth={1.5} />
            </div>
            <div className="clock-bottom">
              <span>
                {prettyDate(today, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </span>
              <button onClick={() => setModal("timezone")}>
                {offsetLabel(offset)} <Pencil size={12} /> змінити
              </button>
            </div>
          </div>
        </section>

        {page === "home" ? (
          <div className="home-layout">
            <div className="main-column">
              <div className="section-heading">
                <h2>
                  Хто зголоднів? <span>👶</span>
                </h2>
                <span className="subtle">Оберіть малюка</span>
              </div>
              <div className="children-grid">
                {CHILDREN.map((child) => {
                  const last = allLatest.find((r) => r.childId === child.id);
                  return (
                    <button
                      key={child.id}
                      className={`child-card ${child.color}`}
                      onClick={() =>
                        connected || demoMode
                          ? start(child)
                          : setModal("access")
                      }
                    >
                      <div className="child-top">
                        <span className="child-emoji">{child.emoji}</span>
                        <span className="child-plus">
                          <Plus size={22} />
                        </span>
                      </div>
                      <h3>{child.name}</h3>
                      <p className="child-hint">{child.hint}</p>
                      <div className="last-feeding">
                        <span>
                          <Clock3 size={13} /> Від останнього годування
                        </span>
                        <strong>
                          {last ? elapsed(now - +new Date(last.fedAt)) : "—:—"}
                          <small>
                            {last ? "год : хв" : "ще немає записів"}
                          </small>
                        </strong>
                      </div>
                      <div className="child-footer">
                        <span>
                          {last ? (
                            <>
                              Останнє о {timeLabel(last.fedAt, offset)} ·{" "}
                              <b>{last.consumedMl} мл</b>
                            </>
                          ) : (
                            "Додамо перше годування?"
                          )}
                        </span>
                        <ArrowRight size={18} />
                      </div>
                      {child.id === "leon" ? (
                        <Asterisk className="card-decoration" aria-hidden="true" strokeWidth={1.5} />
                      ) : (
                        <Flower2 className="card-decoration" aria-hidden="true" strokeWidth={1.5} />
                      )}
                    </button>
                  );
                })}
              </div>
              <section className="history-section">
                <div className="section-heading">
                  <h2>
                    <History size={19} /> Останні годування
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => setPage("stats")}
                  >
                    Уся історія <ArrowRight size={15} />
                  </button>
                </div>
                {recordList(sorted.slice(0, 4))}
              </section>
            </div>
            <aside>
              <section className="daily-card">
                <div className="daily-title">
                  <span className="sun">☀️</span>
                  <div>
                    <h2>Маленькі підсумки</h2>
                    <p>
                      Сьогодні,{" "}
                      {prettyDate(today, { day: "numeric", month: "long" })}
                    </p>
                  </div>
                </div>
                <div className="daily-total">
                  <strong>
                    {todayMl}
                    <span>мл</span>
                  </strong>
                  <p>випито за сьогодні</p>
                </div>
                <div className="daily-breakdown">
                  {CHILDREN.map((c) => {
                    const rows = todayRecords.filter((r) => r.childId === c.id);
                    const ml = rows.reduce((s, r) => s + r.consumedMl, 0);
                    return (
                      <div key={c.id}>
                        <div className="breakdown-title">
                          <span>
                            {c.emoji} {c.name}
                          </span>
                          <b>
                            {ml} <small>мл</small>
                          </b>
                        </div>
                        <div className="progress-track">
                          <span
                            className={c.color}
                            style={{
                              width: `${todayMl ? (ml / todayMl) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="feeding-count">
                          Годувань: {rows.length}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="daily-footer">
                  <Milk size={17} />
                  <span>Годувань разом</span>
                  <b>{todayRecords.length}</b>
                </div>
              </section>
              <div className="care-note">
                <span>🤍</span>
                <h3>
                  Кожна краплинка —<br />
                  це трохи любові.
                </h3>
                <p>
                  Ви дбаєте про малечу.
                  <br />А ми — про маленькі деталі.
                </p>
                <Asterisk className="note-flower" aria-hidden="true" strokeWidth={1.5} />
              </div>
            </aside>
          </div>
        ) : (
          <section className="stats-section">
            <div className="stats-toolbar">
              <div className="segmented" aria-label="Дитина">
                {[{ id: "all", name: "Обидва", emoji: "👶" }, ...CHILDREN].map(
                  (c) => (
                    <button
                      key={c.id}
                      className={filter === c.id ? "selected" : ""}
                      onClick={() => setFilter(c.id)}
                    >
                      {c.emoji} {c.name}
                    </button>
                  ),
                )}
              </div>
              <select
                aria-label="Період статистики"
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value))}
              >
                <option value="1">Сьогодні</option>
                <option value="7">Останні 7 днів</option>
                <option value="30">Останні 30 днів</option>
              </select>
            </div>
            <div className="metrics">
              <Metric
                emoji="🍼"
                label="Випито молочка"
                value={`${totalMl} мл`}
              />
              <Metric emoji="🤍" label="Годувань" value={filtered.length} />
              <Metric
                emoji="⏱️"
                label="Середній інтервал"
                value={avgInterval}
              />
              <Metric
                emoji="💧"
                label="Зі зригуванням"
                value={filtered.filter((r) => r.spitUp).length}
              />
            </div>
            <div className="chart-card">
              <div className="section-heading">
                <div>
                  <h2>Годування у краплинках</h2>
                  <p className="subtle">З’їдений об’єм за день, мл</p>
                </div>
                <div className="chart-legend">
                  <span className="sage" /> Леон <span className="peach" /> Лука
                </div>
              </div>
              <div className={`chart ${period === 30 ? "many-days" : ""}`}>
                {days.map((day, i) => {
                  const rows = filtered.filter(
                    (r) => dateKey(r.fedAt, offset) === day,
                  );
                  const total = rows.reduce((s, r) => s + r.consumedMl, 0);
                  return (
                    <div className="chart-column" key={day}>
                      <span className="chart-value">{total || ""}</span>
                      <div className="bar-space">
                        <div
                          className="bar-stack"
                          style={{ height: `${(total / maxDay) * 100}%` }}
                          title={`${prettyDate(day)}: ${total} мл`}
                        >
                          {[...CHILDREN].reverse().map((c) => (
                            <span
                              key={c.id}
                              className={c.color}
                              style={{
                                height: `${total ? (rows.filter((r) => r.childId === c.id).reduce((s, r) => s + r.consumedMl, 0) / total) * 100 : 0}%`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="chart-day">
                        {period < 30 || i % 5 === 0 || i === 29
                          ? prettyDate(day, { day: "numeric", month: "short" })
                          : "·"}
                      </span>
                    </div>
                  );
                })}
              </div>
              {!filtered.length && (
                <p className="chart-empty">
                  За цей період ще немає годувань 🌱
                </p>
              )}
            </div>
            <div className="section-heading">
              <h2>Щоденник годувань</h2>
              <span className="subtle">
                {prettyDate(firstDay, { day: "numeric", month: "short" })} —{" "}
                {prettyDate(today, { day: "numeric", month: "short" })}
              </span>
            </div>
            {recordList(filtered, true)}
            <p className="stats-caption">
              Інтервали рахуємо окремо для кожного малюка між послідовними
              годуваннями. Час: {offsetLabel(offset)}.
            </p>
          </section>
        )}
        <footer>
          <span className="footer-brand">am-am.</span>
          <span>
            Зроблено з турботою для Леона й Луки <Heart size={12} />
          </span>
          <button
            className="connection-status"
            onClick={() => setModal("access")}
            aria-label="Налаштування сімейного щоденника"
          >
            <i
              className={
                demoMode ? "demo" : connected && !error ? "online" : ""
              }
            />
            {demoMode
              ? "Демо-режим"
              : loading
                ? "Оновлюємо…"
                : connected
                  ? error
                    ? "Немає зв’язку"
                    : "Сімейний щоденник"
                  : "Не підключено"}
          </button>
        </footer>
      </main>
      {modal === "timezone" && (
        <Dialog title="Ваш час 🌍" close={() => setModal(null)}>
          <p className="modal-description">
            Оберіть часовий пояс. Усі записи й підсумки відображатимуться за цим
            часом.
          </p>
          <label className="field-label" htmlFor="offset">
            Часовий пояс
          </label>
          <select
            id="offset"
            value={offset}
            onChange={(e) => {
              const v = +e.target.value;
              setOffset(v);
              store("amam.offset", v);
            }}
          >
            {Array.from(
              new Set([
                ...Array.from({ length: 27 }, (_, i) => i - 12),
                offset,
              ]),
            )
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  {offsetLabel(n)}
                </option>
              ))}
          </select>
          <p className="field-help">
            Фіксований UTC-зсув. При переході на літній чи зимовий час змініть
            його тут.
          </p>
          <button className="primary" onClick={() => setModal(null)}>
            <Check size={17} /> Зберегти
          </button>
        </Dialog>
      )}
      {modal === "access" && (
        <AccessDialog
          close={() => setModal(null)}
          demoMode={demoMode}
          connected={connected}
          onDemo={() => changeMode("demo")}
          onConnected={(value) => {
            store("amam.key", value);
            setKey(value);
            changeMode("live");
            setToast("Родину підключено 🤍");
          }}
          onLogout={() => {
            store("amam.key", "");
            setKey("");
            setRecords([]);
            setLatest([]);
            setModal(null);
          }}
        />
      )}
      {modal === "feeding" && (
        <FeedingDialog
          child={editing.child}
          record={editing.record}
          offset={offset}
          demoMode={demoMode}
          close={() => setModal(null)}
          onSaved={(saved) => {
            if (demoMode) {
              const next = [saved, ...demo.filter((r) => r._id !== saved._id)];
              store("amam.demo", next);
              setDemo(next);
            } else {
              setRecords((previous) => [
                saved,
                ...previous.filter((r) => r._id !== saved._id),
              ]);
              load();
            }
            setModal(null);
            setToast(
              editing.record
                ? "Запис оновлено 🤍"
                : "Годування збережено. Смачного малечі 🤍",
            );
          }}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
        </div>
      )}
    </>
  );
}
function Metric({ emoji, label, value }) {
  return (
    <div className="metric">
      <span>{emoji}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function AccessDialog({
  close,
  demoMode,
  connected,
  onConnected,
  onDemo,
  onLogout,
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const previous = readStored("amam.key", "");
    store("amam.key", value.trim());
    try {
      await request("/feedings/latest");
      onConnected(value.trim());
    } catch (e) {
      store("amam.key", previous);
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Наша родина 🦁 🐻"
      close={() => {
        if (!busy) close();
      }}
    >
      <p className="modal-description">
        Сімейний код відкриває ваш спільний щоденник на будь-якому пристрої.
      </p>
      {!API_URL && (
        <p className="form-error">
          API ще не налаштовано. Доступний демо-режим.
        </p>
      )}
      {connected && !demoMode ? (
        <>
          <div className="connected-box">
            <ShieldCheck size={25} />
            <span>Ваш сімейний щоденник підключено.</span>
          </div>
          <button className="secondary" onClick={onLogout}>
            <LogOut size={16} /> Вийти на цьому пристрої
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="family-key">
            Сімейний код
          </label>
          <input
            id="family-key"
            type="password"
            autoComplete="current-password"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Введіть код доступу"
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={!API_URL || busy}>
            {busy ? (
              "Підключаємо…"
            ) : (
              <>
                <LogIn size={17} /> Підключити щоденник
              </>
            )}
          </button>
        </form>
      )}
      <button
        className="text-button demo-link"
        disabled={busy}
        onClick={onDemo}
      >
        Поглянути демо 🌱
      </button>
      <p className="field-help">
        Код зберігається лише в цьому браузері. Дані демо не надсилаються на
        сервер.
      </p>
    </Dialog>
  );
}

function FeedingDialog({ child, record, offset, demoMode, close, onSaved }) {
  const [step, setStep] = useState(record ? 2 : 1);
  const [offered, setOffered] = useState(record?.offeredMl || 120);
  const [consumed, setConsumed] = useState(record?.consumedMl ?? 120);
  const [spitUp, setSpitUp] = useState(record?.spitUp || false);
  const [at, setAt] = useState(localInput(record?.fedAt || Date.now(), offset));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [id] = useState(() => record?._id || crypto.randomUUID());
  const [fixedAt] = useState(() => record?.fedAt || new Date().toISOString());
  const payloadRef = useRef(null);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    const fedAt =
      at === localInput(fixedAt, offset) ? fixedAt : inputISO(at, offset);
    if (
      !fedAt ||
      +new Date(fedAt) > Date.now() + 300000 ||
      +new Date(fedAt) < Date.UTC(2020, 0, 1)
    ) {
      setError("Перевірте час годування. Він не може бути в майбутньому.");
      return;
    }
    const body = payloadRef.current || {
      id,
      childId: child.id,
      offeredMl: offered,
      consumedMl: consumed,
      spitUp,
      fedAt,
    };
    payloadRef.current = body;
    setBusy(true);
    setError("");
    try {
      const saved = demoMode
        ? { ...body, _id: id }
        : await request(record ? `/feedings/${id}` : "/feedings", {
            method: record ? "PUT" : "POST",
            body: JSON.stringify(body),
          });
      onSaved(saved);
    } catch (e) {
      setError(
        e.message +
          " Повторне підтвердження надішле цей самий запис без дублювання.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title={`${child.emoji} ${record ? "Редагувати" : "Годуємо"} · ${child.name}`}
      className="feeding-dialog"
      close={() => {
        if (!busy) close();
      }}
    >
      <div className="steps">
        <span className={step === 1 ? "current" : "done"}>
          1 <b>Пляшечка</b>
        </span>
        <div />
        <span className={step === 2 ? "current" : ""}>
          2 <b>Як поїли</b>
        </span>
      </div>
      <form onSubmit={submit}>
        {step === 1 ? (
          <>
            <h3 className="step-title">Скільки молочка приготували? 🍼</h3>
            <p className="modal-description">
              Оберіть початковий об’єм пляшечки.
            </p>
            <div className="volume-grid">
              {Array.from({ length: 10 }, (_, i) => (i + 1) * 30).map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={Boolean(payloadRef.current)}
                  aria-pressed={offered === n}
                  className={offered === n ? `selected ${child.color}` : ""}
                  onClick={() => {
                    setOffered(n);
                    setConsumed(Math.min(consumed, n));
                  }}
                >
                  {n}
                  <span>мл</span>
                </button>
              ))}
            </div>
            <button
              className="primary"
              type="button"
              onClick={() => {
                if (!record) setConsumed(offered);
                setStep(2);
              }}
            >
              Далі <ArrowRight size={17} />
            </button>
          </>
        ) : (
          <>
            <div className="bottle-summary">
              <span>
                🍼 Пляшечка <b>{offered} мл</b>
              </span>
              <button
                type="button"
                className="text-button"
                disabled={busy || Boolean(payloadRef.current)}
                onClick={() => setStep(1)}
              >
                <Pencil size={14} /> Редагувати
              </button>
            </div>
            <h3 className="step-title">Скільки з’їв {child.name}? 😋</h3>
            <div className="consumed-value">
              {consumed}
              <span>мл</span>
            </div>
            <input
              className={`volume-slider ${child.color}`}
              aria-label="З’їдений об’єм, мл"
              type="range"
              min="0"
              max={offered}
              step="1"
              disabled={busy || Boolean(payloadRef.current)}
              value={consumed}
              onChange={(e) => setConsumed(+e.target.value)}
            />
            <div className="range-labels">
              <span>0 мл</span>
              <span>{offered} мл</span>
            </div>
            <div className="consumed-controls">
              <button
                type="button"
                disabled={busy || Boolean(payloadRef.current) || consumed === 0}
                onClick={() => setConsumed(Math.max(0, consumed - 5))}
              >
                − 5 мл
              </button>
              <span>Залишилось {offered - consumed} мл</span>
              <button
                type="button"
                disabled={
                  busy || Boolean(payloadRef.current) || consumed === offered
                }
                onClick={() => setConsumed(Math.min(offered, consumed + 5))}
              >
                + 5 мл
              </button>
            </div>
            <p className="field-label">Чи було зригування після?</p>
            <div className="checkbox-options">
              {[false, true].map((v) => (
                <label
                  key={String(v)}
                  className={spitUp === v ? "checked" : ""}
                >
                  <input
                    type="checkbox"
                    checked={spitUp === v}
                    disabled={busy || Boolean(payloadRef.current)}
                    onChange={() => setSpitUp(v)}
                  />
                  <span>{v ? "💧 Так, було" : "✨ Ні, не було"}</span>
                  {spitUp === v && <Check size={16} />}
                </label>
              ))}
            </div>
            <label className="field-label" htmlFor="fed-at">
              Час годування · {offsetLabel(offset)}
            </label>
            <input
              id="fed-at"
              required
              type="datetime-local"
              min="2020-01-01T00:00"
              max={localInput(Date.now() + 60000, offset)}
              value={at}
              disabled={busy || Boolean(payloadRef.current)}
              onChange={(e) => setAt(e.target.value)}
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? (
                "Зберігаємо…"
              ) : (
                <>
                  <Check size={18} />{" "}
                  {record ? "Зберегти зміни" : "Підтвердити годування"}
                </>
              )}
            </button>
            <p className="field-help center">
              {demoMode
                ? "🌱 Демо: запис залишиться лише в цьому браузері."
                : "Можна буде відредагувати в історії 🤍"}
            </p>
          </>
        )}
      </form>
    </Dialog>
  );
}

createRoot(document.getElementById("root")).render(<App />);
