"use client";
import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { roles } from "@/data/content";
export function RoleExplorer() {
  const [active, setActive] = useState(0);
  const role = roles[active];
  return (
    <div className="role-explorer">
      <div
        className="role-switch"
        role="group"
        aria-label="Explorar beneficios por rol"
      >
        {roles.map((item, index) => (
          <button
            key={item.name}
            aria-pressed={index === active}
            aria-controls="role-detail"
            onClick={() => setActive(index)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div
        className="role-detail"
        id="role-detail"
        aria-live="polite"
        aria-atomic="true"
      >
        <div>
          <h3>{role.title}</h3>
          <p>{role.text}</p>
          <ul>
            {role.items.map((item) => (
              <li key={item}>
                <ArrowUpRight size={16} aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="role-path">
          <p className="mono">{role.label}</p>
          {role.rows.map((row, index) => (
            <div className="role-path-row" key={row}>
              <span>0{index + 1}</span>
              <strong>{row}</strong>
            </div>
          ))}
          <p className="role-note">
            Paneles iniciales disponibles en esta versión; algunas funciones avanzadas siguen en desarrollo.
          </p>
        </div>
      </div>
    </div>
  );
}
