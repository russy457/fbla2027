/**
 * UnderAgeStop.tsx
 * Shown when the birth date means the person is under 13 (SPEC#minors G18,
 * D10). It stops onboarding with the SPEC's sentence and a kind pointer to a
 * parent or guardian. No account is created; nothing is saved.
 */
import { useEffect, useRef, type ReactElement } from "react";
import { Link } from "react-router-dom";
import { HandHeart } from "@phosphor-icons/react";
import { buttonClassName } from "@/components/ui/buttonStyles";

interface UnderAgeStopProps {
  readonly onChangeDate: () => void;
}

export const UnderAgeStop = ({ onChangeDate }: UnderAgeStopProps): ReactElement => {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  return (
    <section aria-labelledby="under-age-title" className="flex max-w-xl flex-col items-start gap-4">
      <HandHeart aria-hidden="true" size={40} className="text-accent" />
      <h1 id="under-age-title" ref={headingRef} tabIndex={-1} className="text-3xl font-semibold tracking-tight text-fg outline-none">
        You must be 13 or older to use this app
      </h1>
      <p className="text-lg text-fg">Ask a parent or guardian about volunteering together.</p>
      <p className="text-fg-muted">
        Many organizations welcome younger helpers when they come with a family member. We did not create an account or save your
        birth date.
      </p>
      <div className="flex flex-wrap gap-2">
        <Link to="/help/privacy-and-minors" className={buttonClassName("primary")}>
          Read about young volunteers
        </Link>
        <button type="button" onClick={onChangeDate} className={buttonClassName("quiet")}>
          I entered the wrong date
        </button>
      </div>
    </section>
  );
};
