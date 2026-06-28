"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import styles from "./WelcomeModal.module.css";

type Step = {
  img: string;
  titleKey: string;
  titleEs: string;
  bodyKey: string;
  bodyEs: string;
};

const STEPS: Step[] = [
  {
    img: "/tutorial/01-bienvenida.webp",
    titleKey: "welcome.s1.title",
    titleEs: "Un lienzo de todos",
    bodyKey: "welcome.s1.body",
    bodyEs:
      "¡Bienvenido a Webpix! Aquí tienes un lienzo de 1000×1000 píxeles en el que lo que pintas lo ve todo el mundo al instante.",
  },
  {
    img: "/tutorial/02-herramientas.webp",
    titleKey: "welcome.s2.title",
    titleEs: "Herramientas",
    bodyKey: "welcome.s2.body",
    bodyEs:
      "Esta es tu caja de herramientas: con ella podrás pintar, borrar, publicar, rentar/gestionar espacios privados y reportar zonas con contenido inapropiado. Además puedes moverla a cualquier parte de la pantalla.",
  },
  {
    img: "/tutorial/03-pintar.webp",
    titleKey: "welcome.s3.title",
    titleEs: "Pintar",
    bodyKey: "welcome.s3.body",
    bodyEs:
      "La herramienta pintar te permite crear tus creaciones, punto por punto o con el pintado rápido dejando presionado el clic (o arrastrando el dedo en celular).",
  },
  {
    img: "/tutorial/04-borrar.webp",
    titleKey: "welcome.s4.title",
    titleEs: "Borrar",
    bodyKey: "welcome.s4.body",
    bodyEs:
      "El borrador te permite quitar tus propios píxeles por si cometiste un error, uno por uno o seleccionando un área.",
  },
  {
    img: "/tutorial/05-publicar.webp",
    titleKey: "welcome.s5.title",
    titleEs: "Publicar",
    bodyKey: "welcome.s5.body",
    bodyEs:
      "La herramienta publicar te permite seleccionar un área y publicarla en tu perfil para que otros la vean, le den like y comenten.",
  },
  {
    img: "/tutorial/06-privados.webp",
    titleKey: "welcome.s6.title",
    titleEs: "Espacios privados",
    bodyKey: "welcome.s6.body",
    bodyEs:
      "¿Quieres una zona solo para ti o tus amigos? Renta mensualmente un espacio privado con Bits y decide quién puede pintar ahí. Puedes tener hasta 3 espacios privados a la vez.",
  },
  {
    img: "/tutorial/07-reportar.webp",
    titleKey: "welcome.s7.title",
    titleEs: "Reportar",
    bodyKey: "welcome.s7.body",
    bodyEs:
      "Si ves contenido inapropiado, repórtalo usando la herramienta dedicada y seleccionando la zona. Las normas completas están en el apartado de Comunidad.",
  },
  {
    img: "/tutorial/08-contador.webp",
    titleKey: "welcome.s8.title",
    titleEs: "Contador de píxeles",
    bodyKey: "welcome.s8.body",
    bodyEs:
      "Arriba a la izquierda tienes el contador de píxeles: al pintar disminuye y al borrar te devuelve los píxeles borrados, siempre que no estés en cooldown.",
  },
  {
    img: "/tutorial/09-candado.webp",
    titleKey: "welcome.s9.title",
    titleEs: "Candado",
    bodyKey: "welcome.s9.body",
    bodyEs:
      "En celular tendrás este botón de candado: sirve para bloquear el movimiento de la pantalla y poder pintar rápido o usar las herramientas de selección.",
  },
  {
    img: "/tutorial/10-panel.webp",
    titleKey: "welcome.s10.title",
    titleEs: "Panel lateral",
    bodyKey: "welcome.s10.body",
    bodyEs:
      "A tu derecha tienes los botones del panel lateral: desde aquí accedes a tu perfil, configuración, logros, tareas semanales, la Comunidad, la tienda o reportar bugs.",
  },
  {
    img: "/tutorial/11-perfil.webp",
    titleKey: "welcome.s11.title",
    titleEs: "Perfil",
    bodyKey: "welcome.s11.body",
    bodyEs:
      "Aquí puedes revisar tu perfil, editarlo, ver tus publicaciones y equipar los cosméticos obtenidos.",
  },
  {
    img: "/tutorial/12-rankings.webp",
    titleKey: "welcome.s12.title",
    titleEs: "Rankings",
    bodyKey: "welcome.s12.body",
    bodyEs:
      "En la pestaña de rankings ves los rankings globales y por país, por píxeles pintados y por publicaciones creadas. Al final de cada mes se reparten recompensas.",
  },
  {
    img: "/tutorial/13-amigos.webp",
    titleKey: "welcome.s13.title",
    titleEs: "Amigos",
    bodyKey: "welcome.s13.body",
    bodyEs:
      "En la pestaña de amigos ves a tus amigos agregados, revisas las solicitudes enviadas y respondes las recibidas.",
  },
  {
    img: "/tutorial/14-bits.webp",
    titleKey: "welcome.s14.title",
    titleEs: "Bits",
    bodyKey: "welcome.s14.body",
    bodyEs:
      "Los Bits se obtienen subiendo de nivel, completando logros y tareas semanales, con los rankings y también desde la tienda.",
  },
  {
    img: "/tutorial/15-tienda.webp",
    titleKey: "welcome.s15.title",
    titleEs: "Tienda",
    bodyKey: "welcome.s15.body",
    bodyEs:
      "En la tienda obtienes cosméticos para tu perfil y colores más exóticos para pintar. Aquí mismo consigues Bits y las suscripciones mensuales.",
  },
  {
    img: "/tutorial/16-suscripciones.webp",
    titleKey: "welcome.s16.title",
    titleEs: "Tiers y suscripciones",
    bodyKey: "welcome.s16.body",
    bodyEs:
      "Desde la pestaña de suscripciones de la tienda puedes mejorar tu tier a Plus o Premium, cada uno con sus respectivos beneficios.",
  },
];

