/**
 * HelpPage.tsx
 * Routes "/help" and "/help/:slug" (SPEC 9.1, 9.2). Without a slug it shows
 * the Help Center home (search, topics, Ask box); with a slug it shows that
 * article. Articles are parsed and indexed once per page load by
 * getHelpLibrary(); tests can pass their own library.
 */
import type { ReactElement } from "react";
import { useParams } from "react-router-dom";
import { HelpArticlePage } from "@/components/help/HelpArticlePage";
import { HelpHome } from "@/components/help/HelpHome";
import { getHelpLibrary, type HelpLibrary } from "@/lib/help";

interface HelpPageProps {
  readonly library?: HelpLibrary;
}

const HelpPage = ({ library = getHelpLibrary() }: HelpPageProps): ReactElement => {
  const { slug } = useParams<{ slug?: string }>();
  return slug ? <HelpArticlePage library={library} slug={slug} /> : <HelpHome library={library} />;
};

export default HelpPage;
