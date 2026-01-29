import { useNavigate } from 'react-router-dom';
import { ConnectKitButton } from 'connectkit';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';

function Landing() {
  const { isConnected } = useAccount();
  const navigate = useNavigate();
  const [showTerms, setShowTerms] = useState(false);

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
      <footer className="bg-primary-900 text-primary-200 py-8 px-4 sm:px-6 lg:px-8">
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
            <div className="flex items-center space-x-4 text-sm">
              <span>Built on Base</span>
              <span className="text-primary-600">|</span>
              <button
                onClick={() => setShowTerms(true)}
                className="text-primary-300 hover:text-white underline transition-colors"
              >
                Terms & Conditions
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Terms Modal */}
      <AnimatePresence>
        {showTerms && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowTerms(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Terms of Use & Disclaimer</h2>
                  <button
                    onClick={() => setShowTerms(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="text-sm text-gray-600 space-y-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">1. NO LIABILITY</h3>
                    <p>By using BaseWill, you acknowledge and agree that the developers, creators, operators, and affiliates of this platform shall not be held liable for any direct, indirect, incidental, special, consequential, or exemplary damages, including but not limited to loss of funds, assets, profits, data, or any other losses arising from your use of this service.</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">2. USE AT YOUR OWN RISK</h3>
                    <p>BaseWill is an experimental decentralized application provided "as is" without warranties of any kind, express or implied. Smart contracts may contain bugs, vulnerabilities, or behave unexpectedly. You are solely responsible for your interactions with the blockchain and any assets you deposit.</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">3. NOT LEGAL ADVICE</h3>
                    <p>This platform is a technical tool only and does not constitute legal, financial, tax, or estate planning advice. The enforceability of onchain wills varies by jurisdiction and may not be recognized by legal authorities. Consult qualified professionals for estate planning matters.</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">4. IRREVERSIBLE TRANSACTIONS</h3>
                    <p>Blockchain transactions are irreversible. Once assets are deposited or distributed, they cannot be recovered by the platform or its operators. Verify all wallet addresses and configurations carefully before confirming any transaction.</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">5. REGULATORY COMPLIANCE</h3>
                    <p>You are solely responsible for ensuring compliance with all applicable laws and regulations in your jurisdiction. The availability of this service does not imply legality in your location.</p>
                  </div>

                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">6. NO GUARANTEES</h3>
                    <p>We make no guarantees regarding the availability, functionality, or security of this platform. Service may be interrupted, modified, or discontinued at any time without notice.</p>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-center text-gray-500">
                      By connecting your wallet and using BaseWill, you acknowledge that you have read, understood, and agree to be bound by these terms.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowTerms(false)}
                  className="w-full mt-6 btn-primary"
                >
                  I Understand
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default Landing;
