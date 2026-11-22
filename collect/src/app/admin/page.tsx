import type { Metadata } from 'next';
import AdminPanel from '@/components/AdminPanel';

export const metadata: Metadata = {
  title: 'Validation, KwèGbaTché',
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <main id="contenu" className="shell shell-wide">
      <AdminPanel />
    </main>
  );
}
