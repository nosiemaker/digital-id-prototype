"use client"

import { motion, AnimatePresence } from "framer-motion"
import { useState, useEffect } from "react"

const greetings = [
  { text: "Hello", lang: "English" },
  { text: "Shani", lang: "Bemba" },
  { text: "bwaji", lang: "Nyanja" },
  { text: "Mwapona", lang: "Tonga" },
  { text: "Mucwani", lang: "Lozi" },
  { text: "Mwaichela", lang: "Kaonde" },
  { text: "Hello", lang: "English" },
]

export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (index < greetings.length - 1) {
      const timer = setTimeout(() => {
        setIndex(index + 1)
      }, 1200) // Slower transitions
      return () => clearTimeout(timer)
    } else {
      const finalTimer = setTimeout(() => {
        onComplete()
      }, 1500)
      return () => clearTimeout(finalTimer)
    }
  }, [index, onComplete])

  const characters = greetings[index].text.split("")

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1, ease: "easeInOut" }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
    >
      <div className="text-center">
        <motion.div
          key={index}
          className="flex justify-center mb-4"
        >
          {characters.map((char, i) => (
            <motion.span
              key={`${index}-${i}`}
              initial={{ opacity: 0, scale: 0.8, filter: "blur(4px)" }}
              animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
              transition={{
                duration: 0.4,
                delay: i * 0.05, // Typing effect
                ease: "easeOut"
              }}
              className="text-white text-5xl md:text-7xl font-bold tracking-tight inline-block"
            >
              {char === " " ? "\u00A0" : char}
            </motion.span>
          ))}
        </motion.div>
        
        <motion.p 
          key={`lang-${index}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 0.5 }}
          className="text-xs font-mono uppercase tracking-[0.4em] text-white"
        >
          {greetings[index].lang}
        </motion.p>
      </div>

      {/* Footer Branding */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3"
      >
        <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-white/40">
          Powered by
        </p>
        <img 
          src="/assets/zamren_logo.png" 
          alt="ZAMREN Logo" 
          className="h-10 w-auto opacity-80 grayscale brightness-200"
        />
      </motion.div>

      {/* Decorative Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
    </motion.div>
  )
}
