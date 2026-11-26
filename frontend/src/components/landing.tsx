"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Menu, X, Plus } from "lucide-react";
import { navigation, faqs } from "@/data/content";
import { Reveal } from "./reveal";
import { DevicePreview } from "./device-preview";
import { MaterialExplorer } from "./material-explorer";
import { RoleExplorer } from "./role-explorer";
import { Dialog } from "./dialog";
import { InstitutionForm } from "./institution-form";

type Modal = "register" | "privacy" | null;
// 01. Landing
export default function Landing() {
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [activeSection, setActiveSection] = useState("inicio");
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id);
        });
      },
      { rootMargin: "-12% 0px -58% 0px" },
    );
    navigation.forEach((item) => {
      const node = document.querySelector(item.href);
      if (node) observer.observe(node);
    });
    return () => observer.disconnect();
  }, []);
  const open = (type: Modal) => {
    setMenu(false);
    setModal(type);
  };
  return (
    <>
      <header className="site-header">
        <a href="#inicio" className="brand" aria-label="SortlyScan, inicio">
          <Image
            src="/brand/logo-light-480.webp"
            width={480}
            height={149}
            alt="SortlyScan"
            priority
          />
        </a>
        <nav className="desktop-nav" aria-label="Navegación principal">
          {navigation.map((item) => (
            <a
              key={item.href}
              href={item.href}
              aria-current={
                activeSection === item.href.slice(1) ? "location" : undefined
              }
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          <Link className="login-link" href="/acceso">
            Explorar plataforma
          </Link>
          <Link className="button button-lime button-small" href="/acceso">
            Probar demostración <ArrowUpRight size={15} />
          </Link>
        </div>
        <button
          className="menu-toggle"
          aria-label={menu ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={menu}
          aria-controls="mobile-nav"
          onClick={() => setMenu(!menu)}
        >
          {menu ? <X /> : <Menu />}
        </button>
        {menu && (
          <nav
            id="mobile-nav"
            className="mobile-nav"
            aria-label="Navegación móvil"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setMenu(false);
                document
                  .querySelector<HTMLButtonElement>(".menu-toggle")
                  ?.focus();
              }
            }}
          >
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMenu(false)}
              >
                {item.label}
              </a>
            ))}
            <Link href="/acceso">Explorar plataforma</Link>
            <button type="button" className="mobile-nav-link" onClick={() => { setMenu(false); open("register"); }}>
              Solicitud institucional (ficticia)
            </button>
            <Link className="button button-lime" href="/acceso">
              Probar demostración
            </Link>
          </nav>
        )}
      </header>
      <main id="contenido">
        <section id="inicio" className="hero section-anchor">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="status-dot" /> EDUCACIÓN QUE TRANSFORMA
            </p>
            <h1>
              Aprender a<br />
              reciclar.
              <br />
              <span>
                Cambiar
                <br className="small-break" /> el futuro.
              </span>
            </h1>
            <p className="hero-description">
              SortlyScan transforma el reciclaje en una experiencia educativa
              mediante inteligencia artificial, aprendizaje interactivo y
              participación estudiantil.
            </p>
            <div className="hero-buttons">
              <a className="button button-dark" href="#aprendizaje">
                Comenzar ahora <ArrowUpRight size={19} />
              </a>
              <a className="text-button" href="#plataforma">
                Explorar plataforma <ArrowRight size={17} />
              </a>
            </div>
            <div className="hero-meta">
              <span>CREADO EN EL SALVADOR</span>
              <span>DISEÑADO PARA APRENDER</span>
            </div>
          </div>
          <DevicePreview />
        </section>
        <div className="principles-bar">
          <span>Una idea nacida para el aula.</span>
          <p>
            Educación ambiental <i /> Tecnología accesible <i /> Acción
            colectiva
          </p>
          <a href="#plataforma" aria-label="Conocer la plataforma">
            <ArrowRight size={20} />
          </a>
        </div>
        <section className="problem section-shell">
          <Reveal className="problem-heading">
            <p className="eyebrow">01 / EL PUNTO DE PARTIDA</p>
            <h2>
              El cambio empieza
              <br />
              antes del contenedor.
            </h2>
          </Reveal>
          <Reveal className="problem-copy">
            <p className="large-copy">
              Saber que reciclar importa
              <br />
              es solo el principio.
            </p>
            <p>
              La educación ambiental necesita pasar de la teoría a la práctica.
              Entender un material, saber cómo separarlo y repetir ese pequeño
              gesto hasta convertirlo en hábito.
            </p>
            <p className="underlined-note">
              Nuestra propuesta: llevar ese aprendizaje a cada aula.
            </p>
          </Reveal>
        </section>
        <section
          id="plataforma"
          className="platform section-anchor section-shell"
        >
          <Reveal>
            <div className="section-title">
              <div>
                <p className="eyebrow">02 / ASÍ LO IMAGINAMOS</p>
                <h2>
                  Un gesto pequeño.
                  <br />
                  <span>Un aprendizaje que queda.</span>
                </h2>
              </div>
              <p>
                Una experiencia pensada para conectar
                <br />
                lo que ves, lo que aprendes y lo que haces.
              </p>
            </div>
            <div className="steps">
              {[
                [
                  "01",
                  "Observa.",
                  "Acerca un residuo a la cámara de tu dispositivo. Vision está previsto para ayudarte a identificar el material.",
                  "RECONOCIMIENTO EN DESARROLLO",
                ],
                [
                  "02",
                  "Comprende.",
                  "Descubre por qué se clasifica así, cómo prepararlo y qué hacer antes de llevarlo a un punto de acopio.",
                  "GUÍAS POR MATERIAL",
                ],
                [
                  "03",
                  "Participa.",
                  "Lleva lo aprendido a tu comunidad con actividades, retos y metas compartidas en el aula.",
                  "GAMIFICACIÓN PREVISTA",
                ],
              ].map(([n, title, text, label]) => (
                <article className="step" key={n}>
                  <span className="step-number">{n}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  <span className="mono">{label}</span>
                </article>
              ))}
            </div>
          </Reveal>
        </section>
        <section className="vision section-shell">
          <Reveal className="vision-layout">
            <div className="vision-label">
              <span className="eyebrow">SORTLYSCAN VISION</span>
              <span className="outline-chip">EN DESARROLLO</span>
            </div>
            <div>
              <h2>
                La tecnología orienta.
                <br />
                El aprendizaje transforma.
              </h2>
              <p>
                Estamos preparando un reconocimiento especializado en residuos.
                Cuando una imagen no sea suficientemente clara, la respuesta
                correcta será «no identificado».
              </p>
            </div>
            <div className="vision-principles">
              <div>
                <span>01</span>
                <p>Confianza antes que una respuesta forzada.</p>
              </div>
              <div>
                <span>02</span>
                <p>Una explicación, además de una categoría.</p>
              </div>
              <div>
                <span>03</span>
                <p>Identificar un residuo no significa haberlo reciclado.</p>
              </div>
            </div>
          </Reveal>
        </section>
        <section id="aprendizaje" className="learning section-anchor">
          <div className="section-shell">
            <Reveal>
              <div className="section-title">
                <div>
                  <p className="eyebrow">03 / APRENDER PARA ACTUAR</p>
                  <h2>
                    Cada material
                    <br />
                    tiene su historia.
                  </h2>
                </div>
                <p>
                  Empieza por conocerlo.
                  <br />
                  Selecciona un material y descubre el siguiente paso.
                </p>
              </div>
              <MaterialExplorer />
            </Reveal>
          </div>
        </section>
        <section className="gamification section-shell">
          <Reveal className="gamification-layout">
            <div>
              <p className="eyebrow">EL HÁBITO ES EL VERDADERO LOGRO</p>
              <h2>
                Más que sumar puntos.
                <br />
                <span>Sumar buenas decisiones.</span>
              </h2>
              <p>
                Retos que invitan a colaborar, lecciones que despiertan
                curiosidad y logros que reconocen lo aprendido. Así queremos
                motivar la participación.
              </p>
              <a href="#instituciones" className="text-button">
                Conoce el recorrido educativo <ArrowRight size={18} />
              </a>
            </div>
            <div className="challenge-preview">
              <span className="mono">EJEMPLO DE RETO / SIN PUNTUACIÓN</span>
              <h3>
                Una semana.
                <br />
                Un hábito nuevo.
              </h3>
              <p>
                Elige un material, aprende a separarlo y comparte lo que
                descubriste con tu grupo.
              </p>
              <div className="challenge-timeline">
                <span>Explora</span>
                <i />
                <span>Practica</span>
                <i />
                <span>Comparte</span>
              </div>
              <div className="challenge-footer">
                <span>APRENDIZAJE COLECTIVO</span>
                <ArrowUpRight size={23} />
              </div>
            </div>
          </Reveal>
        </section>
        <section
          id="instituciones"
          className="institutions section-anchor section-shell"
        >
          <Reveal>
            <div className="section-title">
              <div>
                <p className="eyebrow">04 / TODA LA COMUNIDAD EDUCATIVA</p>
                <h2>
                  Un mismo propósito.
                  <br />
                  Distintas formas de aportar.
                </h2>
              </div>
              <p>
                Desde la primera pregunta del estudiante
                <br />
                hasta las decisiones de la dirección.
              </p>
            </div>
            <RoleExplorer />
            <Link href="/acceso" className="text-button role-demo-link">
              Explorar los paneles con perfiles ficticios <ArrowRight size={18} />
            </Link>
          </Reveal>
        </section>
        <section className="impact section-shell">
          <Reveal className="impact-layout">
            <div>
              <p className="eyebrow">IMPACTO CON SENTIDO</p>
              <h2>
                Lo que queremos
                <br />
                ver crecer.
              </h2>
              <p>
                El piloto buscará medir aprendizaje y participación. Los
                resultados ambientales necesitarán evidencia adicional.
              </p>
              <span className="outline-chip">
                OBJETIVOS, NO RESULTADOS ACTUALES
              </span>
            </div>
            <div className="impact-list">
              <article>
                <span>01</span>
                <div>
                  <h3>Conocimiento</h3>
                  <p>
                    Comparar la comprensión de los materiales antes y después de
                    las actividades.
                  </p>
                </div>
              </article>
              <article>
                <span>02</span>
                <div>
                  <h3>Participación</h3>
                  <p>
                    Observar la constancia y la colaboración de los grupos, sin
                    rankings públicos de menores.
                  </p>
                </div>
              </article>
              <article>
                <span>03</span>
                <div>
                  <h3>Hábitos sostenibles</h3>
                  <p>
                    Acompañar acciones verificadas por docentes. No convertir
                    escaneos en kilogramos reciclados.
                  </p>
                </div>
              </article>
            </div>
          </Reveal>
        </section>
        <section className="pilot section-shell" id="piloto">
          <Reveal className="pilot-inner">
            <div className="pilot-top">
              <p className="eyebrow">PROGRAMA PILOTO PROPUESTO</p>
              <span>ESCUELAS PÚBLICAS / EL SALVADOR</span>
            </div>
            <h2>
              El próximo cambio
              <br />
              puede empezar en tu escuela.
            </h2>
            <div className="pilot-bottom">
              <p>
                Queremos construirlo junto a docentes y comunidades.
                <br />
                Un piloto gratuito, con propósito y acompañamiento.
                <br />
                <small>
                  Fechas, centros participantes y condiciones por confirmar.
                </small>
              </p>
              <button
                className="button button-dark"
                onClick={() => open("register")}
              >
                Preparar solicitud <ArrowUpRight size={19} />
              </button>
            </div>
          </Reveal>
        </section>
        <section className="faq section-shell">
          <div>
            <p className="eyebrow">ANTES DE EMPEZAR</p>
            <h2>
              Preguntas
              <br />
              que importan.
            </h2>
          </div>
          <div className="faq-list">
            {faqs.map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q}
                  <Plus size={19} aria-hidden="true" />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <footer className="site-footer section-shell">
        <div className="footer-main">
          <a
            href="#inicio"
            className="brand"
            aria-label="SortlyScan, volver al inicio"
          >
            <Image
              src="/brand/logo-light-480.webp"
              width={480}
              height={149}
              alt="SortlyScan"
            />
          </a>
          <p>
            Aprender hoy.
            <br />
            Transformar el mañana.
          </p>
          <a className="footer-back" href="#inicio">
            Volver arriba <ArrowUpRight size={17} />
          </a>
        </div>
        <div className="footer-bottom">
          <span>© 2026 SortlyScan · Proyecto educativo · El Salvador</span>
          <div>
            <button onClick={() => open("privacy")}>Privacidad</button>
            <span>V2.0 / VISTA PREVIA</span>
          </div>
        </div>
      </footer>
      {modal && (
        <Dialog
          title={
            modal === "register"
              ? "El cambio empieza en tu escuela."
              : "Tu privacidad, desde el inicio."
          }
          onClose={() => setModal(null)}
        >
          {modal === "register" && <InstitutionForm />}
          {modal === "privacy" && (
            <>
              <p>
                Esta demostración no incluye analítica, cookies de seguimiento
                ni cuentas. Todo lo que haces se guarda solo en este navegador
                (almacenamiento local) con datos ficticios, y puedes borrarlo
                con «Restablecer demostración».
              </p>
              <p>
                La solicitud institucional de esta demostración es ficticia: se
                guarda en tu navegador y no se envía a SortlyScan. En la
                plataforma real, las cuentas de estudiantes las crea su docente
                con un nombre o seudónimo, sin correo personal.
              </p>
              <p>
                El escáner analiza la foto dentro de tu navegador y no la guarda
                ni la envía. La política de privacidad completa debe aprobarse
                antes del piloto con estudiantes reales.
              </p>
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
