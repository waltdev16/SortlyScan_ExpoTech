import { MaterialArt } from "./material-art";
export function DevicePreview() {
  return (
    <div
      className="device-scene"
      aria-label="Concepto visual de SortlyScan Vision en una tableta. Ejemplo ilustrativo, sin reconocimiento activo."
    >
      <div className="orbit orbit-one" aria-hidden="true" />
      <div className="orbit orbit-two" aria-hidden="true" />
      <div className="tablet">
        <div className="tablet-camera" />
        <div className="tablet-screen">
          <div className="tablet-top">
            <span>
              SortlyScan <b>Vision</b>
            </span>
            <span className="demo-chip">DEMO VISUAL</span>
          </div>
          <div className="viewfinder">
            <span className="corner tl" />
            <span className="corner tr" />
            <span className="corner bl" />
            <span className="corner br" />
            <MaterialArt />
            <div className="scan-line" />
          </div>
          <div className="tablet-result">
            <div>
              <span className="mono">EJEMPLO EDUCATIVO</span>
              <strong>Botella de plástico</strong>
            </div>
            <span className="material-code">PET</span>
          </div>
          <div className="tablet-bottom">
            <span>Separa. Aprende. Transforma.</span>
            <span>01 / 06</span>
          </div>
        </div>
      </div>
      <div className="device-caption">
        <span className="status-dot" /> Tu dispositivo. Un nuevo propósito.
      </div>
    </div>
  );
}
