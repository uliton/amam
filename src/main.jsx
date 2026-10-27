import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Asterisk,
  BarChart3,
  Check,
  Clock3,
  Download,
  Flower2,
  Heart,
  History,
  Milk,
  Pencil,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  RotateCcw,
} from "lucide-react";
import {
  REVIEW_MODE,
  CHILDREN as DEFAULT_CHILDREN,
  readStored,
  store,
  elapsed,
  dateKey,
  timeLabel,
  localInput,
  inputISO,
  demoFeedings,
} from "./data";
import "./styles.css";
import {
  IntegrationSlot,
  INTEGRATIONS,
  REVIEW_INTEGRATIONS,
} from "./integrations";
import "./refinements.css";
import { Dialog } from "./ui";
import { Workspace } from "./workspace";
import { download } from "./family-client";
import { exportCsv } from "./csv";
import { loadFeedings, periodStatistics, feedingIntervals } from "./statistics";
import "./families.css";
import { FamilyEmojis } from "./family-emojis";

const offsetLabel = (n) => `UTC${n >= 0 ? "+" : ""}${n}`;
const prettyDate = (key, options = { day: "numeric", month: "long" }) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString("uk-UA", {
    ...options,
    timeZone: "UTC",
  });

function App({
  family,
  children: CHILDREN,
  role,
  api: request,
  demoMode,
  onFamilies,
  onExitDemo,
}) {
  const canWrite = demoMode || (role !== "viewer" && !family?.archived);
  const [now, setNow] = useState(Date.now());
  const [offset, setOffset] = useState(
    () =>
      family?.offset ??
      readStored("amam.offset", -new Date().getTimezoneOffset() / 60),
  );
  const [page, setPage] = useState("home");
  const [integrationPreview, setIntegrationPreview] = useState(false);
  const integrations =
    REVIEW_MODE && integrationPreview ? REVIEW_INTEGRATIONS : INTEGRATIONS;
  const [records, setRecords] = useState([]);
  const [latest, setLatest] = useState([]);
  const [trash, setTrash] = useState([]);
  const [showTrash, setShowTrash] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState("");
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
  const [fullHistoryLoaded, setFullHistoryLoaded] = useState(false);
  const allTime = period === "all";
  const needsFullHistory = allTime || ["3m", "6m", "12m"].includes(period);
  const loadId = useRef(0);
  const connected = Boolean(family);
  const today = dateKey(now, offset);
  const data = (demoMode ? demo : records).filter((r) => !r.deletedAt);
  const trashed = demoMode
    ? demo
        .filter((r) => r.deletedAt)
        .sort((a, b) => +new Date(b.deletedAt) - +new Date(a.deletedAt))
    : trash;
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
      const items = await loadFeedings(request, { allTime: needsFullHistory });
      const [last, deleted] = await Promise.all([
        request("/feedings/latest"),
        request("/feedings/trash"),
      ]);
      if (id === loadId.current) {
        setRecords(items);
        setFullHistoryLoaded(needsFullHistory);
        setLatest(last.items);
        setTrash(deleted.items);
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
  }, [needsFullHistory]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  function start(child, record = null) {
    if (!canWrite) return;
    setEditing({ child, record });
    setModal("feeding");
  }
  async function changeRecordStatus(record, restore = false) {
    if (actionBusy || !canWrite) return;
    setActionBusy(true);
    setActionError("");
    try {
      const saved = demoMode
        ? restore
          ? Object.fromEntries(
              Object.entries(record).filter(([key]) => key !== "deletedAt"),
            )
          : { ...record, deletedAt: new Date().toISOString() }
        : await request(`/feedings/${record._id}${restore ? "/restore" : ""}`, {
            method: restore ? "POST" : "DELETE",
          });
      if (demoMode) {
        const next = demo.map((r) => (r._id === saved._id ? saved : r));
        store("amam.demo", next);
        setDemo(next);
      } else {
        // Update visible totals immediately, then reconcile with the server.
        ++loadId.current;
        setRecords((previous) =>
          restore
            ? [saved, ...previous.filter((r) => r._id !== saved._id)]
            : previous.filter((r) => r._id !== saved._id),
        );
        setTrash((previous) =>
          restore
            ? previous.filter((r) => r._id !== saved._id)
            : [saved, ...previous.filter((r) => r._id !== saved._id)],
        );
        if (!restore)
          setLatest((previous) => previous.filter((r) => r._id !== saved._id));
        load();
      }
      setDeleteTarget(null);
      setToast(
        restore ? "Годування відновлено" : "Годування перенесено в кошик",
      );
    } catch (e) {
      setActionError(e.message);
    } finally {
      setActionBusy(false);
    }
  }
  const todayRecords = data.filter((r) => dateKey(r.fedAt, offset) === today);
  const todayMl = todayRecords.reduce((s, r) => s + r.consumedMl, 0);
  const sorted = [...data].sort(
    (a, b) =>
      +new Date(b.fedAt) - +new Date(a.fedAt) || b._id.localeCompare(a._id),
  );
  const intervalByRecord = feedingIntervals(sorted);
  const previousInterval = (record) => intervalByRecord.get(record._id) ?? null;
  const waitingForHistory = needsFullHistory && !demoMode && !fullHistoryLoaded;
  const { rows: filtered, firstDay, buckets, monthly, weekly } = periodStatistics(
    waitingForHistory ? [] : sorted,
    { period, childId: filter, today, offset },
  );
  const totalMl = filtered.reduce((s, r) => s + r.consumedMl, 0);
  const intervals = filtered.map(previousInterval).filter((x) => x !== null);
  const avgInterval = intervals.length
    ? elapsed(intervals.reduce((a, b) => a + b, 0) / intervals.length)
    : "—";
  const maxDay = buckets.reduce((max, bucket) => Math.max(max, bucket.total), 1);

  function recordList(items, isStats = false, isTrash = false) {
    if (!items.length)
      return (
        <div className="empty">
          <span>🍼</span>
          <h3>
            {loading
              ? "Завантажуємо годування…"
              : isTrash
                ? "Кошик порожній"
                : "Ще немає годувань"}
          </h3>
          <p>
            {loading
              ? "Ще мить — і все буде на місці."
              : isTrash
                ? "Видалені записи можна буде відновити тут."
                : "Оберіть малюка, щоб додати годування."}
          </p>
        </div>
      );
    return (
      <div className="records">
        {items.map((r) => {
          const child = CHILDREN.find((c) => c.id === r.childId) || {
            id: r.childId,
            name: "Дитина",
            emoji: "👶",
            color: "sage",
          };
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
              <div className="record-actions">
                <span
                  className={`spit-badge ${r.spitUp ? "yes" : ""}`}
                  role="img"
                  aria-label={r.spitUp ? "Було зригування" : "Без зригування"}
                  title={r.spitUp ? "Було зригування" : "Без зригування"}
                >
                  {r.spitUp ? "💧" : "✨"}
                </span>
                {canWrite &&
                  (isTrash ? (
                    <button
                      className="restore-button"
                      disabled={actionBusy}
                      onClick={() => changeRecordStatus(r, true)}
                    >
                      <RotateCcw size={17} /> Відновити
                    </button>
                  ) : (
                    <>
                      <button
                        className="icon-btn"
                        aria-label={`Редагувати годування ${child.name}, ${timeLabel(r.fedAt, offset)}`}
                        onClick={() => start(child, r)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        className="icon-btn delete-record"
                        aria-label={`Видалити годування ${child.name}, ${timeLabel(r.fedAt, offset)}`}
                        onClick={() => {
                          setActionError("");
                          setDeleteTarget(r);
                        }}
                      >
                        <Trash2 size={17} />
                      </button>
                    </>
                  ))}
              </div>
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
        <button className="header-family" onClick={onFamilies}>
          <FamilyEmojis children={CHILDREN} demoMode={demoMode} />
          <span>{demoMode ? "Демо" : family.name}</span>
          <Settings2 size={16} />
        </button>
      </header>
      <main>
        {demoMode && (
          <div className="demo-banner">
            <span>
              {REVIEW_MODE
                ? "🌱 Локальний перегляд · демо-дані"
                : "🌱 Спробуйте демо — справжні записи не змінюються"}
            </span>
            {REVIEW_MODE && (
              <button
                className="integration-preview-toggle"
                aria-pressed={integrationPreview}
                onClick={() => setIntegrationPreview(!integrationPreview)}
              >
                {integrationPreview ? "Без інтеграцій" : "Приклад інтеграції"}
              </button>
            )}
            <button
              onClick={() => {
                onExitDemo();
              }}
            >
              {"Мої родини"} <ArrowRight size={14} />
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
        {!demoMode && (
          <div className="family-context">
            <span>{family.name}</span>
            <span>
              {family.archived
                ? "📦 Архів · лише перегляд"
                : role === "viewer"
                  ? "👀 Лише перегляд"
                  : role === "owner"
                    ? "🔑 Власник"
                    : "🍼 Можна додавати годування"}
            </span>
          </div>
        )}
        <section className="hero compact-hero home-hero">
          <h1 className="sr-only">{page === "home" ? "Годування" : "Статистика"}</h1>
          <IntegrationSlot
            placement="hero"
            campaign={integrations.hero}
            onPreview={
              REVIEW_MODE ? () => setModal("integration-preview") : null
            }
          />
          <div className="clock-card">
            <div className="clock-label">
              <Clock3 size={16} /> Поточний час
            </div>
            <div className="clock-time">
              {timeLabel(now, offset)}
              <Asterisk
                className="clock-spark"
                aria-hidden="true"
                strokeWidth={1.5}
              />
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
                  {canWrite ? "Хто зголоднів?" : "Малеча"} <span>👶</span>
                </h2>
                <span className="subtle">
                  {canWrite ? "Оберіть малюка" : "Останні годування"}
                </span>
              </div>
              <div className="children-grid">
                {CHILDREN.filter((c) => !c.archived).map((child) => {
                  const last = allLatest.find((r) => r.childId === child.id);
                  return (
                    <button
                      key={child.id}
                      className={`child-card ${child.color}`}
                      disabled={!canWrite}
                      onClick={() => start(child)}
                    >
                      <div className="child-top">
                        <span className="child-emoji">{child.emoji}</span>
                        <span className="child-plus">
                          {canWrite ? (
                            <Plus size={22} />
                          ) : (
                            <History size={22} />
                          )}
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
                              <b className="feeding-volume">{last.consumedMl}{"\u00a0"}мл</b>
                            </>
                          ) : canWrite ? (
                            "Додамо перше годування?"
                          ) : (
                            "Ще немає годувань"
                          )}
                        </span>
                        <ArrowRight size={18} />
                      </div>
                      {child.id === "leon" ? (
                        <Asterisk
                          className="card-decoration"
                          aria-hidden="true"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <Flower2
                          className="card-decoration"
                          aria-hidden="true"
                          strokeWidth={1.5}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
              {!CHILDREN.some((c) => !c.archived) && (
                <div className="empty">
                  <span>🌱</span>
                  <h3>Діти в архіві</h3>
                  <button className="text-button" onClick={onFamilies}>
                    Відкрити родину
                  </button>
                </div>
              )}
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
                {recordList(sorted.slice(0, 4), true)}
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
              <IntegrationSlot
                placement="care"
                campaign={integrations.care}
                onPreview={
                  REVIEW_MODE ? () => setModal("integration-preview") : null
                }
              />
            </aside>
          </div>
        ) : (
          <section className="stats-section">
            <div className="stats-toolbar">
              <label className="stats-filter stats-child-filter">
                <span>Малюк</span>
                <select
                  aria-label="Малюк у статистиці"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">👶 Усі малюки</option>
                  {CHILDREN.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="stats-period-actions">
                <label className="stats-filter">
                  <span>Період</span>
                  <select
                    aria-label="Період статистики"
                    value={period}
                    onChange={(e) =>
                      setPeriod(["all", "month", "3m", "6m", "12m"].includes(e.target.value)
                        ? e.target.value : Number(e.target.value))
                    }
                  >
                    <option value="1">Сьогодні</option>
                    <option value="7">Тиждень</option>
                    <option value="month">Місяць</option>
                    <option value="3m">Останні 3 місяці</option>
                    <option value="6m">Останні 6 місяців</option>
                    <option value="12m">Останній рік</option>
                    <option value="all">Весь період</option>
                  </select>
                </label>
                <button
                  className="secondary stats-export"
                  aria-label="Експорт CSV за обраними фільтрами"
                  disabled={waitingForHistory}
                  onClick={() =>
                    download(
                      "amam-feedings.csv",
                      exportCsv(filtered, CHILDREN),
                      "text/csv;charset=utf-8",
                    )
                  }
                >
                  <Download size={18} aria-hidden="true" />
                  <span className="stats-export-label">Експорт</span> CSV
                </button>
              </div>
            </div>
            {waitingForHistory && (
              <p className="stats-history-loading" role="status">
                {error ? "Не вдалося завантажити всю історію. Спробуйте оновити дані." : "Завантажуємо всю історію…"}
              </p>
            )}
            <div className="metrics">
              <Metric
                emoji="🍼"
                label="Випито молочка"
                value={waitingForHistory ? "—" : `${totalMl} мл`}
              />
              <Metric emoji="🤍" label="Годувань" value={waitingForHistory ? "—" : filtered.length} />
              <Metric
                emoji="⏱️"
                label="Середній інтервал"
                value={avgInterval}
              />
              <Metric
                emoji="💧"
                label="Зі зригуванням"
                value={waitingForHistory ? "—" : filtered.filter((r) => r.spitUp).length}
              />
            </div>
            <div className="chart-card">
              <div className="section-heading">
                <div>
                  <h2>Годування у краплинках</h2>
                  <p className="subtle">
                    {weekly ? "Об’єм, мл · 🍼 годувань за тиждень" : `Об’єм і кількість годувань за ${monthly ? "місяць" : "день"}`}
                  </p>
                </div>
                <div className="chart-legend">
                  {CHILDREN.map((c) => (
                    <React.Fragment key={c.id}>
                      <span className={c.color} /> {c.name}
                      {c.archived ? " · архів" : ""}{" "}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div
                className={`chart chart-with-counts${weekly ? " weekly-chart" : ""}`}
                style={weekly ? { "--week-count": buckets.length } : undefined}
              >
                {buckets.map(({ key: day, start, end, total, count, children }) => {
                  const weekRange = start === end ? String(Number(start.slice(-2))) : `${Number(start.slice(-2))}–${Number(end.slice(-2))}`;
                  const label = weekly
                    ? `${weekRange} ${prettyDate(end, { month: "short" })}`
                    : prettyDate(day, monthly
                    ? { month: "short", year: "numeric" }
                    : { day: "numeric", month: "short" });
                  return (
                    <div className="chart-column" key={day} aria-label={`${label}: ${total} мл · ${count} годувань`}>
                      <span className="chart-value">
                        <b>{total}{!weekly && <>{"\u00a0"}мл</>}</b>
                        <small>{weekly ? <>🍼{count}</> : <>{count}{"\u00a0"}годув.</>}</small>
                      </span>
                      <div className="bar-space">
                        <div
                          className="bar-stack"
                          style={{ height: `${(total / maxDay) * 100}%` }}
                          title={`${label}: ${total} мл · ${count} годувань`}
                        >
                          {[...CHILDREN].reverse().map((c) => (
                            <span
                              key={c.id}
                              className={c.color}
                              style={{
                                height: `${total ? ((children.get(c.id) || 0) / total) * 100 : 0}%`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="chart-day">
                        {weekly ? <>{weekRange}<small>{prettyDate(end, { month: "short" })}</small></> : label}
                      </span>
                    </div>
                  );
                })}
              </div>
              {!filtered.length && !waitingForHistory && (
                <p className="chart-empty">
                  За цей період ще немає годувань 🌱
                </p>
              )}
            </div>
            <div className="section-heading">
              <h2>{showTrash ? "Кошик" : "Щоденник годувань"}</h2>
              <button
                className="text-button trash-toggle"
                aria-pressed={showTrash}
                onClick={() => {
                  setActionError("");
                  setShowTrash(!showTrash);
                }}
              >
                {showTrash ? <History size={17} /> : <Trash2 size={17} />}{" "}
                {showTrash
                  ? "До історії"
                  : `Кошик${trashed.length ? ` (${trashed.length})` : ""}`}
              </button>
              <span className="subtle">
                {showTrash || allTime
                  ? "За весь час"
                  : `${prettyDate(firstDay, { day: "numeric", month: "short", ...(monthly ? { year: "numeric" } : {}) })} — ${prettyDate(today, { day: "numeric", month: "short", ...(monthly ? { year: "numeric" } : {}) })}`}
              </span>
            </div>
            {showTrash && (
              <p className="trash-description">
                Ці записи не впливають на статистику. Їх можна відновити.
              </p>
            )}
            {actionError && !deleteTarget && (
              <p className="form-error" role="alert">
                {actionError}
              </p>
            )}
            {showTrash
              ? recordList(
                  trashed.filter(
                    (r) => filter === "all" || r.childId === filter,
                  ),
                  false,
                  true,
                )
              : waitingForHistory ? null : recordList(filtered, true)}
            <p className="stats-caption">
              Інтервали — окремо для кожного малюка · {offsetLabel(offset)}
            </p>
          </section>
        )}
        <footer>
          <span className="footer-brand">am-am.</span>
          <span>
            З турботою про вашу родину <Heart size={12} />
          </span>
          <button
            className="connection-status"
            onClick={onFamilies}
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
      {modal === "integration-preview" && REVIEW_MODE && (
        <Dialog title="Приклад інтеграції" close={() => setModal(null)}>
          <p className="modal-description">
            Це локальний макет для погодження вигляду. Бренд, текст і посилання
            можна буде замінити для конкретного партнера.
          </p>
          <button className="primary" onClick={() => setModal(null)}>
            Зрозуміло
          </button>
        </Dialog>
      )}
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
      {modal === "feeding" && (
        <FeedingDialog
          request={request}
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
      {deleteTarget && (
        <Dialog
          title="Видалити годування?"
          close={() => {
            if (!actionBusy) setDeleteTarget(null);
          }}
        >
          <div className="delete-summary">
            <span>
              {CHILDREN.find((c) => c.id === deleteTarget.childId)?.emoji}
            </span>
            <div>
              <strong>
                {CHILDREN.find((c) => c.id === deleteTarget.childId)?.name} ·{" "}
                {deleteTarget.consumedMl} мл
              </strong>
              <p>
                {prettyDate(dateKey(deleteTarget.fedAt, offset))} о{" "}
                {timeLabel(deleteTarget.fedAt, offset)}
              </p>
            </div>
          </div>
          <p className="modal-description">
            Запис зникне зі статистики. Його можна буде відновити з кошика.
          </p>
          {actionError && (
            <p className="form-error" role="alert">
              {actionError}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary"
              disabled={actionBusy}
              onClick={() => setDeleteTarget(null)}
            >
              Залишити
            </button>
            <button
              className="danger-button"
              disabled={actionBusy}
              onClick={() => changeRecordStatus(deleteTarget)}
            >
              <Trash2 size={17} />
              {actionBusy ? "Видаляємо…" : "У кошик"}
            </button>
          </div>
        </Dialog>
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

function FeedingDialog({
  child,
  record,
  offset,
  demoMode,
  close,
  onSaved,
  request,
}) {
  const [step, setStep] = useState(record ? 2 : 1);
  const [offered, setOffered] = useState(record?.offeredMl ?? null);
  const [consumed, setConsumed] = useState(record?.consumedMl ?? 0);
  const [spitUp, setSpitUp] = useState(record?.spitUp || false);
  const [at, setAt] = useState(localInput(record?.fedAt || Date.now(), offset));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [id] = useState(() => record?._id || crypto.randomUUID());
  const [fixedAt] = useState(() => record?.fedAt || new Date().toISOString());
  const payloadRef = useRef(null);
  async function submit(e) {
    e.preventDefault();
    if (busy || step !== 2 || offered === null) return;
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
      <form onSubmit={submit}>
        {step === 1 ? (
          <>
            <h3 className="step-title">Об’єм пляшечки 🍼</h3>
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
              disabled={offered === null}
              onClick={() => {
                if (offered === null) return;
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
            <h3 className="step-title">Як поїли? 😋</h3>
            <div
              className="amount-summary"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className={`amount-card ${child.color}`}>
                <span>З’їдено</span>
                <strong>
                  {consumed}
                  <small> мл</small>
                </strong>
              </div>
              <div className="amount-card remaining-card">
                <span>Залишилось у пляшечці</span>
                <strong>
                  {offered - consumed}
                  <small> мл</small>
                </strong>
              </div>
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
            <label className="field-label" htmlFor="fed-date">
              Дата й час годування · {offsetLabel(offset)}
            </label>
            <div className="feeding-datetime">
              <input
                id="fed-date"
                aria-label="Дата годування"
                required
                type="date"
                min="2020-01-01"
                max={localInput(Date.now() + 60000, offset).slice(0, 10)}
                value={at.slice(0, 10)}
                disabled={busy || Boolean(payloadRef.current)}
                onChange={(e) => setAt(`${e.target.value}T${at.slice(11, 16)}`)}
              />
              <input
                id="fed-time"
                aria-label="Час годування"
                required
                type="time"
                value={at.slice(11, 16)}
                disabled={busy || Boolean(payloadRef.current)}
                onChange={(e) => setAt(`${at.slice(0, 10)}T${e.target.value}`)}
              />
            </div>
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
            {demoMode && (
              <p className="field-help center">
                🌱 Демо · лише в цьому браузері
              </p>
            )}
          </>
        )}
      </form>
    </Dialog>
  );
}

createRoot(document.getElementById("root")).render(
  <Workspace FeedingApp={App} demoChildren={DEFAULT_CHILDREN} />,
);
