import Link from "next/link";
import { SettingsForm } from "@/components/SettingsForm";

export const metadata = {
  title: "Twinmind · Settings",
};

export default function SettingsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-100">Settings</h1>
          <p className="text-xs text-slate-500">
            Edit prompts and model parameters. Stored locally in your browser only.
          </p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-white/10 bg-surface-soft px-3 py-2 text-sm text-slate-200 hover:bg-surface-muted"
        >
          ← Back to app
        </Link>
      </div>
      <SettingsForm />
    </main>
  );
}
