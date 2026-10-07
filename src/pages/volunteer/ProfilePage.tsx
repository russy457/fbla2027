/**
 * ProfilePage.tsx
 * Route "/me/profile" (SPEC#screen-inventory "Profile", Tier 1): keep
 * details current. Name, interests, skills, availability, phone, and ZIP are
 * saved through volunteer.updateProfile (ProfileForm); display settings
 * (text size, contrast, motion) live in the page footer on every screen, so
 * this page links there; the Discoverable toggle is the secondary action.
 * Birth date is shown read-only (only an admin can correct it, SPEC 4.2).
 *
 * Links such as "/me/profile#interests" (Explore's "Add interests") and
 * "#zip" (the distance filter hint) move focus to that group once the page
 * has rendered, after the shell's own focus-the-h1 step (D20).
 */
import { useEffect, type ReactElement } from "react";
import { useLocation } from "react-router-dom";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { DiscoverableToggle } from "@/components/profile/DiscoverableToggle";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { usePrivateProfile } from "@/hooks/useVolunteerData";
import { useSessionUser } from "@/store/authStore";

/** Two frames: the app shell focuses the h1 one frame after navigation; this runs after it. */
const focusHashTarget = (hash: string): (() => void) => {
  let inner = 0;
  const outer = window.requestAnimationFrame(() => {
    inner = window.requestAnimationFrame(() => {
      const target = document.getElementById(hash.slice(1));
      target?.scrollIntoView({ block: "start" });
      target?.focus({ preventScroll: true });
    });
  });
  return () => {
    window.cancelAnimationFrame(outer);
    window.cancelAnimationFrame(inner);
  };
};

const ProfilePage = (): ReactElement => {
  const user = useSessionUser();
  const profile = usePrivateProfile(user?.uid ?? null);
  const { hash } = useLocation();
  const isReady = profile.data != null;

  useEffect(() => (isReady && hash.length > 1 ? focusHashTarget(hash) : undefined), [hash, isReady]);

  if (profile.error) return <ErrorState title="We couldn't load your profile" description="Check your connection, then reload the page." />;
  if (profile.isLoading || !user) return <LoadingState label="Loading your profile" />;
  if (!profile.data) return <ErrorState title="We couldn't find your profile" description="Finish onboarding first, then come back." />;
  const data = profile.data;

  return (
    <div className="flex flex-col gap-10">
      <PageHeader title="Profile">Keep your details current so Explore can suggest the right shifts.</PageHeader>
      {/* Starts from the stored profile; saves compare against the live one, so only real changes are sent. */}
      <ProfileForm profile={data} />

      <section aria-labelledby="profile-more" className="flex max-w-2xl flex-col gap-6 border-t border-border pt-8">
        <h2 id="profile-more" className="text-lg font-semibold text-fg">
          More settings
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-fg-muted">Birth date</dt>
          <dd className="font-mono text-fg">{data.birthDate}</dd>
          <dt className="text-fg-muted">Email</dt>
          <dd className="break-all text-fg">{data.email}</dd>
        </dl>
        <p className="text-sm text-fg-muted">To correct your birth date, ask an organization coordinator to contact an admin.</p>
        <DiscoverableToggle uid={user.uid} discoverable={data.notificationPrefs?.discoverable === true} />
        <p className="text-sm text-fg">
          Text size, contrast, and motion are under{" "}
          <a href="#display-preferences" className="font-semibold text-accent underline underline-offset-2">
            Display settings
          </a>{" "}
          at the bottom of every page.
        </p>
      </section>
    </div>
  );
};

export default ProfilePage;
