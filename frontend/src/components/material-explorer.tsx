"use client";
import { useState } from "react";
import { materials } from "@/data/content";
import { MaterialArt } from "./material-art";

export function MaterialExplorer() {
  const [index, setIndex] = useState(0);
  const material = materials[index];
  return (
    <div className="material-explorer">
      <div
        className="material-selector"
        role="group"
        aria-label="Seleccionar un material para aprender"
      >
        {materials.map((item, i) => (
          <button
            key={item.id}
            aria-pressed={i === index}
            aria-controls="material-detail"
            onClick={() => setIndex(i)}
          >
            {item.name}
          </button>
        ))}
      </div>
      <div
        id="material-detail"
        className="material-detail"
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="material-visual">
          <span className="mono">{material.code}</span>
          <MaterialArt key={material.id} material={material.id} />
          <span className="material-visual-caption">
            GUÍA DE MATERIALES / {String(index + 1).padStart(2, "0")}
          </span>
        </div>
        <div className="material-copy">
          <span className="eyebrow">CONOCE EL MATERIAL</span>
          <h3>{material.example}</h3>
          <p>{material.detail}</p>
          <ol>
            {material.steps.map((step, i) => (
              <li key={step}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {step}
              </li>
            ))}
          </ol>
          <p className="material-note">{material.note}</p>
        </div>
      </div>
      <p className="explorer-footnote">
        Guía introductoria. Confirma siempre las reglas del centro de acopio de
        tu comunidad.
      </p>
    </div>
  );
}
