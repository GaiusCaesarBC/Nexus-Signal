// server/data/vaultItems.js - VAULT ITEMS DATABASE
// THE MOST LEGENDARY VAULT SYSTEM EVER CREATED
// ⚡ 27 THEMES • 11 AVATAR BORDERS • 6 PERKS • 12 BADGES ⚡

const VAULT_ITEMS = {
    // ===== AVATAR BORDERS (11 items) =====
    avatarBorders: [
        {
            id: 'border-bronze',
            name: 'Bronze Frame',
            description: 'A classic bronze border for beginners',
            type: 'avatar-border',
            rarity: 'common',
            cost: 0,
            gradient: 'linear-gradient(135deg, #CD7F32 0%, #8B5A2B 100%)',
            glowColor: 'rgba(205, 127, 50, 0.5)',
            unlockRequirement: null
        },
        {
            id: 'border-silver',
            name: 'Silver Frame',
            description: 'Sleek silver border for rising traders',
            type: 'avatar-border',
            rarity: 'common',
            cost: 500,
            gradient: 'linear-gradient(135deg, #C0C0C0 0%, #808080 100%)',
            glowColor: 'rgba(192, 192, 192, 0.5)',
            unlockRequirement: { type: 'level', value: 5 }
        },
        {
            id: 'border-gold',
            name: 'Gold Frame',
            description: 'Luxurious gold border for skilled traders',
            type: 'avatar-border',
            rarity: 'rare',
            cost: 2000,
            gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
            glowColor: 'rgba(255, 215, 0, 0.6)',
            unlockRequirement: { type: 'level', value: 10 }
        },
        {
            id: 'border-emerald',
            name: 'Emerald Frame',
            description: 'Vibrant green border for profit masters',
            type: 'avatar-border',
            rarity: 'rare',
            cost: 3000,
            gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            glowColor: 'rgba(16, 185, 129, 0.6)',
            unlockRequirement: { type: 'level', value: 15 }
        },
        {
            id: 'border-ruby',
            name: 'Ruby Frame',
            description: 'Fiery red border for aggressive traders',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 4000,
            gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
            glowColor: 'rgba(239, 68, 68, 0.7)',
            unlockRequirement: { type: 'level', value: 18 }
        },
        {
            id: 'border-platinum',
            name: 'Platinum Frame',
            description: 'Prestigious platinum border for elite traders',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 5000,
            gradient: 'linear-gradient(135deg, #E5E4E2 0%, #B9B8B5 100%)',
            glowColor: 'rgba(229, 228, 226, 0.7)',
            unlockRequirement: { type: 'level', value: 20 }
        },
        {
            id: 'border-sapphire',
            name: 'Sapphire Frame',
            description: 'Deep blue border for analytical minds',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 6000,
            gradient: 'linear-gradient(135deg, #3b82f6 0%, #1e40af 100%)',
            glowColor: 'rgba(59, 130, 246, 0.7)',
            unlockRequirement: { type: 'level', value: 25 }
        },
        {
            id: 'border-amethyst',
            name: 'Amethyst Frame',
            description: 'Royal purple border for strategic traders',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 7000,
            gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
            glowColor: 'rgba(139, 92, 246, 0.7)',
            unlockRequirement: { type: 'level', value: 30 }
        },
        {
            id: 'border-diamond',
            name: 'Diamond Frame',
            description: 'Radiant diamond border for master traders',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 10000,
            gradient: 'linear-gradient(135deg, #B9F2FF 0%, #00D4FF 50%, #B9F2FF 100%)',
            glowColor: 'rgba(0, 212, 255, 0.8)',
            animation: 'shimmer',
            unlockRequirement: { type: 'level', value: 50 }
        },
        {
            id: 'border-rainbow',
            name: 'Rainbow Frame',
            description: 'Multicolor animated border - extremely rare',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 15000,
            gradient: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 20%, #10b981 40%, #3b82f6 60%, #8b5cf6 80%, #ec4899 100%)',
            glowColor: 'rgba(139, 92, 246, 0.9)',
            animation: 'shimmer',
            unlockRequirement: { type: 'level', value: 60 }
        },
        {
            id: 'border-nexus',
            name: 'Nexus Frame',
            description: 'The legendary Nexus border - ultimate prestige',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 25000,
            gradient: 'linear-gradient(135deg, #00adef 0%, #8b5cf6 50%, #00adef 100%)',
            glowColor: 'rgba(0, 173, 237, 1)',
            animation: 'pulse-glow',
unlockRequirement: { type: 'level', value: 100 }
        },
        // ╔══════════════════════════════════════════════════════════════╗
        // ║           🔥 NEW EPIC BORDERS - SERIOUSLY SICK 🔥             ║
        // ╚══════════════════════════════════════════════════════════════╝
        {
            id: 'border-crimson-blade',
            name: 'Crimson Blade',
            description: 'Blood-forged steel with razor sharp edges',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 5500,
            gradient: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 50%, #7f1d1d 100%)',
            glowColor: 'rgba(220, 38, 38, 0.7)',
            animation: 'pulse',
            unlockRequirement: { type: 'level', value: 22 }
        },
        {
            id: 'border-tsunami',
            name: 'Tsunami Wave',
            description: 'The fury of the ocean surrounds you',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 5500,
            gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0ea5e9 50%, #7dd3fc 100%)',
            glowColor: 'rgba(14, 165, 233, 0.7)',
            animation: 'wave',
            unlockRequirement: { type: 'level', value: 24 }
        },
        {
            id: 'border-ancient-oak',
            name: 'Ancient Oak',
            description: 'Nature energy pulses through ancient roots',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 6000,
            gradient: 'linear-gradient(135deg, #14532d 0%, #22c55e 50%, #86efac 100%)',
            glowColor: 'rgba(34, 197, 94, 0.7)',
            animation: 'pulse',
            unlockRequirement: { type: 'level', value: 26 }
        },
        {
            id: 'border-phantom',
            name: 'Phantom Mask',
            description: 'Ghostly wisps dance around your presence',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 6500,
            gradient: 'linear-gradient(135deg, #1e1b4b 0%, #6366f1 50%, #c7d2fe 100%)',
            glowColor: 'rgba(99, 102, 241, 0.7)',
            animation: 'ghost',
            unlockRequirement: { type: 'level', value: 28 }
        },
        {
            id: 'border-toxic-haze',
            name: 'Toxic Haze',
            description: 'Radioactive energy emanates danger',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 7000,
            gradient: 'linear-gradient(135deg, #1a2e05 0%, #84cc16 50%, #d9f99d 100%)',
            glowColor: 'rgba(132, 204, 22, 0.8)',
            animation: 'pulse-glow',
            unlockRequirement: { type: 'level', value: 32 }
        },
        {
            id: 'border-mystic-runes',
            name: 'Mystic Runes',
            description: 'Ancient symbols of power rotate endlessly',
            type: 'avatar-border',
            rarity: 'epic',
            cost: 7500,
            gradient: 'linear-gradient(135deg, #581c87 0%, #a855f7 50%, #e9d5ff 100%)',
            glowColor: 'rgba(168, 85, 247, 0.8)',
            animation: 'rotate',
            unlockRequirement: { type: 'level', value: 35 }
        },
        // ╔══════════════════════════════════════════════════════════════╗
        // ║      🟡 LEGENDARY BORDERS - THE ABSOLUTE SICKEST 🟡          ║
        // ╚══════════════════════════════════════════════════════════════╝
        {
            id: 'border-inferno-crown',
            name: 'Inferno Crown',
            description: 'Flames of hell circle your avatar - absolute fire',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 12000,
            gradient: 'linear-gradient(135deg, #7c2d12 0%, #f97316 30%, #fbbf24 60%, #fef3c7 100%)',
            glowColor: 'rgba(249, 115, 22, 0.9)',
            animation: 'flames',
            effects: { flames: true, embers: true, heatDistortion: true },
            unlockRequirement: { type: 'level', value: 55 }
        },
        {
            id: 'border-lightning-fury',
            name: 'Lightning Fury',
            description: 'Electric bolts crackle with Zeus-level power',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 12000,
            gradient: 'linear-gradient(135deg, #1e3a5f 0%, #3b82f6 40%, #93c5fd 70%, #ffffff 100%)',
            glowColor: 'rgba(59, 130, 246, 0.9)',
            animation: 'electric',
            effects: { lightning: true, sparks: true, flash: true },
            unlockRequirement: { type: 'level', value: 55 }
        },
        {
            id: 'border-void-portal',
            name: 'Void Portal',
            description: 'A dark vortex to another dimension swirls endlessly',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 14000,
            gradient: 'linear-gradient(135deg, #000000 0%, #1e1b4b 40%, #7c3aed 80%, #c4b5fd 100%)',
            glowColor: 'rgba(124, 58, 237, 0.9)',
            animation: 'vortex',
            effects: { vortex: true, darkEnergy: true, particles: true },
            unlockRequirement: { type: 'level', value: 60 }
        },
        {
            id: 'border-deaths-embrace',
            name: "Death's Embrace",
            description: 'Shadow tendrils reach out from the beyond',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 14000,
            gradient: 'linear-gradient(135deg, #000000 0%, #1f2937 50%, #4b5563 100%)',
            glowColor: 'rgba(75, 85, 99, 0.9)',
            animation: 'tendrils',
            effects: { shadows: true, tendrils: true, deathMist: true },
            unlockRequirement: { type: 'level', value: 62 }
        },
        {
            id: 'border-dragon-wrath',
            name: "Dragon's Wrath",
            description: 'Ancient dragon scales with fire breath - absolute power',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 16000,
            gradient: 'linear-gradient(135deg, #450a0a 0%, #dc2626 30%, #f97316 60%, #fbbf24 100%)',
            glowColor: 'rgba(220, 38, 38, 1)',
            animation: 'dragon-fire',
            effects: { dragonScales: true, fireBreath: true, embers: true, smoke: true },
            unlockRequirement: { type: 'level', value: 65 }
        },
        {
            id: 'border-frozen-eternity',
            name: 'Frozen Eternity',
            description: 'Ice crystals form and shatter in an endless winter',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 14000,
            gradient: 'linear-gradient(135deg, #0c4a6e 0%, #06b6d4 40%, #a5f3fc 70%, #ffffff 100%)',
            glowColor: 'rgba(6, 182, 212, 0.9)',
            animation: 'frost',
            effects: { iceShards: true, snowflakes: true, frostCrystals: true, breathEffect: true },
            unlockRequirement: { type: 'level', value: 58 }
        },
        {
            id: 'border-cosmic-destroyer',
            name: 'Cosmic Destroyer',
            description: 'Galaxies orbit your avatar - god tier flex',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 18000,
            gradient: 'linear-gradient(135deg, #020617 0%, #1e1b4b 30%, #6366f1 60%, #a855f7 80%, #ec4899 100%)',
            glowColor: 'rgba(99, 102, 241, 1)',
            animation: 'galaxy-orbit',
            effects: { galaxySpiral: true, stars: true, nebulaClouds: true, shootingStars: true },
            unlockRequirement: { type: 'level', value: 70 }
        },
        {
            id: 'border-blood-moon',
            name: 'Blood Moon',
            description: 'Crimson eclipse energy pulses with dark power',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 15000,
            gradient: 'linear-gradient(135deg, #1c1917 0%, #7f1d1d 40%, #dc2626 70%, #fca5a5 100%)',
            glowColor: 'rgba(220, 38, 38, 0.95)',
            animation: 'blood-pulse',
            effects: { bloodMoon: true, crimsonAura: true, darkEnergy: true },
            unlockRequirement: { type: 'level', value: 63 }
        },
        {
            id: 'border-quantum-rift',
            name: 'Quantum Rift',
            description: 'Reality itself glitches around your presence',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 16000,
            gradient: 'linear-gradient(135deg, #14b8a6 0%, #06b6d4 30%, #d946ef 70%, #f43f5e 100%)',
            glowColor: 'rgba(217, 70, 239, 0.9)',
            animation: 'glitch',
            effects: { quantumGlitch: true, dimensionalRift: true, particleDistortion: true },
            unlockRequirement: { type: 'level', value: 67 }
        },
        {
            id: 'border-divine-ascension',
            name: 'Divine Ascension',
            description: 'Holy rays emanate from your godlike presence',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 18000,
            gradient: 'linear-gradient(135deg, #fef3c7 0%, #fbbf24 30%, #f472b6 70%, #ffffff 100%)',
            glowColor: 'rgba(251, 191, 36, 1)',
            animation: 'divine-rays',
            effects: { sunrays: true, divineGlow: true, halos: true, shimmer: true, holyParticles: true },
            unlockRequirement: { type: 'level', value: 72 }
        },
        {
            id: 'border-abyssal-terror',
            name: 'Abyssal Terror',
            description: 'Deep sea horror with bioluminescent nightmares',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 17000,
            gradient: 'linear-gradient(135deg, #000000 0%, #0c4a6e 40%, #0891b2 70%, #22d3ee 100%)',
            glowColor: 'rgba(8, 145, 178, 0.9)',
            animation: 'deep-pulse',
            effects: { bioluminescent: true, tentacles: true, deepPressure: true, bubbles: true },
            unlockRequirement: { type: 'level', value: 68 }
        },
        {
            id: 'border-supernova-core',
            name: 'Supernova Core',
            description: 'An exploding star - universe-ending energy',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 20000,
            gradient: 'linear-gradient(135deg, #1e1b4b 0%, #f97316 30%, #fbbf24 50%, #ffffff 70%, #6366f1 100%)',
            glowColor: 'rgba(249, 115, 22, 1)',
            animation: 'supernova',
            effects: { explosionWaves: true, cosmicRays: true, starBurst: true, plasmaRings: true },
            unlockRequirement: { type: 'level', value: 75 }
        },
        {
            id: 'border-all-seeing-eye',
            name: 'All-Seeing Eye',
            description: 'The eye that sees all - illuminated truth',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 19000,
            gradient: 'linear-gradient(135deg, #1a1a2e 0%, #fbbf24 40%, #f59e0b 60%, #1a1a2e 100%)',
            glowColor: 'rgba(251, 191, 36, 0.95)',
            animation: 'eye-pulse',
            effects: { allSeeingEye: true, pyramidGlow: true, ancientSymbols: true },
            unlockRequirement: { type: 'level', value: 73 }
        },
        {
            id: 'border-prismatic-fury',
            name: 'Prismatic Fury',
            description: 'Rainbow energy explosion - maximum flex',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 22000,
            gradient: 'linear-gradient(135deg, #ef4444 0%, #f97316 15%, #fbbf24 30%, #22c55e 45%, #06b6d4 60%, #3b82f6 75%, #8b5cf6 90%, #ec4899 100%)',
            glowColor: 'rgba(139, 92, 246, 1)',
            animation: 'rainbow-burst',
            effects: { rainbowWave: true, prismShatter: true, lightRefraction: true, colorExplosion: true },
            unlockRequirement: { type: 'level', value: 80 }
        },
        {
            id: 'border-apex-predator',
            name: 'Apex Predator',
            description: 'The ultimate hunter - fear incarnate',
            type: 'avatar-border',
            rarity: 'legendary',
            cost: 30000,
            gradient: 'linear-gradient(135deg, #000000 0%, #450a0a 25%, #dc2626 50%, #fbbf24 75%, #ffffff 100%)',
            glowColor: 'rgba(220, 38, 38, 1)',
            animation: 'predator-pulse',
            effects: { predatorVision: true, huntingAura: true, bloodTrails: true, intimidate: true },
            unlockRequirement: { type: 'level', value: 90 }
        },
        // ╔══════════════════════════════════════════════════════════════╗
        // ║        💎 MYTHIC BORDERS - BEYOND LEGENDARY 💎               ║
        // ╚══════════════════════════════════════════════════════════════╝
        {
            id: 'border-reality-shatter',
            name: 'Reality Shatter',
            description: 'Break the fabric of existence itself',
            type: 'avatar-border',
            rarity: 'mythic',
            cost: 50000,
            gradient: 'linear-gradient(135deg, #000000 0%, #7c3aed 20%, #ec4899 40%, #06b6d4 60%, #fbbf24 80%, #ffffff 100%)',
            glowColor: 'rgba(236, 72, 153, 1)',
            animation: 'reality-break',
            effects: { realityShatter: true, dimensionalTear: true, cosmicEnergy: true, timeDistortion: true, multiverse: true },
            unlockRequirement: { type: 'level', value: 150 }
        },
        {
            id: 'border-eternal-sovereign',
            name: 'Eternal Sovereign',
            description: 'The one true ruler of all realms - bow before greatness',
            type: 'avatar-border',
            rarity: 'mythic',
            cost: 100000,
            gradient: 'linear-gradient(135deg, #000000 0%, #7c2d12 15%, #fbbf24 30%, #ffffff 50%, #fbbf24 70%, #7c2d12 85%, #000000 100%)',
            glowColor: 'rgba(251, 191, 36, 1)',
            animation: 'sovereign-aura',
            effects: { crownOfLight: true, royalAura: true, divineMandate: true, eternalFlame: true, cosmicThrone: true },
            unlockRequirement: { type: 'level', value: 200 }
        
            },
        // ╔══════════════════════════════════════════════════════════════╗
        // ║        🏛️ ORIGIN BORDERS - FOUNDERS ONLY 🏛️                  ║
        // ╚══════════════════════════════════════════════════════════════╝
        {
            id: 'border-architects-ring',
            name: "Architect's Ring",
            description: 'Sacred geometry of the founders who built Nexus Signal. Unobtainable.',
            type: 'avatar-border',
            rarity: 'origin',
            cost: null,
            obtainable: false,
            gradient: 'conic-gradient(from 0deg, #0a1628 0%, #d4af37 8%, #f8fafc 12%, #d4af37 16%, #0a1628 25%, #d4af37 33%, #f8fafc 37%, #d4af37 41%, #0a1628 50%, #d4af37 58%, #f8fafc 62%, #d4af37 66%, #0a1628 75%, #d4af37 83%, #f8fafc 87%, #d4af37 91%, #0a1628 100%)',
            glowColor: 'rgba(212, 175, 55, 1)',
            animation: 'architect',
            effects: { sacredGeometry: true, blueprintGrid: true, signalPulse: true, counterRotate: true },
            unlockRequirement: { type: 'founder', value: true }
        }
    ],


    // ===== PERKS (6 items) =====
    perks: [
        {
            id: 'perk-fast-learner',
            name: 'Fast Learner',
            description: '+5% XP from all sources',
            type: 'perk',
            rarity: 'rare',
            cost: 2500,
            effect: { type: 'xp_bonus', value: 0.05 },
            icon: '📚',
            duration: null,
            unlockRequirement: { type: 'level', value: 10 }
        },
        {
            id: 'perk-lucky-trader',
            name: 'Lucky Trader',
            description: '+10% bonus XP on all trades',
            type: 'perk',
            rarity: 'rare',
            cost: 3000,
            effect: { type: 'xp_bonus', value: 0.10 },
            icon: '🍀',
            duration: null,
            unlockRequirement: { type: 'level', value: 15 }
        },
        {
            id: 'perk-coin-magnet',
            name: 'Coin Magnet',
            description: '+5% bonus Nexus Coins from all activities',
            type: 'perk',
            rarity: 'epic',
            cost: 5000,
            effect: { type: 'coin_bonus', value: 0.05 },
            icon: '🧲',
            duration: null,
            unlockRequirement: { type: 'level', value: 25 }
        },
        {
            id: 'perk-profit-boost',
            name: 'Profit Boost',
            description: '+3% bonus on profitable trades',
            type: 'perk',
            rarity: 'epic',
            cost: 8000,
            effect: { type: 'profit_bonus', value: 0.03 },
            icon: '💎',
            duration: null,
            unlockRequirement: { type: 'level', value: 35 }
        },
        {
            id: 'perk-streak-master',
            name: 'Streak Master',
            description: 'Login streak never breaks (1 day grace period)',
            type: 'perk',
            rarity: 'legendary',
            cost: 15000,
            effect: { type: 'streak_protection', value: 1 },
            icon: '🔥',
            duration: null,
            unlockRequirement: { type: 'level', value: 40 }
        },
        {
            id: 'perk-double-daily',
            name: 'Double Daily',
            description: 'Complete 2 daily challenges per day',
            type: 'perk',
            rarity: 'legendary',
            cost: 20000,
            effect: { type: 'extra_daily', value: 1 },
            icon: '⚡',
            duration: null,
            unlockRequirement: { type: 'level', value: 50 }
        }
    ],

    // ╔══════════════════════════════════════════════════════════════╗
    // ║        🎨 PROFILE THEMES (27 LEGENDARY THEMES) 🎨            ║
    // ╚══════════════════════════════════════════════════════════════╝
    profileThemes: [
        // ============ ⬜ COMMON THEMES (5) ============
        {
            id: 'theme-default',
            name: 'Nexus Core',
            description: 'Classic Nexus blue theme - the original',
            type: 'profile-theme',
            rarity: 'common',
            cost: 0,
            colors: {
                primary: '#00adef',
                secondary: '#0891b2',
                accent: '#06b6d4',
                background: 'rgba(30, 41, 59, 0.9)',
                pageBackground: 'linear-gradient(145deg, #0a0e27 0%, #1a1f3a 50%, #0a0e27 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(10, 14, 39, 0.98) 0%, rgba(10, 14, 39, 0.95) 100%)'
            },
            effects: null,
            unlockRequirement: null
        },
        {
            id: 'theme-emerald',
            name: 'Emerald Matrix',
            description: 'Vibrant green theme for profit enthusiasts',
            type: 'profile-theme',
            rarity: 'common',
            cost: 500,
            colors: {
                primary: '#10b981',
                secondary: '#059669',
                accent: '#34d399',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.15) 100%)',
                pageBackground: 'linear-gradient(145deg, #021a12 0%, #0a2920 50%, #021a12 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(2, 26, 18, 0.98) 0%, rgba(2, 26, 18, 0.95) 100%)'
            },
            effects: null,
            unlockRequirement: { type: 'level', value: 3 }
        },
        {
            id: 'theme-crimson',
            name: 'Blood Moon',
            description: 'Bold red theme for aggressive traders',
            type: 'profile-theme',
            rarity: 'common',
            cost: 500,
            colors: {
                primary: '#ef4444',
                secondary: '#dc2626',
                accent: '#f87171',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)',
                pageBackground: 'linear-gradient(145deg, #1a0505 0%, #2d0a0a 50%, #1a0505 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(26, 5, 5, 0.98) 0%, rgba(26, 5, 5, 0.95) 100%)'
            },
            effects: null,
            unlockRequirement: { type: 'level', value: 3 }
        },
        {
            id: 'theme-ocean',
            name: 'Deep Abyss',
            description: 'Deep blue theme inspired by the ocean depths',
            type: 'profile-theme',
            rarity: 'common',
            cost: 500,
            colors: {
                primary: '#0ea5e9',
                secondary: '#0284c7',
                accent: '#38bdf8',
                background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.15) 0%, rgba(2, 132, 199, 0.15) 100%)',
                pageBackground: 'linear-gradient(145deg, #021526 0%, #0a2540 50%, #021526 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(2, 21, 38, 0.98) 0%, rgba(2, 21, 38, 0.95) 100%)'
            },
            effects: null,
            unlockRequirement: { type: 'level', value: 5 }
        },
        {
            id: 'theme-slate',
            name: 'Shadow Steel',
            description: 'Sleek metallic gray for minimalists',
            type: 'profile-theme',
            rarity: 'common',
            cost: 500,
            colors: {
                primary: '#64748b',
                secondary: '#475569',
                accent: '#94a3b8',
                background: 'linear-gradient(135deg, rgba(100, 116, 139, 0.15) 0%, rgba(71, 85, 105, 0.15) 100%)',
                pageBackground: 'linear-gradient(145deg, #0f1318 0%, #1e2530 50%, #0f1318 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(15, 19, 24, 0.98) 0%, rgba(15, 19, 24, 0.95) 100%)'
            },
            effects: null,
            unlockRequirement: { type: 'level', value: 5 }
        },

        // ============ 🔵 RARE THEMES (6) ============
        {
            id: 'theme-forest',
            name: 'Enchanted Grove',
            description: 'Magical forest theme with floating particles',
            type: 'profile-theme',
            rarity: 'rare',
            cost: 2000,
            colors: {
                primary: '#22c55e',
                secondary: '#16a34a',
                accent: '#4ade80',
                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15) 0%, rgba(22, 163, 74, 0.15) 100%)',
                pageBackground: 'linear-gradient(145deg, #051a0a 0%, #0d2914 50%, #051a0a 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(5, 26, 10, 0.98) 0%, rgba(5, 26, 10, 0.95) 100%)'
            },
            effects: {
                type: 'particles',
                count: 25,
                colors: ['#22c55e', '#4ade80', '#86efac', '#bbf7d0'],
                speed: 'slow',
                opacity: 0.4,
                glow: true,
                size: { min: 2, max: 6 }
            },
            unlockRequirement: { type: 'level', value: 10 }
        },
        {
            id: 'theme-royal',
            name: 'Imperial Violet',
            description: 'Majestic purple theme with glowing orbs',
            type: 'profile-theme',
            rarity: 'rare',
            cost: 2500,
            colors: {
                primary: '#8b5cf6',
                secondary: '#7c3aed',
                accent: '#a78bfa',
                background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(124, 58, 237, 0.15) 100%)',
                pageBackground: 'linear-gradient(145deg, #0f0720 0%, #1a0f30 50%, #0f0720 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(15, 7, 32, 0.98) 0%, rgba(15, 7, 32, 0.95) 100%)'
            },
            effects: {
                type: 'particles',
                count: 20,
                colors: ['#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
                speed: 'slow',
                opacity: 0.35,
                glow: true,
                size: { min: 2, max: 5 }
            },
            unlockRequirement: { type: 'level', value: 12 }
        },
        {
            id: 'theme-midnight',
            name: 'Starfall Night',
            description: 'Dark indigo theme with twinkling stars',
            type: 'profile-theme',
            rarity: 'rare',
            cost: 2500,
            colors: {
                primary: '#6366f1',
                secondary: '#4f46e5',
                accent: '#818cf8',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(79, 70, 229, 0.15) 100%)',
                pageBackground: 'linear-gradient(145deg, #080820 0%, #101035 50%, #080820 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(8, 8, 32, 0.98) 0%, rgba(8, 8, 32, 0.95) 100%)'
            },
            effects: {
                type: 'stars',
                count: 80,
                colors: ['#6366f1', '#818cf8', '#c7d2fe', '#ffffff'],
                twinkle: true,
                opacity: 0.6,
                size: { min: 1, max: 4 }
            },
            unlockRequirement: { type: 'level', value: 15 }
        },
        {
            id: 'theme-sunset',
            name: 'Inferno Dusk',
            description: 'Warm orange and pink gradient sunset',
            type: 'profile-theme',
            rarity: 'rare',
            cost: 3000,
            colors: {
                primary: '#f59e0b',
                secondary: '#ec4899',
                accent: '#fb923c',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(236, 72, 153, 0.15) 100%)',
                pageBackground: 'linear-gradient(145deg, #1a0f05 0%, #2d1510 50%, #1a0f05 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(26, 15, 5, 0.98) 0%, rgba(26, 15, 5, 0.95) 100%)'
            },
            effects: {
                type: 'particles',
                count: 25,
                colors: ['#f59e0b', '#ec4899', '#f97316', '#fb7185'],
                speed: 'medium',
                opacity: 0.35,
                glow: true,
                size: { min: 2, max: 5 }
            },
            unlockRequirement: { type: 'level', value: 18 }
        },
        {
            id: 'theme-gold-rush',
            name: 'Gilded Fortune',
            description: 'Luxurious gold theme with sparkling particles',
            type: 'profile-theme',
            rarity: 'rare',
            cost: 3500,
            colors: {
                primary: '#fbbf24',
                secondary: '#f59e0b',
                accent: '#fcd34d',
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.2) 0%, rgba(245, 158, 11, 0.2) 100%)',
                pageBackground: 'linear-gradient(145deg, #1a1505 0%, #2d2008 50%, #1a1505 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(26, 21, 5, 0.98) 0%, rgba(26, 21, 5, 0.95) 100%)'
            },
            effects: {
                type: 'particles',
                count: 30,
                colors: ['#fbbf24', '#fcd34d', '#fef3c7', '#fffbeb'],
                speed: 'slow',
                opacity: 0.5,
                sparkle: true,
                glow: true,
                size: { min: 2, max: 6 }
            },
            unlockRequirement: { type: 'level', value: 20 }
        },
        {
            id: 'theme-toxic',
            name: 'Radioactive Surge',
            description: 'Neon green radioactive glow effect',
            type: 'profile-theme',
            rarity: 'rare',
            cost: 3500,
            colors: {
                primary: '#84cc16',
                secondary: '#65a30d',
                accent: '#a3e635',
                background: 'linear-gradient(135deg, rgba(132, 204, 22, 0.2) 0%, rgba(101, 163, 13, 0.2) 100%)',
                pageBackground: 'linear-gradient(145deg, #0a1505 0%, #152008 50%, #0a1505 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(10, 21, 5, 0.98) 0%, rgba(10, 21, 5, 0.95) 100%)'
            },
            effects: {
                type: 'particles',
                count: 30,
                colors: ['#84cc16', '#a3e635', '#bef264', '#d9f99d'],
                speed: 'medium',
                opacity: 0.4,
                glow: true,
                pulse: true,
                size: { min: 2, max: 5 }
            },
            unlockRequirement: { type: 'level', value: 22 }
        },

        // ============ 🟣 EPIC THEMES (6) ============
        {
            id: 'theme-aurora',
            name: 'Aurora Borealis',
            description: 'Mystical northern lights with flowing waves',
            type: 'profile-theme',
            rarity: 'epic',
            cost: 6000,
            colors: {
                primary: '#14b8a6',
                secondary: '#a855f7',
                accent: '#2dd4bf',
                background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.15) 0%, rgba(168, 85, 247, 0.15) 100%)',
                pageBackground: 'radial-gradient(ellipse at top, #021515 0%, #0a1a25 30%, #0f0a20 70%, #050510 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(2, 21, 21, 0.98) 0%, rgba(5, 5, 16, 0.95) 100%)'
            },
            effects: {
                type: 'aurora',
                colors: ['#14b8a6', '#a855f7', '#06b6d4', '#8b5cf6', '#22d3ee', '#c084fc'],
                waves: 4,
                speed: 'slow',
                opacity: 0.5,
                blur: 80,
                height: 50,
                movement: 'wave'
            },
            unlockRequirement: { type: 'level', value: 30 }
        },
        {
            id: 'theme-cyber',
            name: 'Cyberpunk 2099',
            description: 'Matrix-style falling code with neon glitch effects',
            type: 'profile-theme',
            rarity: 'epic',
            cost: 7000,
            colors: {
                primary: '#06b6d4',
                secondary: '#d946ef',
                accent: '#22d3ee',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(217, 70, 239, 0.2) 100%)',
                pageBackground: 'radial-gradient(ellipse at bottom, #05101a 0%, #100520 40%, #05101a 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(5, 16, 26, 0.98) 0%, rgba(16, 5, 32, 0.95) 100%)'
            },
            effects: {
                type: 'matrix',
                colors: ['#06b6d4', '#d946ef', '#22d3ee', '#f0abfc'],
                density: 40,
                speed: 'fast',
                opacity: 0.35,
                glitch: true,
                scanlines: true,
                characters: 'NEXUSSIGNAL01アイウエオカキクケコ'
            },
            unlockRequirement: { type: 'level', value: 35 }
        },
        {
            id: 'theme-phoenix',
            name: 'Phoenix Inferno',
            description: 'Rising flames and embers from the ashes',
            type: 'profile-theme',
            rarity: 'epic',
            cost: 7500,
            colors: {
                primary: '#f97316',
                secondary: '#ef4444',
                accent: '#fbbf24',
                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(239, 68, 68, 0.2) 100%)',
                pageBackground: 'radial-gradient(ellipse at bottom, #2d0f05 0%, #1a0805 40%, #0f0502 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(26, 8, 5, 0.98) 0%, rgba(15, 5, 2, 0.95) 100%)'
            },
            effects: {
                type: 'embers',
                colors: ['#f97316', '#ef4444', '#fbbf24', '#fcd34d', '#ffffff'],
                count: 60,
                speed: 'medium',
                opacity: 0.5,
                glow: true,
                rise: true,
                flicker: true,
                size: { min: 2, max: 8 }
            },
            unlockRequirement: { type: 'level', value: 38 }
        },
        {
            id: 'theme-storm',
            name: 'Thunder God',
            description: 'Electric storm with lightning bolts and rain',
            type: 'profile-theme',
            rarity: 'epic',
            cost: 8000,
            colors: {
                primary: '#3b82f6',
                secondary: '#8b5cf6',
                accent: '#60a5fa',
                background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(139, 92, 246, 0.2) 100%)',
                pageBackground: 'radial-gradient(ellipse at top, #050a1a 0%, #0a1030 30%, #050a1a 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(5, 10, 26, 0.98) 0%, rgba(10, 16, 48, 0.95) 100%)'
            },
            effects: {
                type: 'lightning',
                colors: ['#3b82f6', '#8b5cf6', '#60a5fa', '#c4b5fd', '#ffffff'],
                bolts: 4,
                frequency: 3000,
                opacity: 0.6,
                flash: true,
                thunder: true,
                rain: { enabled: true, count: 100, speed: 'fast', opacity: 0.3 }
            },
            unlockRequirement: { type: 'level', value: 40 }
        },
        {
            id: 'theme-neon',
            name: 'Neon Wasteland',
            description: 'Vibrant neon particles with pulsing glow',
            type: 'profile-theme',
            rarity: 'epic',
            cost: 8500,
            colors: {
                primary: '#f43f5e',
                secondary: '#06b6d4',
                accent: '#fb7185',
                background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%)',
                pageBackground: 'radial-gradient(ellipse at center, #1a0510 0%, #050a15 50%, #0a0508 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(26, 5, 16, 0.98) 0%, rgba(5, 10, 21, 0.95) 100%)'
            },
            effects: {
                type: 'particles',
                colors: ['#f43f5e', '#06b6d4', '#fb7185', '#22d3ee', '#fda4af'],
                count: 50,
                speed: 'medium',
                opacity: 0.5,
                glow: true,
                trails: true,
                neonPulse: true,
                size: { min: 3, max: 8 }
            },
            unlockRequirement: { type: 'level', value: 42 }
        },
        {
            id: 'theme-shadow',
            name: 'Shadow Realm',
            description: 'Dark void with drifting shadow particles',
            type: 'profile-theme',
            rarity: 'epic',
            cost: 9000,
            colors: {
                primary: '#7c3aed',
                secondary: '#1e1b4b',
                accent: '#a78bfa',
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(30, 27, 75, 0.9) 100%)',
                pageBackground: 'radial-gradient(ellipse at center, #0f0520 0%, #080210 50%, #020005 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(15, 5, 32, 0.98) 0%, rgba(2, 0, 5, 0.98) 100%)'
            },
            effects: {
                type: 'particles',
                colors: ['#7c3aed', '#a78bfa', '#6366f1', '#818cf8'],
                count: 40,
                speed: 'slow',
                opacity: 0.4,
                glow: true,
                shadows: true,
                drift: true,
                size: { min: 3, max: 10 }
            },
            unlockRequirement: { type: 'level', value: 45 }
        },

        // ============ 🟡 LEGENDARY THEMES (8) ============
        {
            id: 'theme-cosmic',
            name: 'Cosmic Annihilation',
            description: 'Deep space nebula with shooting stars and galaxy spirals',
            type: 'profile-theme',
            rarity: 'legendary',
            cost: 15000,
            colors: {
                primary: '#6366f1',
                secondary: '#0f172a',
                accent: '#a78bfa',
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(6, 6, 39, 0.95) 100%)',
                pageBackground: 'radial-gradient(ellipse at 40% 20%, #0f0a25 0%, #050210 30%, #020108 60%, #000005 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(2, 2, 8, 0.98) 0%, rgba(0, 0, 5, 0.98) 100%)'
            },
            effects: {
                type: 'nebula',
                colors: ['#6366f1', '#a855f7', '#ec4899', '#3b82f6', '#8b5cf6', '#f472b6'],
                clouds: 6,
                stars: 150,
                shootingStars: { enabled: true, frequency: 4000, speed: 'fast', trail: true },
                speed: 'slow',
                opacity: 0.6,
                pulse: true,
                depth: 3,
                galaxySpiral: true
            },
            unlockRequirement: { type: 'level', value: 60 }
        },
        {
            id: 'theme-void-walker',
            name: 'Void Harbinger',
            description: 'Spinning vortex with dark matter tendrils',
            type: 'profile-theme',
            rarity: 'legendary',
            cost: 18000,
            colors: {
                primary: '#7c3aed',
                secondary: '#1e1b4b',
                accent: '#c4b5fd',
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.2) 0%, rgba(30, 27, 75, 0.9) 100%)',
                pageBackground: 'radial-gradient(ellipse at 30% 30%, #1a0a30 0%, #0a0515 25%, #050108 50%, #000000 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(10, 5, 21, 0.98) 0%, rgba(0, 0, 0, 0.98) 100%)'
            },
            effects: {
                type: 'void',
                colors: ['#7c3aed', '#c4b5fd', '#a855f7', '#6366f1', '#ddd6fe'],
                vortex: { enabled: true, speed: 'slow', size: 60, position: { x: 30, y: 30 } },
                particles: 80,
                distortion: true,
                darkMatter: { enabled: true, tendrils: 8, pulse: true },
                speed: 'medium',
                opacity: 0.65,
                blackHole: true
            },
            unlockRequirement: { type: 'level', value: 65 }
        },
        {
            id: 'theme-celestial',
            name: 'Divine Ascension',
            description: 'Holy light rays with golden halos and divine particles',
            type: 'profile-theme',
            rarity: 'legendary',
            cost: 20000,
            colors: {
                primary: '#fbbf24',
                secondary: '#f472b6',
                accent: '#fef3c7',
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.15) 0%, rgba(244, 114, 182, 0.15) 100%)',
                pageBackground: 'radial-gradient(ellipse at top center, #3d2a0a 0%, #1a0a15 25%, #0a0510 50%, #050208 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(26, 15, 8, 0.98) 0%, rgba(10, 5, 16, 0.95) 100%)'
            },
            effects: {
                type: 'celestial',
                colors: ['#fbbf24', '#f472b6', '#fef3c7', '#fbcfe8', '#fde68a', '#ffffff'],
                sunrays: { enabled: true, count: 12, rotation: true, glow: true },
                particles: 70,
                halos: { count: 4, pulse: true, colors: ['#fbbf24', '#f472b6', '#fcd34d'] },
                speed: 'slow',
                opacity: 0.55,
                shimmer: true,
                divineLight: true
            },
            unlockRequirement: { type: 'level', value: 70 }
        },
        {
            id: 'theme-dragon',
            name: 'Dragon Emperor',
            description: 'Intense flames with rising embers and heat distortion',
            type: 'profile-theme',
            rarity: 'legendary',
            cost: 22000,
            colors: {
                primary: '#dc2626',
                secondary: '#fbbf24',
                accent: '#fb923c',
                background: 'linear-gradient(135deg, rgba(220, 38, 38, 0.25) 0%, rgba(251, 191, 36, 0.15) 100%)',
                pageBackground: 'radial-gradient(ellipse at bottom center, #3d0a05 0%, #1a0805 30%, #0f0502 60%, #050200 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(30, 5, 2, 0.98) 0%, rgba(15, 5, 2, 0.95) 100%)'
            },
            effects: {
                type: 'dragon',
                colors: ['#dc2626', '#fb923c', '#fbbf24', '#fef3c7', '#ffffff', '#ef4444'],
                flames: { enabled: true, height: 40, intensity: 'inferno', spread: true },
                embers: { count: 100, rise: true, glow: true, scatter: true },
                smoke: { enabled: true, opacity: 0.2, drift: true },
                intensity: 'extreme',
                speed: 'fast',
                opacity: 0.6,
                heatDistortion: true
            },
            unlockRequirement: { type: 'level', value: 75 }
        },
        {
            id: 'theme-arctic',
            name: 'Eternal Blizzard',
            description: 'Snowstorm with ice crystals and frost effects',
            type: 'profile-theme',
            rarity: 'legendary',
            cost: 22000,
            colors: {
                primary: '#06b6d4',
                secondary: '#a5f3fc',
                accent: '#67e8f9',
                background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(165, 243, 252, 0.1) 100%)',
                pageBackground: 'radial-gradient(ellipse at top, #0a2530 0%, #051520 25%, #020a10 50%, #000508 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(5, 21, 32, 0.98) 0%, rgba(0, 5, 8, 0.98) 100%)'
            },
            effects: {
                type: 'snowflakes',
                colors: ['#06b6d4', '#67e8f9', '#a5f3fc', '#cffafe', '#ffffff', '#e0f2fe'],
                count: 80,
                snowflakes: { enabled: true, variety: 6, rotation: true, size: { min: 4, max: 20 } },
                iceShards: { enabled: true, count: 15, shimmer: true },
                frost: { enabled: true, edges: true, crystals: true },
                breathEffect: true,
                windDirection: 'diagonal',
                speed: 'medium',
                opacity: 0.55,
                blizzard: true
            },
            unlockRequirement: { type: 'level', value: 78 }
        },
        {
            id: 'theme-supernova',
            name: 'Supernova Genesis',
            description: 'Exploding star with cosmic rays and multi-color shooting stars',
            type: 'profile-theme',
            rarity: 'legendary',
            cost: 25000,
            colors: {
                primary: '#f97316',
                secondary: '#6366f1',
                accent: '#fbbf24',
                background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2) 0%, rgba(99, 102, 241, 0.2) 100%)',
                pageBackground: 'radial-gradient(circle at 50% 50%, #2d1505 0%, #1a0f20 25%, #0a0510 50%, #020005 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(26, 10, 5, 0.98) 0%, rgba(2, 0, 5, 0.98) 100%)'
            },
            effects: {
                type: 'nebula',
                colors: ['#f97316', '#6366f1', '#fbbf24', '#a855f7', '#fb923c', '#818cf8'],
                clouds: 5,
                stars: 120,
                shootingStars: { enabled: true, frequency: 3000, speed: 'fast', trail: true, multiColor: true },
                supernova: { enabled: true, pulse: true, rings: 3, position: { x: 50, y: 50 } },
                speed: 'medium',
                opacity: 0.6,
                explosionWaves: true
            },
            unlockRequirement: { type: 'level', value: 85 }
        },
        {
            id: 'theme-quantum',
            name: 'Quantum Rift',
            description: 'Aurora waves with dimensional glitch effects',
            type: 'profile-theme',
            rarity: 'legendary',
            cost: 28000,
            colors: {
                primary: '#14b8a6',
                secondary: '#f43f5e',
                accent: '#2dd4bf',
                background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.2) 0%, rgba(244, 63, 94, 0.2) 100%)',
                pageBackground: 'radial-gradient(ellipse at 60% 40%, #051515 0%, #150510 30%, #0a0808 60%, #020202 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(5, 21, 21, 0.98) 0%, rgba(21, 5, 16, 0.95) 100%)'
            },
            effects: {
                type: 'aurora',
                colors: ['#14b8a6', '#f43f5e', '#2dd4bf', '#fb7185', '#5eead4', '#fda4af'],
                waves: 5,
                speed: 'medium',
                opacity: 0.55,
                blur: 100,
                height: 60,
                movement: 'wave',
                quantumFlicker: true,
                dimensionalRift: { enabled: true, glitch: true, frequency: 5000 }
            },
            unlockRequirement: { type: 'level', value: 90 }
        },
        {
            id: 'theme-abyssal',
            name: 'Abyssal Terror',
            description: 'Deep ocean void with bioluminescent particles',
            type: 'profile-theme',
            rarity: 'legendary',
            cost: 30000,
            colors: {
                primary: '#0f172a',
                secondary: '#3b82f6',
                accent: '#1e3a5f',
                background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 58, 95, 0.3) 100%)',
                pageBackground: 'radial-gradient(ellipse at 50% 80%, #0a1525 0%, #050a15 30%, #020508 60%, #000002 100%)',
                navbarBackground: 'linear-gradient(180deg, rgba(2, 5, 8, 0.99) 0%, rgba(0, 0, 2, 0.99) 100%)'
            },
            effects: {
                type: 'void',
                colors: ['#0f172a', '#3b82f6', '#1e3a5f', '#60a5fa', '#1e40af'],
                vortex: { enabled: true, speed: 'slow', size: 80, position: { x: 50, y: 80 } },
                particles: 40,
                tentacles: { enabled: true, count: 6, sway: true, opacity: 0.3 },
                deepOcean: { enabled: true, bubbles: 30, bioluminescence: true },
                speed: 'slow',
                opacity: 0.5,
                crushing: true
            },
            unlockRequirement: { type: 'level', value: 100 }
        }
    ],

    // ╔══════════════════════════════════════════════════════════════╗
    // ║        🏆 BADGES (26 LEGENDARY ACHIEVEMENTS) 🏆              ║
    // ╚══════════════════════════════════════════════════════════════╝
    badges: [
        // ════════════════════════════════════════════════════════════
        // ⬜ COMMON BADGES (5) - First Steps
        // ════════════════════════════════════════════════════════════
        {
            id: 'badge-first-trade',
            name: 'First Blood',
            description: 'Completed your first ever trade - the journey begins',
            type: 'badge',
            rarity: 'common',
            cost: 0,
            icon: 'target',
            unlockRequirement: { type: 'stats', stat: 'totalTrades', value: 1 }
        },
        {
            id: 'badge-first-profit',
            name: 'Green Candle',
            description: 'Made your first profitable trade',
            type: 'badge',
            rarity: 'common',
            cost: 0,
            icon: 'chart',
            unlockRequirement: { type: 'stats', stat: 'profitableTrades', value: 1 }
        },
        {
            id: 'badge-week-warrior',
            name: 'Week Warrior',
            description: '7 day login streak achieved',
            type: 'badge',
            rarity: 'common',
            cost: 0,
            icon: 'star',
            unlockRequirement: { type: 'stats', stat: 'maxLoginStreak', value: 7 }
        },
        {
            id: 'badge-early-bird',
            name: 'Early Bird',
            description: 'Executed a trade within 5 minutes of market open',
            type: 'badge',
            rarity: 'common',
            cost: 0,
            icon: 'sun',
            unlockRequirement: { type: 'special', value: 'market_open_trade' }
        },
        {
            id: 'badge-night-owl',
            name: 'Night Owl',
            description: 'Made a trade during after-hours (8 PM - 4 AM)',
            type: 'badge',
            rarity: 'common',
            cost: 0,
            icon: 'moon',
            unlockRequirement: { type: 'special', value: 'after_hours_trade' }
        },

        // ════════════════════════════════════════════════════════════
        // 🔵 RARE BADGES (6) - Growing Stronger
        // ════════════════════════════════════════════════════════════
        {
            id: 'badge-trade-master',
            name: 'Trade Master',
            description: 'Completed 500+ trades - a true veteran',
            type: 'badge',
            rarity: 'rare',
            cost: 0,
            icon: 'chart',
            unlockRequirement: { type: 'stats', stat: 'totalTrades', value: 500 }
        },
        {
            id: 'badge-portfolio-builder',
            name: 'Portfolio Architect',
            description: 'Own 10+ different stocks simultaneously',
            type: 'badge',
            rarity: 'rare',
            cost: 0,
            icon: 'gem',
            unlockRequirement: { type: 'stats', stat: 'stocksOwned', value: 10 }
        },
        {
            id: 'badge-streak-lord',
            name: 'Streak Lord',
            description: 'Achieved a 14 day login streak',
            type: 'badge',
            rarity: 'rare',
            cost: 0,
            icon: 'fire',
            unlockRequirement: { type: 'stats', stat: 'maxLoginStreak', value: 14 }
        },
        {
            id: 'badge-risk-taker',
            name: 'Risk Taker',
            description: 'Made a single trade worth over $50,000',
            type: 'badge',
            rarity: 'rare',
            cost: 0,
            icon: 'bolt',
            unlockRequirement: { type: 'stats', stat: 'largestTrade', value: 50000 }
        },
        {
            id: 'badge-diversified',
            name: 'Diversified',
            description: 'Own stocks in 5+ different sectors',
            type: 'badge',
            rarity: 'rare',
            cost: 0,
            icon: 'compass',
            unlockRequirement: { type: 'stats', stat: 'sectorsOwned', value: 5 }
        },
        {
            id: 'badge-comeback-king',
            name: 'Comeback King',
            description: 'Recovered from a 50%+ portfolio loss',
            type: 'badge',
            rarity: 'rare',
            cost: 0,
            icon: 'crown',
            unlockRequirement: { type: 'special', value: 'comeback_50' }
        },

        // ════════════════════════════════════════════════════════════
        // 🟣 EPIC BADGES (6) - Elite Status
        // ════════════════════════════════════════════════════════════
        {
            id: 'badge-oracle',
            name: 'Oracle',
            description: '100+ correct predictions - you see the future',
            type: 'badge',
            rarity: 'epic',
            cost: 0,
            icon: 'eye',
            unlockRequirement: { type: 'stats', stat: 'correctPredictions', value: 100 }
        },
        {
            id: 'badge-diamond-hands',
            name: 'Diamond Hands',
            description: 'Held a position through a 50%+ drawdown and recovered',
            type: 'badge',
            rarity: 'epic',
            cost: 0,
            icon: 'diamond',
            unlockRequirement: { type: 'special', value: 'diamond_hands' }
        },
        {
            id: 'badge-profit-king',
            name: 'Profit King',
            description: 'Earned over $10,000 in total profits',
            type: 'badge',
            rarity: 'epic',
            cost: 0,
            icon: 'crown',
            unlockRequirement: { type: 'stats', stat: 'totalProfit', value: 10000 }
        },
        {
            id: 'badge-dedicated',
            name: 'Dedicated',
            description: '30 day login streak achieved - unbreakable',
            type: 'badge',
            rarity: 'epic',
            cost: 0,
            icon: 'fire',
            unlockRequirement: { type: 'stats', stat: 'maxLoginStreak', value: 30 }
        },
        {
            id: 'badge-speed-demon',
            name: 'Speed Demon',
            description: 'Executed 10 trades in under 60 seconds',
            type: 'badge',
            rarity: 'epic',
            cost: 0,
            icon: 'speedometer',
            unlockRequirement: { type: 'special', value: 'speed_demon' }
        },
        {
            id: 'badge-market-shark',
            name: 'Market Shark',
            description: 'Achieved a 10 win streak on trades',
            type: 'badge',
            rarity: 'epic',
            cost: 0,
            icon: 'shark',
            unlockRequirement: { type: 'stats', stat: 'maxWinStreak', value: 10 }
        },

        // ════════════════════════════════════════════════════════════
        // 🟡 LEGENDARY BADGES (6) - Peak Performance
        // ════════════════════════════════════════════════════════════
        {
            id: 'badge-whale',
            name: 'Whale',
            description: 'Own 100,000+ Nexus Coins - massive wealth',
            type: 'badge',
            rarity: 'legendary',
            cost: 0,
            icon: 'whale',
            unlockRequirement: { type: 'stats', stat: 'nexusCoins', value: 100000 }
        },
        {
            id: 'badge-centurion',
            name: 'Centurion',
            description: 'Reached Level 100 - true dedication',
            type: 'badge',
            rarity: 'legendary',
            cost: 0,
            icon: 'shield',
            unlockRequirement: { type: 'level', value: 100 }
        },
        {
            id: 'badge-millionaire',
            name: 'Millionaire',
            description: 'Portfolio value exceeds $1,000,000',
            type: 'badge',
            rarity: 'legendary',
            cost: 0,
            icon: 'gem',
            unlockRequirement: { type: 'stats', stat: 'portfolioValue', value: 1000000 }
        },
        {
            id: 'badge-unstoppable',
            name: 'Unstoppable',
            description: '100 day login streak - legendary commitment',
            type: 'badge',
            rarity: 'legendary',
            cost: 0,
            icon: 'infinity',
            unlockRequirement: { type: 'stats', stat: 'maxLoginStreak', value: 100 }
        },
        {
            id: 'badge-perfect-week',
            name: 'Perfect Week',
            description: '7 profitable trades in a row - flawless',
            type: 'badge',
            rarity: 'legendary',
            cost: 0,
            icon: 'star',
            unlockRequirement: { type: 'stats', stat: 'maxWinStreak', value: 7 }
        },
        {
            id: 'badge-trading-god',
            name: 'Trading God',
            description: 'Earned $100,000+ in total profits',
            type: 'badge',
            rarity: 'legendary',
            cost: 0,
            icon: 'lightning',
            unlockRequirement: { type: 'stats', stat: 'totalProfit', value: 100000 }
        },

        // ════════════════════════════════════════════════════════════
        // 💎 MYTHIC BADGES (2) - Beyond Mortal
        // ════════════════════════════════════════════════════════════
        {
            id: 'badge-reality-breaker',
            name: 'Reality Breaker',
            description: 'Made $1,000,000+ profit on a single trade - impossible',
            type: 'badge',
            rarity: 'mythic',
            cost: 0,
            icon: 'atom',
            unlockRequirement: { type: 'stats', stat: 'largestProfit', value: 1000000 }
        },
        {
            id: 'badge-eternal-legend',
            name: 'Eternal Legend',
            description: '365 day login streak - one full year of dedication',
            type: 'badge',
            rarity: 'mythic',
            cost: 0,
            icon: 'skull',
            unlockRequirement: { type: 'stats', stat: 'maxLoginStreak', value: 365 }
        },

        // ════════════════════════════════════════════════════════════
        // 🏛️ ORIGIN BADGE (1) - Founders Only
        // ════════════════════════════════════════════════════════════
        {
            id: 'badge-the-architect',
            name: 'The Architect',
            description: 'Those who built the signal from nothing. Unobtainable.',
            type: 'badge',
            rarity: 'origin',
            cost: null,
            obtainable: false,
            icon: 'metatron',
            unlockRequirement: { type: 'founder', value: true }
        }
    ]
};

// Helper function to get all items as a flat array
const getAllItems = () => {
    return [
        ...VAULT_ITEMS.avatarBorders,
        ...VAULT_ITEMS.perks,
        ...VAULT_ITEMS.profileThemes,
        ...VAULT_ITEMS.badges
    ];
};

// Helper function to get item by ID
const getItemById = (id) => {
    return getAllItems().find(item => item.id === id);
};

// Helper function to get items by rarity
const getItemsByRarity = (rarity) => {
    return getAllItems().filter(item => item.rarity === rarity);
};

// Helper function to get items by type
const getItemsByType = (type) => {
    return getAllItems().filter(item => item.type === type);
};

module.exports = { 
    VAULT_ITEMS,
    getAllItems,
    getItemById,
    getItemsByRarity,
    getItemsByType
};