import { Link, useNavigate } from 'react-router-dom';
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi';
import { motion } from 'framer-motion';
import { useEffect } from 'react';

function Landing() {
  const { isConnected } = useAccount();
  const navigate = useNavigate();

  // Redirect to dashboard if already connected
  useEffect(() => {
    if (isConnected) {
      navigate('/dashboard');
    }
  }, [isConnected, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary-700 via-primary-800 to-primary-900">
      {/* Header */}
      <header className="absolute top-0 left-0 right-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-2xl font-bold text-white">BaseWill</span>
            </div>
            <ConnectKitButton />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-7xl font-bold text-white mb-6"
          >
            Your Crypto Legacy,
            <br />
            <span className="text-secondary-400">Secured Forever</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl md:text-2xl text-primary-100 max-w-3xl mx-auto mb-10"
          >
            Create an onchain will to protect your digital assets and ensure your loved ones are taken care of
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <ConnectKitButton.Custom>
              {({ show }) => (
                <button
                  onClick={show}
                  className="btn-secondary btn-lg text-lg px-8"
                >
                  Create My Will
                </button>
              )}
            </ConnectKitButton.Custom>
            <a href="#how-it-works" className="btn-outline btn-lg text-lg px-8 border-white text-white hover:bg-white hover:text-primary-700">
              Learn More
            </a>
          </motion.div>
        </div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="max-w-4xl mx-auto mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
        >
          {[
            { value: '100+ ETH', label: 'Value Protected' },
            { value: '250+', label: 'Wills Created' },
            { value: '50+', label: 'Distributions' },
            { value: '99.9%', label: 'Uptime' },
          ].map((stat, index) => (
            <div key={index} className="text-white">
              <div className="text-3xl md:text-4xl font-bold text-secondary-400">{stat.value}</div>
              <div className="text-primary-200 text-sm mt-1">{stat.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Protect your crypto legacy in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Create Your Will',
                description: 'Add beneficiaries and allocate your assets. Set your inactivity threshold (default 1 year). Appoint notaries for verification.',
                icon: '📝',
              },
              {
                step: '2',
                title: 'Stay Active',
                description: 'Check in periodically (or use automatic tracking). Update anytime if circumstances change. Receive reminders before deadlines.',
                icon: '✅',
              },
              {
                step: '3',
                title: 'Automatic Distribution',
                description: 'After inactivity + verification, will activates. Assets distributed automatically to beneficiaries. Transparent, irreversible, trustless.',
                icon: '🎁',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.2 }}
                viewport={{ once: true }}
                className="card-hover text-center"
              >
                <div className="text-5xl mb-4">{item.icon}</div>
                <div className="inline-flex items-center justify-center w-8 h-8 bg-primary-100 text-primary-700 rounded-full font-bold text-sm mb-4">
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Why BaseWill */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Why BaseWill?</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              The smarter way to protect your digital legacy
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                traditional: 'Traditional wills take months/years to execute',
                basewill: 'BaseWill: Instant automatic distribution',
              },
              {
                traditional: 'Lawyers charge 3-5% of estate value',
                basewill: 'BaseWill: 1% flat fee',
              },
              {
                traditional: 'Probate courts can freeze assets',
                basewill: 'BaseWill: Unstoppable onchain execution',
              },
              {
                traditional: 'Paper wills can be lost or contested',
                basewill: 'BaseWill: Immutable blockchain record',
              },
              {
                traditional: 'Executors can be untrustworthy',
                basewill: 'BaseWill: Code is the executor',
              },
              {
                traditional: 'Complex multi-jurisdiction laws',
                basewill: 'BaseWill: Works globally, no borders',
              },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: index % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                viewport={{ once: true }}
                className="card flex items-start space-x-4"
              >
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 rounded-full bg-danger-100 flex items-center justify-center">
                    <span className="text-danger-500 text-sm">✕</span>
                  </div>
                </div>
                <div>
                  <p className="text-gray-500 line-through text-sm mb-1">{item.traditional}</p>
                  <p className="text-gray-900 font-medium flex items-center">
                    <span className="w-5 h-5 rounded-full bg-success-100 flex items-center justify-center mr-2">
                      <span className="text-success-500 text-xs">✓</span>
                    </span>
                    {item.basewill}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">Perfect For</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: '💰', label: 'Crypto Holders' },
              { icon: '🖼️', label: 'NFT Collectors' },
              { icon: '🌾', label: 'DeFi Farmers' },
              { icon: '🏢', label: 'Business Owners' },
              { icon: '🌍', label: 'Digital Nomads' },
              { icon: '👨‍👩‍👧‍👦', label: 'Families' },
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="card text-center py-6"
              >
                <div className="text-4xl mb-2">{item.icon}</div>
                <div className="text-sm font-medium text-gray-700">{item.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary-50">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-8">Built for Security</h2>
          <div className="flex flex-wrap justify-center gap-8">
            {[
              'Smart contracts audited',
              'Non-custodial',
              'Immutable records',
              'Transparent execution',
              'Multi-sig support',
            ].map((item, index) => (
              <div key={index} className="flex items-center space-x-2 text-gray-700">
                <svg className="w-5 h-5 text-success-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-primary-700">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-bold text-white mb-4">
            Protect Your Crypto Legacy Today
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Free will creation - only pay fee upon distribution
          </p>
          <ConnectKitButton.Custom>
            {({ show }) => (
              <button onClick={show} className="btn-secondary btn-lg text-lg px-8">
                Get Started
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary-900 text-primary-200 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-xl font-bold text-white">BaseWill</span>
            </div>
            <p className="text-sm">
              Built on Base. Your assets, your rules, your legacy.
            </p>
          </div>
          <div className="mt-8 pt-8 border-t border-primary-800 text-center text-sm">
            <p className="text-primary-400">
              DISCLAIMER: BaseWill is a technical tool, not legal advice. Consult qualified attorneys for estate planning.
              <br />
              Enforceability varies by jurisdiction. Use at your own discretion.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
