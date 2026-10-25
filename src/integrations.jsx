import React from "react";
import { ArrowUpRight, Asterisk, Flower2 } from "lucide-react";

// Curated content only. No ad SDK, tracking pixels, or access to feeding data.
// Set either placement to a campaign object when an integration is approved.
export const INTEGRATIONS = { hero: null, care: null };
export const REVIEW_INTEGRATIONS = {
  hero: {
    brand: "Ваш бренд",
    title: "Маленькі речі. Велика турбота.",
    description: "Місце для корисної рекомендації батькам.",
    cta: "Дізнатися більше",
  },
  care: {
    brand: "Ваш бренд",
    title: "Створено з турботою про малечу",
    description: "Ненав’язлива інтеграція у вашому щоденнику.",
    cta: "Переглянути",
  },
};

function AmbientArt() {
  return (
    <svg
      className="ambient-art"
      viewBox="0 0 640 160"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="ambient-wave"
        d="M-30 112C61 28 136 151 227 88S377 7 451 81 583 144 678 57"
        stroke="#ccd8bd"
        strokeWidth="1.2"
      />
      <path
        d="M-15 122C79 50 152 165 245 103S384 24 459 94 583 151 666 84"
        stroke="#e6dece"
        strokeWidth="1"
      />
      <ellipse
        cx="321"
        cy="91"
        rx="115"
        ry="54"
        stroke="#d7decc"
        strokeDasharray="2 7"
        transform="rotate(-13 321 91)"
      />
      <g className="ambient-orb ambient-orb--sage">
        <circle cx="281" cy="77" r="39" fill="#d9e4ce" />
        <circle cx="270" cy="65" r="16" fill="#e8efdf" />
        <path
          d="M262 97C273 109 295 110 309 91"
          stroke="#b5c69f"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </g>
      <g className="ambient-orb ambient-orb--peach">
        <circle cx="350" cy="99" r="31" fill="#edd8c8" />
        <circle cx="340" cy="89" r="12" fill="#f5e6d9" />
      </g>
      <g
        className="ambient-star"
        stroke="#a2b38a"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M196 45v18m-9-9h18m-15-6 12 12m0-12-12 12" />
        <path d="M438 109v12m-6-6h12" />
      </g>
      <circle cx="419" cy="40" r="4" fill="#d4c6a7" />
      <circle cx="157" cy="114" r="3" fill="#c7d5b6" />
      <circle cx="482" cy="63" r="2" fill="#c7d5b6" />
    </svg>
  );
}

function safeHref(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function IntegrationSlot({ placement, campaign, onPreview }) {
  if (!campaign) {
    if (placement === "care")
      return (
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
          <Asterisk
            className="note-flower"
            aria-hidden="true"
            strokeWidth={1.5}
          />
        </div>
      );
    return (
      <div className="ambient-panel" aria-hidden="true">
        <AmbientArt />
      </div>
    );
  }
  const href = safeHref(campaign.href);
  const label = (
    <>
      {campaign.cta || "Дізнатися більше"}
      <ArrowUpRight size={16} />
    </>
  );
  return (
    <section
      className={`integration integration--${placement}`}
      aria-label={`Реклама · ${campaign.brand}`}
    >
      <div className="integration-copy">
        <div className="integration-meta">
          <span>Реклама</span>
          <span>{campaign.brand}</span>
        </div>
        <h2>{campaign.title}</h2>
        <p>{campaign.description}</p>
        {href ? (
          <a
            className="integration-link"
            href={href}
            target="_blank"
            rel="sponsored noopener noreferrer"
            referrerPolicy="no-referrer"
          >
            {label}
          </a>
        ) : onPreview ? (
          <button
            className="integration-link"
            type="button"
            onClick={onPreview}
          >
            {label}
          </button>
        ) : null}
      </div>
      <div className="integration-illustration" aria-hidden="true">
        <div className="integration-petal" />
        <Flower2 strokeWidth={0.9} />
        <span />
      </div>
    </section>
  );
}
