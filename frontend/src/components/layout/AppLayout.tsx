import { memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Music, Sun, Moon, Radio, Settings as SettingsIcon } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { GlassCard } from "@/components/ui/card"
import { staggerContainer, fadeInUp, slideInLeft, buttonPulse, springConfig } from '../../lib/animations'
import type { ActiveTab, AppTab } from '../../types/app'

interface AppLayoutProps {
  activeTab: ActiveTab
  onTabChange: (tab: ActiveTab) => void
  isDarkMode: boolean
  onToggleDarkMode: () => void
  children: React.ReactNode
}

const tabs: AppTab[] = [
  { id: 'player', label: 'Player', icon: Music },
  { id: 'library', label: 'Library', icon: Radio },
  { id: 'rfid', label: 'Cards', icon: Radio },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
]

export const AppLayout = memo(function AppLayout({
  activeTab,
  onTabChange,
  isDarkMode,
  onToggleDarkMode,
  children
}: AppLayoutProps) {
  return (
    <div className="min-h-screen dark-gradient-bg">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Header */}
        <motion.header 
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="mb-8"
        >
          <motion.div 
            variants={fadeInUp}
            className="flex items-center justify-between mb-6"
          >
            <motion.div 
              variants={slideInLeft}
              className="flex items-center space-x-3"
            >
              <motion.div 
                className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center"
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.6, ease: "easeInOut" }}
              >
                <Music className="w-6 h-6 text-white" />
              </motion.div>
              <div>
                <motion.h1 
                  className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, ...springConfig }}
                >
                  TapTunes
                </motion.h1>
                <motion.p 
                  className="text-sm text-slate-300"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  Modern RFID Music System
                </motion.p>
              </div>
            </motion.div>
            
            <motion.div
              variants={buttonPulse}
              whileHover="hover"
              whileTap="tap"
            >
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleDarkMode}
                className="glass-card"
              >
                <motion.div
                  key={isDarkMode ? 'dark' : 'light'}
                  initial={{ rotate: -180, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </motion.div>
              </Button>
            </motion.div>
          </motion.div>

          {/* Navigation */}
          <motion.div
            variants={fadeInUp}
            transition={{ delay: 0.3 }}
          >
            <GlassCard className="p-2">
              <nav className="flex space-x-1">
                {tabs.map((tab, index) => {
                  const Icon = tab.icon;
                  return (
                    <motion.div
                      key={tab.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.4 + index * 0.1, ...springConfig }}
                      variants={buttonPulse}
                      whileHover="hover"
                      whileTap="tap"
                    >
                      <Button
                        variant={activeTab === tab.id ? "default" : "ghost"}
                        onClick={() => onTabChange(tab.id)}
                        className="flex items-center space-x-2 relative overflow-hidden"
                      >
                        <motion.div
                          animate={activeTab === tab.id ? { rotate: 360 } : {}}
                          transition={{ duration: 0.5 }}
                        >
                          <Icon className="w-4 h-4" />
                        </motion.div>
                        <span className="hidden sm:inline">{tab.label}</span>
                        {activeTab === tab.id && (
                          <motion.div
                            className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-md"
                            layoutId="activeTab"
                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                          />
                        )}
                      </Button>
                    </motion.div>
                  );
                })}
              </nav>
            </GlassCard>
          </motion.div>
        </motion.header>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          <motion.main
            key="main-content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </div>
    </div>
  )
})