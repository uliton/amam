import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Plus, ChevronDown, Moon, Sun, Clock3 } from "lucide-react";
import { Dialog } from "./ui";
import {
  api,
  ROLE_NAMES,
  EMOJIS,
  PALETTES,
  download,
  copyText,
  inviteLink,
} from "./family-client";
import { THEME_OPTIONS, resolveTheme, nextThemeChange } from "./theme";
import { connectionAvailable } from "./session-state";
import { FamilyEmojis } from "./family-emojis";
import { parseCsv } from "./csv";
import { readStored, store, REVIEW_MODE, API_URL } from "./data";

const emptyChild = () => ({ name: "", emoji: "🐣", color: "sage" });
const validChild = (c) =>
  c.name.trim().length > 0 && c.name.trim().length <= 60;
export function Workspace({ FeedingApp, demoChildren }) {
  const [connections, setConnections] = useState(() =>
    readStored("amam.families", []),
  );
  const [activeId, setActiveId] = useState(() =>
    readStored("amam.activeFamily", null),
  );
  const [demo, setDemo] = useState(false);
  const [screen, setScreen] = useState(null);
  const [cardOrigin, setCardOrigin] = useState("manage");
  const [initialCode, setInitialCode] = useState("");
  const [startup, setStartup] = useState("");
  const [themePreference, setThemePreference] = useState(() => {
    const saved = readStored("amam.theme", "auto");
    return THEME_OPTIONS.includes(saved) ? saved : "auto";
  });
  const [night, setNight] = useState(
    () => resolveTheme(themePreference) === "night",
  );
  const migrated = useRef(false);
  const active = connections.find((c) => c.family.id === activeId);
  const sessionValid = connectionAvailable(active);
  function saveConnection(entry) {
    setConnections((previous) => {
      const next = [
        ...previous.filter((c) => c.family.id !== entry.family.id),
        { ...entry, needsCode: false, revision: Date.now() },
      ];
      store("amam.families", next);
      return next;
    });
    setActiveId(entry.family.id);
    store("amam.activeFamily", entry.family.id);
    setDemo(false);
    setScreen(null);
  }
  useEffect(() => {
    document.documentElement.dataset.theme = night ? "night" : "day";
  }, [night]);
  useEffect(() => {
    store("amam.theme", themePreference);
    let timer;
    function update() {
      const now = new Date();
      setNight(resolveTheme(themePreference, now) === "night");
      clearTimeout(timer);
      if (themePreference === "auto")
        timer = setTimeout(update, +nextThemeChange(now) - +now + 10);
    }
    update();
    if (themePreference !== "auto") return;
    const interval = setInterval(update, 60000);
    const visible = () => {
      if (!document.hidden) update();
    };
    document.addEventListener("visibilitychange", visible);
    window.addEventListener("focus", update);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", visible);
      window.removeEventListener("focus", update);
    };
  }, [themePreference]);
  useEffect(() => {
    if (migrated.current) return;
    migrated.current = true;
    const params = new URLSearchParams(location.hash.slice(1));
    const invitation = params.get("join");
    if (invitation) {
      // Strip the fragment before any network call. No analytics or third party scripts run here.
      history.replaceState(null, "", location.pathname + location.search);
      if (invitation.length > 200) {
        setStartup("Посилання містить некоректний код.");
        setScreen("join");
        return;
      }
      setInitialCode(invitation);
      setScreen("join");
      api("/sessions", {
        method: "POST",
        body: JSON.stringify({ code: invitation }),
      })
        .then(saveConnection)
        .catch((e) => setStartup(e.message));
      return;
    }
    const legacy = readStored("amam.key", "");
    if (!connections.length && legacy && API_URL) {
      setStartup("Підключаємо вашу родину…");
      api("/sessions", {
        method: "POST",
        body: JSON.stringify({ code: legacy }),
      })
        .then((entry) => {
          saveConnection(entry);
          setStartup("");
        })
        .catch((e) => {
          setStartup(e.message);
          setScreen("join");
        });
    }
  }, []);
  useEffect(() => {
    if (!active || demo || !sessionValid) return;
    let cancelled = false;
    async function refreshActive() {
      try {
        const me = await api("/family", {}, active.token);
        if (cancelled) return;
        setConnections((previous) => {
          const current = previous.find(
            (c) => c.family.id === active.family.id,
          );
          if (!current || current.token !== active.token) return previous;
          if (
            JSON.stringify([current.family, current.children, current.role]) ===
            JSON.stringify([me.family, me.children, me.role])
          )
            return previous;
          const next = previous.map((c) =>
            c.family.id === active.family.id
              ? { ...c, ...me, revision: Date.now() }
              : c,
          );
          store("amam.families", next);
          return next;
        });
      } catch (e) {
        if (!cancelled && e.status === 401) {
          setConnections((previous) => {
            const next = previous.map((c) =>
              c.family.id === active.family.id ? { ...c, needsCode: true } : c,
            );
            store("amam.families", next);
            return next;
          });
          setStartup(
            "Пристрій не підключено до цієї родини. Введіть код доступу.",
          );
        }
      }
    }
    refreshActive();
    const timer = setInterval(() => {
      if (!document.hidden) refreshActive();
    }, 30000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [activeId, active?.token, demo]);
  function select(entry) {
    setActiveId(entry.family.id);
    store("amam.activeFamily", entry.family.id);
    setDemo(false);
    setScreen(null);
  }
  function forget(entry) {
    if (entry.family.id === "harutsyki") store("amam.key", "");
    // Remove only the device session; the family's records and static codes are unchanged.
    api("/session", { method: "DELETE" }, entry.token).catch(() => {});
    setConnections((previous) => {
      const next = previous.filter((c) => c.family.id !== entry.family.id);
      store("amam.families", next);
      return next;
    });
    if (activeId === entry.family.id) {
      setActiveId(null);
      store("amam.activeFamily", null);
    }
  }
  const openFamilies = () => setScreen("families");
  return (
    <>
      <button
        className="theme-toggle"
        aria-label={`Тема: ${themePreference === "auto" ? "автоматична" : night ? "темна" : "світла"}. Змінити`}
        title="Змінити тему"
        onClick={() => setScreen("theme")}
      >
        {night ? <Moon size={19} /> : <Sun size={19} />}
        {themePreference === "auto" && (
          <span className="theme-auto-indicator" aria-hidden="true">
            А
          </span>
        )}
      </button>
      {demo || sessionValid ? (
        <FeedingApp
          key={
            demo
              ? "demo"
              : `${active.family.id}:${active.token}:${active.revision}`
          }
          family={demo ? null : active.family}
          children={demo ? demoChildren : active.children}
          role={demo ? "owner" : active.role}
          demoMode={demo}
          api={(path, options) => api(path, options, active?.token)}
          onFamilies={openFamilies}
          onExitDemo={() => {
            setDemo(false);
            setScreen("families");
          }}
        />
      ) : (
        <>
          <main className="welcome">
            <div className="welcome-logo" aria-label="am-am">
              <span className="welcome-logo-icon" aria-hidden="true">
                🍼
              </span>
              <span className="welcome-wordmark">
                am-am<span>.</span>
              </span>
            </div>
            <p className="eyebrow">ВАШ СІМЕЙНИЙ ЩОДЕННИК</p>
            <h1>Поруч із малечею.</h1>
            <p className="welcome-subtitle">
              Годування й турбота — разом із близькими.
            </p>
            <div className="welcome-actions">
              <button
                className="primary"
                onClick={() => {
                  setDemo(true);
                  setScreen(null);
                }}
              >
                🌱 Спробувати демо <ArrowRight size={19} />
              </button>
              <button className="secondary" onClick={() => setScreen("create")}>
                🏡 Створити родину
              </button>
              <button
                className="secondary join-welcome"
                onClick={() => {
                  setInitialCode("");
                  setScreen("join");
                }}
              >
                🔑 Маю код
              </button>
            </div>
            <p className="field-help">
              Демо без реєстрації. Для родини — лише код, без паролів.
            </p>
            {connections.length > 0 && (
              <section className="welcome-connected">
                <div className="section-heading">
                  <h2>
                    {connections.length === 1 ? "Моя родина" : "Мої родини"}
                  </h2>
                  <button className="text-button" onClick={openFamilies}>
                    Керувати
                  </button>
                </div>
                {connections.map((c) => (
                  <button
                    key={c.family.id}
                    onClick={() => {
                      if (connectionAvailable(c)) select(c);
                      else {
                        setActiveId(c.family.id);
                        setScreen("join");
                      }
                    }}
                  >
                    <span className="welcome-family-label">
                      <FamilyEmojis children={c.children} />
                      <span className="welcome-family-name">
                        {c.family.name}
                      </span>
                    </span>
                    <small>
                      {connectionAvailable(c)
                        ? ROLE_NAMES[c.role]
                        : "Введіть код знову"}{" "}
                      →
                    </small>
                  </button>
                ))}
              </section>
            )}
            {startup && (
              <p className="field-help" role="status">
                {startup}
              </p>
            )}
            {REVIEW_MODE && (
              <p className="review-notice">
                🧪 Локальний перегляд. Справжня БД не підключена.
              </p>
            )}
          </main>
        </>
      )}
      {screen === "theme" && (
        <Dialog title="Тема застосунку" close={() => setScreen(null)}>
          <div className="theme-options" role="group" aria-label="Вибір теми">
            {[
              {
                id: "auto",
                icon: <Clock3 size={21} />,
                label: "Автоматично",
                hint: "Світла 07:00–21:00 · темна 21:00–07:00",
              },
              { id: "day", icon: <Sun size={21} />, label: "Завжди світла" },
              { id: "night", icon: <Moon size={21} />, label: "Завжди темна" },
            ].map((option) => (
              <button
                key={option.id}
                aria-pressed={themePreference === option.id}
                onClick={() => {
                  setThemePreference(option.id);
                  setScreen(null);
                }}
              >
                {option.icon}
                <span>
                  <strong>{option.label}</strong>
                  {option.hint && <small>{option.hint}</small>}
                </span>
              </button>
            ))}
          </div>
          <p className="field-help">За місцевим часом цього пристрою.</p>
        </Dialog>
      )}
      {screen === "create" && (
        <CreateFamily
          close={() => setScreen(null)}
          onCreated={(entry) => {
            saveConnection(entry);
            setCardOrigin("home");
            setScreen("card");
          }}
        />
      )}
      {screen === "join" && (
        <JoinFamily
          close={() => {
            setScreen(null);
            setStartup("");
          }}
          initialCode={initialCode}
          initialError={startup}
          onConnected={(entry) => {
            saveConnection(entry);
            setStartup("");
          }}
        />
      )}
      {screen === "card" && active && (
        <AccessCard
          entry={active}
          close={() => setScreen(cardOrigin === "manage" ? "manage" : null)}
        />
      )}
      {screen === "families" && (
        <Dialog
          title={connections.length === 1 ? "Моя родина 🏡" : "Мої родини 🏡"}
          close={() => setScreen(null)}
          className="family-dialog"
        >
          <p className="modal-description">
            Родини збережені на цьому пристрої. На новому введіть коди знову.
          </p>
          <div className="family-list">
            {connections.map((c) => (
              <div
                className={`family-list-item ${c.family.id === activeId && !demo ? "current" : ""}`}
                key={c.family.id}
              >
                <button className="family-select" onClick={() => select(c)}>
                  {c.children.length ? (
                    <FamilyEmojis children={c.children} />
                  ) : (
                    <span aria-hidden="true">🏡</span>
                  )}
                  <div>
                    <strong>{c.family.name}</strong>
                    <small>
                      {ROLE_NAMES[c.role]}
                      {c.family.archived ? " · Архів" : ""}
                    </small>
                  </div>
                  <ChevronDown size={17} />
                </button>
                <div className="family-item-actions">
                  <button
                    className="text-button"
                    onClick={() => {
                      select(c);
                      setScreen("manage");
                    }}
                  >
                    Відкрити налаштування
                  </button>
                  <ForgetButton
                    name={c.family.name}
                    onConfirm={() => forget(c)}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="family-add-actions">
            <button className="secondary" onClick={() => setScreen("create")}>
              <Plus size={17} /> Створити родину
            </button>
            <button
              className="secondary"
              onClick={() => {
                setInitialCode("");
                setScreen("join");
              }}
            >
              🔑 Маю код
            </button>
          </div>
          <button
            className="text-button demo-link"
            onClick={() => {
              setDemo(true);
              setScreen(null);
            }}
          >
            🌱 Спробувати демо
          </button>
        </Dialog>
      )}
      {screen === "manage" && active && (
        <ManageFamily
          key={`${active.family.id}:${active.revision}`}
          entry={active}
          close={() => setScreen("families")}
          update={(entry) => {
            saveConnection(entry);
            setScreen("manage");
          }}
          onCard={() => {
            setCardOrigin("manage");
            setScreen("card");
          }}
        />
      )}
    </>
  );
}

function ForgetButton({ name, onConfirm }) {
  const [confirm, setConfirm] = useState(false);
  return confirm ? (
    <div className="forget-confirm">
      <span>
        Прибрати «{name}» лише з цього пристрою? Повернутись можна за кодом.
      </span>
      <div className="confirmation-actions">
        <button type="button" className="danger-button" onClick={onConfirm}>
          Прибрати
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => setConfirm(false)}
        >
          Скасувати
        </button>
      </div>
    </div>
  ) : (
    <button className="text-button" onClick={() => setConfirm(true)}>
      Прибрати з пристрою
    </button>
  );
}
function ChildFields({ child, onChange, prefix }) {
  return (
    <div className={`child-fields ${child.color}`}>
      <label className="field-label" htmlFor={`${prefix}-name`}>
        Ім’я дитини
      </label>
      <input
        id={`${prefix}-name`}
        required
        maxLength={60}
        value={child.name}
        onChange={(e) => onChange({ ...child, name: e.target.value })}
        placeholder="Наприклад, Леон"
      />
      <div className="field-label" id={`${prefix}-emoji-label`}>
        Емодзі
      </div>
      <div
        className="emoji-picker"
        role="group"
        aria-labelledby={`${prefix}-emoji-label`}
      >
        {EMOJIS.map((emoji) => (
          <button
            type="button"
            aria-label={`Емодзі ${emoji}`}
            aria-pressed={child.emoji === emoji}
            key={emoji}
            onClick={() => onChange({ ...child, emoji })}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="field-label" id={`${prefix}-color-label`}>
        Колір
      </div>
      <div
        className="palette-picker"
        role="group"
        aria-labelledby={`${prefix}-color-label`}
      >
        {PALETTES.map((c) => (
          <button
            type="button"
            key={c.id}
            className={c.id}
            aria-pressed={child.color === c.id}
            onClick={() => onChange({ ...child, color: c.id })}
          >
            <i />
            {c.name}
          </button>
        ))}
      </div>
      <div className={`child-mini ${child.color}`}>
        <span>{child.emoji}</span>
        <strong>{child.name.trim() || "Ваш малюк"}</strong>
      </div>
    </div>
  );
}
function CreateFamily({ close, onCreated }) {
  const [step, setStep] = useState(1),
    [name, setName] = useState(""),
    [children, setChildren] = useState([emptyChild()]);
  const [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [created, setCreated] = useState(null);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (step < 3) {
      setStep(step + 1);
      return;
    }
    if (!ack) return;
    setBusy(true);
    setError("");
    try {
      const entry = await api("/families", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          children,
          offset: -new Date().getTimezoneOffset() / 60,
        }),
      });
      setCreated(entry);
      onCreated(entry);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Нова родина 🏡"
      close={() => {
        if (!busy && !created) close();
      }}
      className="family-dialog"
    >
      <form onSubmit={submit}>
        <div className="wizard-progress" aria-label={`Крок ${step} з 3`}>
          {["Родина", "Малеча", "Доступ"].map((s, i) => (
            <span key={s} className={i + 1 <= step ? "current" : ""}>
              {i + 1} · {s}
            </span>
          ))}
        </div>
        {step === 1 && (
          <>
            <h3 id="new-family-title">Як назвете вашу родину?</h3>
            <input
              id="new-family-name"
              aria-labelledby="new-family-title"
              className="family-name-input"
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Наприклад, Онуки у Львові"
              autoFocus
            />
            <p className="field-help">Назву можна змінити пізніше.</p>
          </>
        )}
        {step === 2 && (
          <>
            <h3>Познайомимось із малечею 👶</h3>
            {children.map((c, i) => (
              <div className="wizard-child" key={i}>
                <ChildFields
                  child={c}
                  prefix={`new-child-${i}`}
                  onChange={(value) =>
                    setChildren(children.map((x, j) => (i === j ? value : x)))
                  }
                />
                {children.length > 1 && (
                  <button
                    type="button"
                    className="text-button"
                    onClick={() =>
                      setChildren(children.filter((_, j) => i !== j))
                    }
                  >
                    Прибрати цю дитину
                  </button>
                )}
              </div>
            ))}
            <button
              className="text-button add-child"
              type="button"
              disabled={children.length >= 12}
              onClick={() => setChildren([...children, emptyChild()])}
            >
              <Plus size={17} /> Ще одна дитина
            </button>
            <p className="field-help">
              Можна почати з однієї дитини й додати решту пізніше.
            </p>
          </>
        )}
        {step === 3 && (
          <>
            <h3>Код — ваш вхід до родини</h3>
            <div className="role-explainer">
              <p>
                🔑 <b>Для вас</b> — змінюйте родину, додавайте дітей і ведіть
                годування.
              </p>
              <p>
                🍼 <b>Для близьких</b> — записуйте годування, виправляйте й
                видаляйте помилкові записи.
              </p>
              <p>
                👀 <b>Для спостереження</b> — дивіться годування й статистику,
                нічого не змінюючи.
              </p>
            </div>
            <p className="access-warning">
              Збережіть свій код, а іншими поділіться з тими, кому довіряєте 🤍
              Коди діють завжди — замінити їх або забрати доступ за ними не
              вийде.
            </p>
            <label className="acknowledgement">
              <input
                type="checkbox"
                required
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
              />
              <span>
                Розумію: якщо коди будуть втрачені й не залишиться підключених
                пристроїв, повернути дані цієї родини буде неможливо.
              </span>
            </label>
          </>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="wizard-actions">
          {step > 1 && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => setStep(step - 1)}
            >
              Назад
            </button>
          )}
          <button
            className="primary"
            disabled={
              busy ||
              (step === 1 && !name.trim()) ||
              (step === 2 && !children.every(validChild)) ||
              (step === 3 && !ack)
            }
          >
            {busy ? "Створюємо…" : step === 3 ? "Створити родину" : "Далі"}
            <ArrowRight size={17} />
          </button>
        </div>
      </form>
    </Dialog>
  );
}
function JoinFamily({ close, onConnected, initialCode, initialError }) {
  const [code, setCode] = useState(initialCode),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(initialError || "");
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      onConnected(
        await api("/sessions", {
          method: "POST",
          body: JSON.stringify({ code: code.trim() }),
        }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Маю код 🔑"
      close={() => {
        if (!busy) close();
      }}
    >
      <form onSubmit={submit}>
        <label className="field-label" htmlFor="join-code">
          Код родини
        </label>
        <input
          id="join-code"
          required
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Вставте сюди"
          maxLength={200}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy || !code.trim()}>
          {busy ? "Підключаємо…" : "Підключити родину"}
          <ArrowRight size={17} />
        </button>
      </form>
    </Dialog>
  );
}

function accessSvg(entry, roles) {
  const escape = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c],
    );
  const chunks = (value, size) =>
    Array.from({ length: Math.ceil(Array.from(value).length / size) }, (_, i) =>
      Array.from(value)
        .slice(i * size, (i + 1) * size)
        .join(""),
    );
  const titleLines = chunks(entry.family.name, 38);
  const header = 125 + (titleLines.length - 1) * 32;
  let top = header;
  const cards = roles
    .map((role) => {
      const lines = chunks(entry.codes[role], 48);
      const height = Math.max(130, 74 + lines.length * 27);
      const svg = `<rect x="30" y="${top}" width="740" height="${height}" rx="18" fill="${role === "owner" ? "#ecdfcc" : "#e1ead8"}"/><text x="50" y="${top + 36}" font-family="sans-serif" font-size="23" fill="#304238">${escape(ROLE_NAMES[role])}</text>${lines.map((line, i) => `<text x="50" y="${top + 78 + i * 27}" font-family="monospace" font-size="21" fill="#304238">${escape(line)}</text>`).join("")}`;
      top += height + 20;
      return svg;
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${top + 70}" viewBox="0 0 800 ${top + 70}"><rect width="100%" height="100%" rx="28" fill="#f6f5ed"/>${titleLines.map((line, i) => `<text x="40" y="${50 + i * 32}" font-family="sans-serif" font-size="26" fill="#304238">${i === 0 ? "am-am · " : ""}${escape(line)}</text>`).join("")}<text x="40" y="${header - 23}" font-family="sans-serif" font-size="20" fill="#586a53">Картка доступу · зберігайте приватно</text>${cards}<text x="40" y="${top + 35}" font-family="sans-serif" font-size="17" fill="#586a53">Коди безстрокові. Не публікуйте картку та код власника.</text></svg>`;
}
function AccessCard({ entry, close }) {
  const [message, setMessage] = useState("");
  async function copy(role, link = false) {
    try {
      const value = link ? inviteLink(entry.codes[role]) : entry.codes[role];
      await copyText(value);
      setMessage(link ? "Посилання скопійовано" : "Код скопійовано");
    } catch (e) {
      setMessage(e.message);
    }
  }
  async function share(role) {
    try {
      const url = inviteLink(entry.codes[role]);
      if (navigator.share) {
        await navigator.share({
          title: `am-am · ${entry.family.name}`,
          text: `${ROLE_NAMES[role]} · ${entry.family.name}`,
          url,
        });
      } else await copy(role, true);
    } catch (e) {
      if (e.name !== "AbortError")
        setMessage("Скористайтесь копіюванням коду.");
    }
  }
  return (
    <Dialog title="Картка доступу 🔑" close={close} className="family-dialog">
      <p className="modal-description">
        {entry.family.name} · Збережіть ці коди 🤍 Кожен із них працює на
        кількох пристроях без обмеження строку.
      </p>
      {!entry.codes ? (
        <p className="access-warning">
          Для картки з усіма кодами ввійдіть кодом власника.
        </p>
      ) : (
        <>
          {["owner", "editor", "viewer"].map((role) => (
            <section className={`access-code ${role}`} key={role}>
              <h3>
                {role === "owner" ? "🔑" : role === "editor" ? "🍼" : "👀"}{" "}
                {ROLE_NAMES[role]}
              </h3>
              <input
                aria-label={`Код: ${ROLE_NAMES[role]}`}
                readOnly
                value={entry.codes[role]}
                onFocus={(e) => e.target.select()}
              />
              <div className="access-code-actions">
                <button className="text-button" onClick={() => copy(role)}>
                  Копіювати код
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    download(
                      `amam-${role}.svg`,
                      accessSvg(entry, [role]),
                      "image/svg+xml;charset=utf-8",
                    )
                  }
                >
                  Зберегти картку
                </button>
                {role !== "owner" && (
                  <button className="text-button" onClick={() => share(role)}>
                    Поділитися ↗
                  </button>
                )}
              </div>
            </section>
          ))}
          <button
            className="primary"
            onClick={() =>
              download(
                "amam-access-private.svg",
                accessSvg(entry, ["owner", "editor", "viewer"]),
                "image/svg+xml;charset=utf-8",
              )
            }
          >
            ↓ Зберегти всі коди
          </button>
          <p className="field-help">
            Картку з усіма кодами залиште тільки для себе 🤍
          </p>
        </>
      )}
      {message && (
        <p className="copy-message" role="status">
          {message}
        </p>
      )}
    </Dialog>
  );
}
function ManageFamily({ entry, close, update, onCard }) {
  const [name, setName] = useState(entry.family.name),
    [offset, setOffset] = useState(entry.family.offset);
  const [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmArchive, setConfirmArchive] = useState(false),
    [importing, setImporting] = useState(false);
  const owner = entry.role === "owner";
  async function run(fn) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    const me = await api("/family", {}, entry.token);
    update({ ...entry, ...me });
  }
  function saveFamily(archived = entry.family.archived) {
    run(async () => {
      await api(
        "/family",
        { method: "PUT", body: JSON.stringify({ name, offset, archived }) },
        entry.token,
      );
      await refresh();
    });
  }
  if (importing)
    return (
      <ImportCsv
        entry={entry}
        close={() => setImporting(false)}
        onImported={refresh}
      />
    );
  if (editing)
    return (
      <Dialog
        title={editing.id ? "Редагувати дитину" : "Додати дитину 👶"}
        close={() => {
          if (!busy) setEditing(null);
        }}
        className="family-dialog"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await api(
                editing.id ? `/children/${editing.id}` : "/children",
                {
                  method: editing.id ? "PUT" : "POST",
                  body: JSON.stringify(editing),
                },
                entry.token,
              );
              await refresh();
            });
          }}
        >
          <ChildFields
            child={editing}
            onChange={setEditing}
            prefix="edit-child"
          />
          {editing.id && (
            <label className="acknowledgement">
              <input
                type="checkbox"
                checked={editing.archived}
                onChange={(e) =>
                  setEditing({ ...editing, archived: e.target.checked })
                }
              />
              <span>В архіві: сховати з головної, залишити історію</span>
            </label>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy || !validChild(editing)}>
            {busy ? "Зберігаємо…" : "Зберегти"}
          </button>
        </form>
      </Dialog>
    );
  return (
    <Dialog
      title={entry.family.name}
      close={() => {
        if (!busy) close();
      }}
      className="family-dialog"
    >
      <p className="role-label">
        {ROLE_NAMES[entry.role]}
        {entry.family.archived ? " · Архів" : ""}
      </p>
      {owner ? (
        <>
          <label className="field-label" htmlFor="edit-family-name">
            Назва родини
          </label>
          <input
            id="edit-family-name"
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label className="field-label" htmlFor="family-offset">
            Часовий пояс родини
          </label>
          <select
            id="family-offset"
            value={offset}
            onChange={(e) => setOffset(Number(e.target.value))}
          >
            {[
              ...new Set([
                ...Array.from({ length: 27 }, (_, i) => i - 12),
                offset,
              ]),
            ]
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  UTC{n >= 0 ? "+" : ""}
                  {n}
                </option>
              ))}
          </select>
          <button
            className="primary"
            disabled={busy || !name.trim()}
            onClick={() => saveFamily()}
          >
            Зберегти назву й час
          </button>
        </>
      ) : (
        <p className="modal-description">
          {entry.role === "viewer"
            ? "Ви можете переглядати історію та статистику."
            : "Ви можете додавати, редагувати та відновлювати годування."}{" "}
          Родину й дітей змінює власник.
        </p>
      )}
      <div className="section-heading manage-child-heading">
        <h3>Діти</h3>
        {owner && !entry.family.archived && (
          <button
            className="text-button"
            onClick={() => setEditing(emptyChild())}
          >
            <Plus size={17} /> Додати
          </button>
        )}
      </div>
      <div className="manage-children">
        {entry.children.map((c) => (
          <div key={c.id} className={`manage-child ${c.color}`}>
            <span>{c.emoji}</span>
            <div>
              <strong>{c.name}</strong>
              {c.archived && <small>В архіві · історію збережено</small>}
            </div>
            {owner && !entry.family.archived && (
              <button className="text-button" onClick={() => setEditing(c)}>
                Змінити
              </button>
            )}
          </div>
        ))}
      </div>
      {owner && (
        <>
          <button className="secondary" disabled={busy} onClick={onCard}>
            🔑 Коди та спільний доступ
          </button>
          {!entry.family.archived && (
            <button
              className="secondary import-open"
              onClick={() => setImporting(true)}
            >
              ↑ Імпортувати CSV
            </button>
          )}
          {!confirmArchive ? (
            <button
              className="text-button archive-family"
              onClick={() => setConfirmArchive(true)}
            >
              {entry.family.archived
                ? "Відновити родину з архіву"
                : "Архівувати родину"}
            </button>
          ) : (
            <div className="archive-confirm">
              <p>
                {entry.family.archived
                  ? "Повернути можливість вносити дані?"
                  : "Родина залишиться доступною для перегляду. Записи та коди збережуться; власник зможе відновити родину."}
              </p>
              <div className="confirmation-actions">
                <button
                  type="button"
                  className="primary"
                  disabled={busy}
                  onClick={() => saveFamily(!entry.family.archived)}
                >
                  Підтвердити
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => setConfirmArchive(false)}
                >
                  Скасувати
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}

function ImportCsv({ entry, close, onImported }) {
  const [rows, setRows] = useState([]),
    [mapping, setMapping] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState(null);
  const kids = entry.children.filter((c) => !c.archived);
  const sources = [
    ...new Map(rows.map((r) => [r.sourceChildId, r.childName])).entries(),
  ];
  async function fileChange(e) {
    setError("");
    setRows([]);
    setResult(null);
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 1024 * 1024) throw new Error("Максимум 1 МБ.");
      const parsed = parseCsv(await file.text());
      setRows(parsed);
      setMapping(
        Object.fromEntries(
          parsed.map((r) => [
            r.sourceChildId,
            kids.find((c) => c.id === r.sourceChildId)?.id ||
              kids.find((c) => c.name === r.childName)?.id ||
              "",
          ]),
        ),
      );
    } catch (e) {
      setError(e.message);
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const value = await api(
        "/feedings/import",
        {
          method: "POST",
          body: JSON.stringify({
            items: rows.map((r) => ({
              ...r,
              childId: mapping[r.sourceChildId],
            })),
          }),
        },
        entry.token,
      );
      setResult(value);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      title="Імпорт CSV ↑"
      close={() => {
        if (!busy) {
          if (result) onImported();
          else close();
        }
      }}
      className="family-dialog"
    >
      <p className="modal-description">
        Копія годувань у «{entry.family.name}». Файл не дає доступу до старої
        родини. Наявні записи не перезаписуються.
      </p>
      {result ? (
        <>
          <div className="connected-box">
            Додано: {result.imported}. Уже наявні: {result.skipped}.
          </div>
          <button className="primary" onClick={onImported}>
            Готово
          </button>
        </>
      ) : (
        <form onSubmit={submit}>
          <label className="field-label" htmlFor="csv-file">
            CSV, експортований із am-am · до 500 записів
          </label>
          <input
            id="csv-file"
            type="file"
            accept=".csv,text/csv"
            disabled={busy}
            onChange={fileChange}
          />
          {rows.length > 0 && (
            <>
              <p className="field-help">
                Знайдено записів: {rows.length}. Звірте відповідність дітей:
              </p>
              {sources.map(([id, name]) => (
                <label className="csv-mapping" key={id}>
                  <span>{name || id}</span>
                  <select
                    required
                    value={mapping[id] || ""}
                    disabled={busy}
                    onChange={(e) =>
                      setMapping({ ...mapping, [id]: e.target.value })
                    }
                  >
                    <option value="">Оберіть дитину</option>
                    {kids.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
              <p className="field-help">
                Час зберігається в UTC. Повторний імпорт того самого файлу не
                створить дублів.
              </p>
              <button
                className="primary"
                disabled={busy || sources.some(([id]) => !mapping[id])}
              >
                {busy ? "Імпортуємо…" : `Імпортувати · ${rows.length}`}
              </button>
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </form>
      )}
    </Dialog>
  );
}
