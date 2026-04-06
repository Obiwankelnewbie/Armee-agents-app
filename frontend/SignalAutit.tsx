'use client';

import { motion } from 'framer-motion';

export default function SignalAudit() {
  // On injecte ton code HTML massif ici dans une variable
  const auditContent = `
    `;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full h-[85vh] bg-black rounded-[40px] overflow-hidden border border-emerald-500/10 shadow-2xl"
    >
      <iframe 
        srcDoc={auditContent} 
        title="Swarm Signal Audit"
        className="w-full h-full border-none"
        sandbox="allow-scripts allow-same-origin"
      />
    </motion.div>
  );
}