export default function WelcomeModal({
  isLoggedIn,
  onClose,
  onRegister,
}: {
  isLoggedIn: boolean;
  onClose: () => void;
  onRegister: () => void;
}) {
  const { t } = useTranslation();
  const [view, setView] = useState<"welcome" | "tour">("welcome");
  const [index, setIndex] = useState(0);

  const hasHook = !isLoggedIn; // diapositiva extra de registro para anónimos
  const total = STEPS.length + (hasHook ? 1 : 0);
  const onHook = hasHook && index === STEPS.length;
  const isLast = index === total - 1;

  const next = () => (index < total - 1 ? setIndex((i) => i + 1) : onClose());
  const prev = () => (index > 0 ? setIndex((i) => i - 1) : setView("welcome"));

  // Flechas del teclado (escritorio)
  useEffect(() => {
    if (view !== "tour") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, index, total]);

  // Swipe (celular)
  const touchX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    touchX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
  };

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true">
      <div className={styles.modal}>
        {view === "welcome" ? (
          <div className={styles.welcome}>
            <h1 className={styles.brandTitle}>WebPix</h1>
            <p className={styles.lead}>
              {t("welcome.lead", {
                defaultValue:
                  "¡Bienvenido a WebPix! Un lienzo de pixel-art donde miles de personas crean juntas, un píxel a la vez.",
              })}
            </p>
            <p className={styles.norms}>
              {t("welcome.norms", {
                defaultValue:
                  "Para que todos la pasen bien: nada de contenido inapropiado, ofensivo ni que dañe el trabajo de los demás. Puedes leer las normas completas en el apartado de Comunidad.",
              })}
            </p>
            <div className={styles.actions}>
              <button
                className={styles.primary}
                onClick={() => setView("tour")}
              >
                {t("welcome.startTour", { defaultValue: "Empezar recorrido" })}
              </button>
              <button className={styles.secondary} onClick={onClose}>
                {t("welcome.skipTour", { defaultValue: "Saltar recorrido" })}
              </button>
            </div>
          </div>
        ) : (
          <div
            className={styles.tour}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            <div className={styles.tourHeader}>
              <span className={styles.counter}>
                {index + 1} / {total}
              </span>
              <button className={styles.skipLink} onClick={onClose}>
                {t("welcome.skip", { defaultValue: "Saltar" })}
              </button>
            </div>
            <div className={styles.progress}>
              <div
                className={styles.progressFill}
                style={{ width: `${((index + 1) / total) * 100}%` }}
              />
            </div>

            <div className={styles.slide} key={index}>
              {onHook ? (
                <div className={styles.registerHook}>
                  <h2 className={styles.stepTitle}>
                    {t("welcome.hookTitle", { defaultValue: "Crea tu cuenta" })}
                  </h2>
                  <p>
                    {t("welcome.registerHook", {
                      defaultValue:
                        "Crea una cuenta gratis para acceder a la experiencia completa de Webpix.",
                    })}
                  </p>
                  <button className={styles.primary} onClick={onRegister}>
                    {t("welcome.register", { defaultValue: "Crear cuenta" })}
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.imgFrame}>
                    <img
                      src={STEPS[index].img}
                      alt=""
                      className={styles.img}
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  </div>
                  <h2 className={styles.stepTitle}>
                    {t(STEPS[index].titleKey, {
                      defaultValue: STEPS[index].titleEs,
                    })}
                  </h2>
                  <p className={styles.stepBody}>
                    {t(STEPS[index].bodyKey, {
                      defaultValue: STEPS[index].bodyEs,
                    })}
                  </p>
                </>
              )}
            </div>

            <div className={styles.footer}>
              <button className={styles.secondary} onClick={prev}>
                {t("common.back", { defaultValue: "Atrás" })}
              </button>
              <button className={styles.primary} onClick={next}>
                {isLast
                  ? t("welcome.done", { defaultValue: "¡Listo, a pintar!" })
                  : t("common.next", { defaultValue: "Siguiente" })}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
