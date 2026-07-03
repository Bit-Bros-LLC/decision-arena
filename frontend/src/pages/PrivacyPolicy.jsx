import { Link } from 'react-router-dom';

function Section({ title, children }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium text-slate-100">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-900 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2 border-b border-slate-700 pb-6">
          <Link to="/" className="text-sm text-amber-400 hover:text-amber-300">
            ← Back to Decision Arena
          </Link>
          <h1 className="text-3xl font-bold text-slate-100">Privacy Policy</h1>
          <p className="text-sm text-slate-400">Last updated: July 2026</p>
        </header>

        <Section title="Who we are">
          <p>
            Decision Arena is operated by <strong className="text-slate-200">Bit Bros Data</strong>.
            This policy explains how we handle information when you use our website and application.
          </p>
        </Section>

        <Section title="What we collect">
          <p>
            If you accept analytics, we use <strong className="text-slate-200">Google Analytics 4</strong>{' '}
            to collect usage information such as:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Pages you visit and navigation paths within the app</li>
            <li>Feature usage events (for example, creating a room or submitting a policy)</li>
            <li>Browser type, device type, and approximate location (country/region level)</li>
            <li>Referring site and general interaction timestamps</li>
          </ul>
          <p>
            We do not use analytics to collect passwords, policy content you submit in simulations,
            or other classroom data beyond what is needed to operate the product.
          </p>
        </Section>

        <Section title="Why we collect it">
          <p>
            We use this information solely to understand how Decision Arena is used and to improve
            the product — for example, by identifying confusing workflows or underused features.
          </p>
        </Section>

        <Section title="What we do not do">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              We do <strong className="text-slate-200">not</strong> use analytics data for
              advertising or ad targeting.
            </li>
            <li>
              We do <strong className="text-slate-200">not</strong> sell, rent, or trade your
              personal data to third parties.
            </li>
            <li>
              We do <strong className="text-slate-200">not</strong> share data with data brokers.
            </li>
          </ul>
        </Section>

        <Section title="Legal basis (GDPR)">
          <p>
            Where the GDPR applies, we process analytics data based on your{' '}
            <strong className="text-slate-200">consent</strong> (Article 6(1)(a)). You may withdraw
            consent at any time in Account Settings or by declining the analytics banner. Withdrawal
            does not affect the lawfulness of processing before withdrawal.
          </p>
        </Section>

        <Section title="Third-party processors">
          <p>
            Google Analytics is provided by Google (Google Ireland Limited for users in the EEA/UK,
            and Google LLC elsewhere). Google processes data on our behalf according to their terms.
            See{' '}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 underline hover:text-amber-300"
            >
              Google&apos;s Privacy Policy
            </a>{' '}
            for details on how Google handles data.
          </p>
        </Section>

        <Section title="Cookies and local storage">
          <p>
            We store your analytics preference (<code className="text-slate-200">granted</code> or{' '}
            <code className="text-slate-200">denied</code>) in your browser&apos;s{' '}
            <strong className="text-slate-200">localStorage</strong> so we do not ask you on every
            visit. If you accept analytics, Google Analytics may set cookies or similar identifiers
            in your browser to measure usage. If you decline, we do not load Google Analytics.
          </p>
        </Section>

        <Section title="Data retention">
          <p>
            Analytics data retained by Google is subject to our GA4 property settings (typically
            between 2 and 14 months for event data, depending on configuration). Your consent
            preference remains in localStorage until you clear site data or change your choice in
            Account Settings.
          </p>
        </Section>

        <Section title="Your rights">
          <p>Depending on your location, you may have the right to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Access the personal data we hold about you</li>
            <li>Request correction of inaccurate data</li>
            <li>Request erasure of your data</li>
            <li>Restrict or object to certain processing</li>
            <li>Withdraw consent for analytics at any time</li>
            <li>Lodge a complaint with your local data protection authority</li>
          </ul>
          <p>
            To exercise these rights, contact us at{' '}
            <a
              href="mailto:info@bitbrosdata.com"
              className="text-amber-400 underline hover:text-amber-300"
            >
              info@bitbrosdata.com
            </a>
            .
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about this policy or your data? Email{' '}
            <a
              href="mailto:info@bitbrosdata.com"
              className="text-amber-400 underline hover:text-amber-300"
            >
              info@bitbrosdata.com
            </a>
            .
          </p>
        </Section>
      </div>
    </div>
  );
}
