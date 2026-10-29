/** Public display settings so reading controls remain available before sign-in. */
import type { ReactElement } from "react";
import { DisplayPreferences } from "@/components/DisplayPreferences";
import { PageHeader } from "@/components/ui/PageHeader";

const SettingsPage = (): ReactElement => (
  <div className="settings-page">
    <PageHeader title="Settings">Make Tandem easier to read.</PageHeader>
    <section className="settings-page__content" aria-label="Display settings">
      <DisplayPreferences />
      <p>These choices are saved on this device.</p>
    </section>
  </div>
);

export default SettingsPage;
