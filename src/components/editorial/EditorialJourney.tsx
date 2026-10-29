import { useRef, useState, type CSSProperties, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "@phosphor-icons/react";
import { motion, useMotionValueEvent, useScroll, useTransform } from "motion/react";
import { TandemBike } from "@/components/brand/TandemBike";
import { editorialThumbnailSrc } from "@/content/editorialMedia";
import { HOME_JOURNEY_STORIES, type HomeJourneyStory } from "@/content/homeJourney";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useReducedMotionPreference } from "@/hooks/useReducedMotionPreference";
import { cn } from "@/lib/cn";
import { usePreferencesStore } from "@/store/preferencesStore";

const stepLabel = (index: number): string => String(index + 1).padStart(2, "0");

const Story = ({ story, active, staticMode }: { readonly story: HomeJourneyStory; readonly active: boolean; readonly staticMode: boolean }): ReactElement => (
  <motion.article
    className={cn("home-journey__story", active && "is-active")}
    aria-hidden={!staticMode && !active}
    initial={false}
    animate={staticMode ? { opacity: 1, y: 0 } : { opacity: active ? 1 : 0, y: active ? 0 : 22 }}
    transition={{ duration: staticMode ? 0 : 0.32, ease: "easeOut" }}
  >
    <img src={story.photo.src} srcSet={story.photo.width ? `${editorialThumbnailSrc(story.photo)} 640w, ${story.photo.src} ${story.photo.width}w` : undefined} sizes="(max-width: 48rem) 100vw, 50vw" alt={story.photo.alt} loading="lazy" decoding="async" width={1000} height={800} style={{ objectPosition: story.photo.objectPosition }} />
    <div className="home-journey__story-copy">
      <h3>{story.title}</h3>
      <p>{story.description}</p>
      <Link to={`/explore?cause=${story.cause}`} tabIndex={!staticMode && !active ? -1 : undefined}>
        {story.linkLabel} <ArrowUpRight aria-hidden="true" size={19} />
      </Link>
    </div>
  </motion.article>
);

/** A sticky visual sequence. Scrolling stays native; the stage releases after the last story. */
export const EditorialJourney = (): ReactElement => {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const reducedMotion = useReducedMotionPreference();
  const textSize = usePreferencesStore((state) => state.textSize);
  const shortViewport = useMediaQuery("(max-height: 42rem)");
  const staticMode = reducedMotion || textSize === "150" || shortViewport;
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end end"] });
  const bikeX = useTransform(scrollYProgress, [0, 1], ["0%", "60%"]);
  const wheelTurn = useTransform(scrollYProgress, [0, 1], [0, 1080]);

  useMotionValueEvent(scrollYProgress, "change", (progress) => {
    if (!staticMode) setActiveIndex(Math.min(HOME_JOURNEY_STORIES.length - 1, Math.floor(progress * HOME_JOURNEY_STORIES.length)));
  });

  const showStory = (index: number): void => {
    const section = sectionRef.current;
    if (!section) return;
    const top = section.getBoundingClientRect().top + window.scrollY;
    const travel = Math.max(0, section.offsetHeight - window.innerHeight);
    window.scrollTo({ top: top + travel * ((index + 0.5) / HOME_JOURNEY_STORIES.length), behavior: "smooth" });
  };

  return (
    <section
      ref={sectionRef}
      aria-labelledby="journey-title"
      className={cn("home-journey", staticMode && "home-journey--static")}
      style={{ "--journey-stops": HOME_JOURNEY_STORIES.length } as CSSProperties}
    >
      <div className="home-journey__stage">
        <div className="home-journey__inner">
          <div className="home-journey__information">
            <h2 id="journey-title" className="sr-only">In action</h2>
            <div className="home-journey__stories">
              {HOME_JOURNEY_STORIES.map((story, index) => <Story key={story.cause} story={story} active={index === activeIndex} staticMode={staticMode} />)}
            </div>
            {!staticMode ? (
              <nav aria-label="Story steps" className="home-journey__steps">
                {HOME_JOURNEY_STORIES.map((story, index) => (
                  <button key={story.cause} type="button" onClick={() => showStory(index)} aria-label={`Show ${story.title}`} aria-current={index === activeIndex ? "step" : undefined}>
                    {stepLabel(index)}
                  </button>
                ))}
              </nav>
            ) : null}
          </div>
          <div className="home-journey__ride" aria-hidden="true">
            <div className="home-journey__road" />
            <motion.div className="home-journey__bike" style={staticMode ? undefined : { x: bikeX }}>
              <TandemBike wheelTurn={staticMode ? undefined : wheelTurn} />
            </motion.div>
          </div>
        </div>
      </div>
      {!staticMode ? <p className="sr-only" aria-live="polite">Showing {HOME_JOURNEY_STORIES[activeIndex]?.title}, {activeIndex + 1} of {HOME_JOURNEY_STORIES.length}</p> : null}
    </section>
  );
};
