import Collector from '@/components/Collector';
import { loadPhrases } from '@/lib/phrases';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  const phrases = loadPhrases();
  return (
    <main id="contenu" className="shell">
      <Collector phrases={phrases} />
    </main>
  );
}
