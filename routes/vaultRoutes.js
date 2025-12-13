// server/routes/vaultRoutes.js - UPDATED TO USE USER.GAMIFICATION
// Handles: Browsing, Purchasing, Equipping, and Managing Vault Items

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const User = require('../models/User');

// Import badge mapping to merge gamification badges
let BADGE_MAPPING;
try {
    BADGE_MAPPING = require('../config/badgeMapping').BADGE_MAPPING;
    console.log('[Vault] Loaded badge mapping:', Object.keys(BADGE_MAPPING).length, 'badges');
} catch (error) {
    console.error('[Vault] Could not load badgeMapping:', error.message);
    BADGE_MAPPING = {};
}

// Import vault items - make sure this file exists at server/data/vaultItems.js
let VAULT_ITEMS;
try {
    VAULT_ITEMS = require('../data/vaultItems').VAULT_ITEMS;
    console.log('[Vault] FIRST THEME NAME:', VAULT_ITEMS.profileThemes?.[0]?.name);
    console.log('[Vault] LAST THEME NAME:', VAULT_ITEMS.profileThemes?.[VAULT_ITEMS.profileThemes.length - 1]?.name);
    console.log('[Vault] Loaded vault items successfully');
    console.log('[Vault] Borders:', VAULT_ITEMS.avatarBorders?.length || 0);
    console.log('[Vault] Themes:', VAULT_ITEMS.profileThemes?.length || 0);
    console.log('[Vault] Badges:', VAULT_ITEMS.badges?.length || 0);
    console.log('[Vault] Perks:', VAULT_ITEMS.perks?.length || 0);
} catch (error) {
    console.error('[Vault] ERROR: Could not load vaultItems.js:', error.message);
    console.error('[Vault] Make sure the file exists at server/data/vaultItems.js');
    // Fallback empty items
    VAULT_ITEMS = {
        avatarBorders: [],
        perks: [],
        profileThemes: [],
        badges: []
    };
}

// Helper: Get user ID from request (handles both _id and id)
const getUserId = (req) => req.user._id || req.user.id;

// ✅ Helper: Get gamification stats from USER.GAMIFICATION (single source of truth)
const getGamificationStats = async (userId) => {
    try {
        const user = await User.findById(userId).select('gamification');
        
        if (user && user.gamification) {
            const level = user.gamification.level || 1;
            const coins = user.gamification.nexusCoins || 0;
            console.log(`[Vault] Found User.gamification: Level ${level}, Coins ${coins}`);
            return {
                level: level,
                nexusCoins: coins,
                xp: user.gamification.xp || 0
            };
        }
        
        console.log('[Vault] No User.gamification found');
        return { level: 1, nexusCoins: 0, xp: 0 };
    } catch (error) {
        console.error('[Vault] Error getting gamification stats:', error);
        return { level: 1, nexusCoins: 0, xp: 0 };
    }
};

// ✅ Helper: Update user coins in USER.GAMIFICATION (single source of truth)
const updateUserCoins = async (userId, newCoinAmount) => {
    try {
        const user = await User.findById(userId);
        
        if (user) {
            // Use the User model's addCoins method for tracking
            // But since we're subtracting, we'll do it manually
            if (!user.gamification) user.gamification = {};
            user.gamification.nexusCoins = newCoinAmount;
            await user.save();
            console.log(`[Vault] Updated User.gamification coins to ${newCoinAmount}`);
            return true;
        }
        
        console.error('[Vault] No User found to update coins');
        return false;
    } catch (error) {
        console.error('[Vault] Error updating coins:', error);
        return false;
    }
};

// Helper: Get all items flattened
const getAllItems = () => {
    return [
        ...(VAULT_ITEMS.avatarBorders || []),
        ...(VAULT_ITEMS.perks || []),
        ...(VAULT_ITEMS.profileThemes || []),
        ...(VAULT_ITEMS.badges || [])
    ];
};

// Helper: Find item by ID (checks VAULT_ITEMS and BADGE_MAPPING)
const findItemById = (itemId) => {
    const allItems = getAllItems();
    let item = allItems.find(item => item.id === itemId);

    // If not found in VAULT_ITEMS and it's a badge, check BADGE_MAPPING
    if (!item && itemId.startsWith('badge-') && BADGE_MAPPING[itemId]) {
        const badgeConfig = BADGE_MAPPING[itemId];
        item = {
            id: itemId,
            name: badgeConfig.name || itemId.replace('badge-', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            description: badgeConfig.description || 'Special badge',
            type: 'badge',
            rarity: badgeConfig.rarity || 'legendary',
            cost: 0,
            icon: 'award'
        };
    }

    return item;
};

// ✅ Helper: Check if user meets unlock requirements (using real level)
const meetsRequirements = (userLevel, userStats, requirement) => {
    if (!requirement) return true;
    
    switch (requirement.type) {
        case 'level':
            const result = userLevel >= requirement.value;
            console.log(`[Vault] Level check: User level ${userLevel} >= required ${requirement.value}? ${result}`);
            return result;
        case 'stats':
            return (userStats?.[requirement.stat] || 0) >= requirement.value;
        case 'special':
            // Special requirements handled separately
            return false;
        default:
            return true;
    }
};

// Helper: Check special requirements (founder, etc)
const meetsSpecialRequirement = (user, requirement) => {
    if (!requirement || requirement.type !== 'special') return true;
    
    if (requirement.value === 'founder') {
        return user.isFounder || user.createdAt < new Date('2025-06-01');
    }
    return false;
};

// Helper: Initialize user vault if needed
const initializeUserVault = (user) => {
    if (!user.vault) {
        user.vault = {
            ownedItems: ['border-bronze', 'theme-default'], // Free starter items
            equippedBorder: 'border-bronze',
            equippedTheme: 'theme-default',
            equippedBadges: [],
            activePerks: []
        };
    }
    
    // Ensure arrays exist
    if (!user.vault.ownedItems) user.vault.ownedItems = ['border-bronze', 'theme-default'];
    if (!user.vault.equippedBadges) user.vault.equippedBadges = [];
    if (!user.vault.activePerks) user.vault.activePerks = [];
    
    return user.vault;
};

// @route   GET /api/vault/badges
// @desc    Get user's owned badges and equipped badge
// @access  Private
router.get('/badges', auth, async (req, res) => {
    try {
        const user = await User.findById(getUserId(req));
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Initialize vault if needed
        const vault = await ensureVault(user);

        // Get all badge items
        const allBadges = VAULT_ITEMS.badges || [];

        // Filter to only owned badges
        const ownedBadgeIds = (vault.ownedItems || []).filter(id => id.startsWith('badge-'));
        const ownedBadges = allBadges.filter(badge => ownedBadgeIds.includes(badge.id));

        // Also include gamification badges from BADGE_MAPPING
        const gamificationBadges = [];
        if (user.gamification?.badges) {
            for (const badgeId of user.gamification.badges) {
                const badgeInfo = BADGE_MAPPING[badgeId];
                if (badgeInfo) {
                    gamificationBadges.push({
                        id: badgeId,
                        name: badgeInfo.name,
                        description: badgeInfo.description,
                        icon: badgeInfo.icon,
                        rarity: badgeInfo.rarity || 'common',
                        type: 'achievement'
                    });
                }
            }
        }

        // Combine vault badges and gamification badges
        const allOwnedBadges = [...ownedBadges, ...gamificationBadges];

        // Get equipped badge
        const equippedBadgeId = vault.equippedBadges?.[0] || user.gamification?.equippedBadge || null;
        let equippedBadge = null;
        if (equippedBadgeId) {
            equippedBadge = allOwnedBadges.find(b => b.id === equippedBadgeId) || null;
        }

        res.json({
            badges: allOwnedBadges,
            ownedBadges: allOwnedBadges,
            equippedBadge: equippedBadge
        });
    } catch (error) {
        console.error('[Vault] Error getting badges:', error);
        res.status(500).json({ error: 'Failed to get badges' });
    }
});

// @route   GET /api/vault/items
// @desc    Get all vault items with user ownership status
// @access  Private
router.get('/items', auth, async (req, res) => {
    try {
        console.log('[Vault] GET /items called');
        console.log('[Vault] RUNTIME CHECK - Themes count:', VAULT_ITEMS.profileThemes?.length);
        console.log('[Vault] RUNTIME CHECK - First theme:', VAULT_ITEMS.profileThemes?.[0]?.name);
        
        const user = await User.findById(getUserId(req));
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // ✅ Get REAL gamification stats from USER.GAMIFICATION
        const gamificationStats = await getGamificationStats(user._id);
        const userLevel = gamificationStats.level;
        const userCoins = gamificationStats.nexusCoins;
        
        console.log(`[Vault] User ${user.username}: Real Level ${userLevel}, Real Coins ${userCoins}`);

        // Initialize vault
        const vault = initializeUserVault(user);
        
        // Save user if vault was just initialized
        if (!user.vault || !user.vault.ownedItems) {
            user.vault = vault;
            await user.save();
            console.log(`[Vault] Saved initialized vault for user ${user.username}`);
        }

        console.log(`[Vault] Items available - Borders: ${VAULT_ITEMS.avatarBorders?.length}, Themes: ${VAULT_ITEMS.profileThemes?.length}, Badges: ${VAULT_ITEMS.badges?.length}, Perks: ${VAULT_ITEMS.perks?.length}`);

        // Build response with ownership and unlock status
        const buildItemsWithStatus = (items) => {
            if (!items || !Array.isArray(items)) {
                console.log('[Vault] Warning: items is not an array');
                return [];
            }
            return items.map(item => {
                // Check requirements using REAL level
                let canUnlock = true;
                if (item.unlockRequirement) {
                    if (item.unlockRequirement.type === 'special') {
                        canUnlock = meetsSpecialRequirement(user, item.unlockRequirement);
                    } else {
                        canUnlock = meetsRequirements(userLevel, user.stats, item.unlockRequirement);
                    }
                }
                
                return {
                    ...item,
                    owned: vault.ownedItems.includes(item.id),
                    equipped: 
                        vault.equippedBorder === item.id ||
                        vault.equippedTheme === item.id ||
                        vault.equippedBadges?.includes(item.id) ||
                        vault.activePerks?.includes(item.id),
                    canUnlock,
                    canAfford: userCoins >= item.cost
                };
            });
        };

        // Merge ALL badge sources with vault badges
        // Sources: gamification.badges, vault.equippedBadges, vault.ownedItems (badge-*)
        const gamificationBadges = user.gamification?.badges || [];
        const equippedBadges = vault.equippedBadges || [];
        const ownedBadgeItems = (vault.ownedItems || []).filter(id => id.startsWith('badge-'));

        // Combine all badge sources (deduplicated)
        const allUserBadges = [...new Set([...gamificationBadges, ...equippedBadges, ...ownedBadgeItems])];

        const vaultBadgeIds = (VAULT_ITEMS.badges || []).map(b => b.id);

        // Create badge entries for badges not in vault items
        const extraBadges = allUserBadges
            .filter(badgeId => !vaultBadgeIds.includes(badgeId))
            .map(badgeId => {
                const config = BADGE_MAPPING[badgeId] || {};
                return {
                    id: badgeId,
                    name: config.name || badgeId.replace('badge-', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                    description: config.description || 'Special badge',
                    type: 'badge',
                    rarity: config.rarity || 'legendary',
                    cost: 0,
                    icon: 'award',
                    // These are owned if they're in any of our sources
                    owned: true,
                    equipped: equippedBadges.includes(badgeId),
                    canUnlock: true,
                    canAfford: true
                };
            });

        // Build vault badges with status, then add extra badges
        const allBadges = [
            ...buildItemsWithStatus(VAULT_ITEMS.badges || []),
            ...extraBadges
        ];

        console.log(`[Vault] User badges - Gamification: ${gamificationBadges.length}, Equipped: ${equippedBadges.length}, Owned: ${ownedBadgeItems.length}, Extra added: ${extraBadges.length}`);

        const responseData = {
            success: true,
            userCoins: userCoins,
            userLevel: userLevel,
            vault: {
                equippedBorder: vault.equippedBorder || 'border-bronze',
                equippedTheme: vault.equippedTheme || 'theme-default',
                equippedBadges: vault.equippedBadges || [],
                activePerks: vault.activePerks || []
            },
            items: {
                avatarBorders: buildItemsWithStatus(VAULT_ITEMS.avatarBorders || []),
                perks: buildItemsWithStatus(VAULT_ITEMS.perks || []),
                profileThemes: buildItemsWithStatus(VAULT_ITEMS.profileThemes || []),
                badges: allBadges
            }
        };

        console.log(`[Vault] Returning - Level: ${responseData.userLevel}, Coins: ${responseData.userCoins}`);
        console.log(`[Vault] Returning ${responseData.items.avatarBorders.length} borders, ${responseData.items.profileThemes.length} themes`);
        
        res.json(responseData);
    } catch (error) {
        console.error('[Vault] Get items error:', error);
        res.status(500).json({ error: 'Failed to fetch vault items', details: error.message });
    }
});

// @route   GET /api/vault/owned
// @desc    Get user's owned items only
// @access  Private
router.get('/owned', auth, async (req, res) => {
    try {
        const user = await User.findById(getUserId(req));
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const vault = initializeUserVault(user);
        const allItems = getAllItems();
        
        const ownedItems = allItems.filter(item => vault.ownedItems.includes(item.id));

        res.json({
            success: true,
            ownedItems,
            equipped: {
                border: vault.equippedBorder,
                theme: vault.equippedTheme,
                badges: vault.equippedBadges || [],
                perks: vault.activePerks || []
            }
        });
    } catch (error) {
        console.error('[Vault] Get owned error:', error);
        res.status(500).json({ error: 'Failed to fetch owned items' });
    }
});

// @route   POST /api/vault/purchase/:itemId
// @desc    Purchase a vault item with Nexus Coins
// @access  Private
router.post('/purchase/:itemId', auth, async (req, res) => {
    try {
        const { itemId } = req.params;
        const user = await User.findById(getUserId(req));
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const item = findItemById(itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const vault = initializeUserVault(user);

        // Check if already owned
        if (vault.ownedItems.includes(itemId)) {
            return res.status(400).json({ error: 'You already own this item' });
        }

        // ✅ Get REAL gamification stats from USER.GAMIFICATION
        const gamificationStats = await getGamificationStats(user._id);
        const userLevel = gamificationStats.level;
        const userCoins = gamificationStats.nexusCoins;
        
        console.log(`[Vault] Purchase check - User ${user.username}: Level ${userLevel}, Coins ${userCoins}`);

        // Check unlock requirements using REAL level
        if (item.unlockRequirement) {
            let canUnlock = true;
            if (item.unlockRequirement.type === 'special') {
                canUnlock = meetsSpecialRequirement(user, item.unlockRequirement);
            } else {
                canUnlock = meetsRequirements(userLevel, user.stats, item.unlockRequirement);
            }
            
            if (!canUnlock) {
                return res.status(400).json({ 
                    error: 'You do not meet the requirements to unlock this item',
                    requirement: item.unlockRequirement,
                    yourLevel: userLevel
                });
            }
        }

        // Check if can afford using REAL coins
        if (userCoins < item.cost) {
            return res.status(400).json({ 
                error: 'Not enough Nexus Coins',
                required: item.cost,
                current: userCoins
            });
        }

        // Calculate new coin balance
        const newCoinBalance = userCoins - item.cost;
        
        // ✅ Update coins in USER.GAMIFICATION
        const coinsUpdated = await updateUserCoins(user._id, newCoinBalance);
        if (!coinsUpdated) {
            console.error('[Vault] Failed to update coins!');
            return res.status(500).json({ error: 'Failed to process payment. Please try again.' });
        }

        // Add item to owned items
        vault.ownedItems.push(itemId);
        user.vault = vault;

        // Add to purchase history
        if (!user.vault.purchaseHistory) user.vault.purchaseHistory = [];
        user.vault.purchaseHistory.push({
            itemId,
            itemName: item.name,
            cost: item.cost,
            purchasedAt: new Date()
        });

        await user.save();

        console.log(`[Vault] User ${user.username} purchased ${item.name} for ${item.cost} coins. New balance: ${newCoinBalance}`);

        res.json({
            success: true,
            message: `Successfully purchased ${item.name}!`,
            item: {
                ...item,
                owned: true
            },
            remainingCoins: newCoinBalance
        });
    } catch (error) {
        console.error('[Vault] Purchase error:', error);
        res.status(500).json({ error: 'Failed to purchase item' });
    }
});

// @route   POST /api/vault/equip/:itemId
// @desc    Equip a vault item
// @access  Private
router.post('/equip/:itemId', auth, async (req, res) => {
    try {
        const { itemId } = req.params;
        const user = await User.findById(getUserId(req));
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const item = findItemById(itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const vault = initializeUserVault(user);

        // Check if owned (unless it's a free item)
        if (!vault.ownedItems.includes(itemId)) {
            if (item.cost > 0) {
                return res.status(400).json({ error: 'You do not own this item' });
            }
            // Free item - add to ownedItems when claiming
            vault.ownedItems.push(itemId);
            console.log(`[Vault] Free item ${itemId} claimed by ${user.username}`);
        }

        // Equip based on type
        switch (item.type) {
            case 'avatar-border':
                vault.equippedBorder = itemId;
                break;
            case 'profile-theme':
                vault.equippedTheme = itemId;
                break;
            case 'badge':
                // Can equip up to 5 badges
                if (!vault.equippedBadges) vault.equippedBadges = [];
                if (!vault.equippedBadges.includes(itemId)) {
                    if (vault.equippedBadges.length >= 5) {
                        return res.status(400).json({ 
                            error: 'Maximum 5 badges can be displayed. Unequip one first.' 
                        });
                    }
                    vault.equippedBadges.push(itemId);
                }
                break;
            case 'perk':
                // Can have up to 3 active perks
                if (!vault.activePerks) vault.activePerks = [];
                if (!vault.activePerks.includes(itemId)) {
                    if (vault.activePerks.length >= 3) {
                        return res.status(400).json({ 
                            error: 'Maximum 3 perks can be active. Deactivate one first.' 
                        });
                    }
                    vault.activePerks.push(itemId);
                }
                break;
            default:
                return res.status(400).json({ error: 'Invalid item type' });
        }

        user.vault = vault;
        await user.save();

        console.log(`[Vault] User ${user.username} equipped ${item.name}`);

        res.json({
            success: true,
            message: `${item.name} equipped!`,
            equipped: {
                border: vault.equippedBorder,
                theme: vault.equippedTheme,
                badges: vault.equippedBadges,
                perks: vault.activePerks
            }
        });
    } catch (error) {
        console.error('[Vault] Equip error:', error);
        res.status(500).json({ error: 'Failed to equip item' });
    }
});

// @route   POST /api/vault/unequip/:itemId
// @desc    Unequip a vault item
// @access  Private
router.post('/unequip/:itemId', auth, async (req, res) => {
    try {
        const { itemId } = req.params;
        const user = await User.findById(getUserId(req));
        
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const item = findItemById(itemId);
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }

        const vault = initializeUserVault(user);

        // Unequip based on type
        switch (item.type) {
            case 'avatar-border':
                // Can't unequip border, must equip a different one
                // Default to bronze
                vault.equippedBorder = 'border-bronze';
                break;
            case 'profile-theme':
                // Default to default theme
                vault.equippedTheme = 'theme-default';
                break;
            case 'badge':
                vault.equippedBadges = (vault.equippedBadges || []).filter(id => id !== itemId);
                break;
            case 'perk':
                vault.activePerks = (vault.activePerks || []).filter(id => id !== itemId);
                break;
            default:
                return res.status(400).json({ error: 'Invalid item type' });
        }

        user.vault = vault;
        await user.save();

        console.log(`[Vault] User ${user.username} unequipped ${item.name}`);

        res.json({
            success: true,
            message: `${item.name} unequipped!`,
            equipped: {
                border: vault.equippedBorder,
                theme: vault.equippedTheme,
                badges: vault.equippedBadges,
                perks: vault.activePerks
            }
        });
    } catch (error) {
        console.error('[Vault] Unequip error:', error);
        res.status(500).json({ error: 'Failed to unequip item' });
    }
});

// @route   GET /api/vault/equipped
// @desc    Get user's currently equipped items with full details
// @access  Private
router.get('/equipped', auth, async (req, res) => {
    try {
        const user = await User.findById(getUserId(req));
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        const vault = initializeUserVault(user);
        
        // Get full item details for equipped items
        const equippedBorder = VAULT_ITEMS.avatarBorders?.find(b => b.id === vault.equippedBorder) || null;
        const equippedTheme = VAULT_ITEMS.profileThemes?.find(t => t.id === vault.equippedTheme) || null;
        const equippedBadges = (vault.equippedBadges || [])
            .map(id => VAULT_ITEMS.badges?.find(b => b.id === id))
            .filter(Boolean);
        const activePerks = (vault.activePerks || [])
            .map(id => VAULT_ITEMS.perks?.find(p => p.id === id))
            .filter(Boolean);

        res.json({
            success: true,
            equipped: {
                border: equippedBorder,
                theme: equippedTheme,
                badges: equippedBadges,
                perks: activePerks
            }
        });
    } catch (error) {
        console.error('[Vault] Get equipped error:', error);
        res.status(500).json({ success: false, error: 'Failed to fetch equipped items' });
    }
});

// @route   GET /api/vault/user/:userId
// @desc    Get another user's equipped items (for profile viewing)
// @access  Public
router.get('/user/:userId', async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('vault gamification username');
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const vault = user.vault || {
            equippedBorder: 'border-bronze',
            equippedTheme: 'theme-default',
            equippedBadges: [],
            activePerks: []
        };

        // Get full item details
        const equippedBorder = VAULT_ITEMS.avatarBorders?.find(b => b.id === vault.equippedBorder) || null;
        const equippedTheme = VAULT_ITEMS.profileThemes?.find(t => t.id === vault.equippedTheme) || null;
        const equippedBadges = (vault.equippedBadges || [])
            .map(id => VAULT_ITEMS.badges?.find(b => b.id === id))
            .filter(Boolean);

        res.json({
            success: true,
            username: user.username,
            level: user.gamification?.level || 1,
            equipped: {
                border: equippedBorder,
                theme: equippedTheme,
                badges: equippedBadges
            }
        });
    } catch (error) {
        console.error('[Vault] Get user equipped error:', error);
        res.status(500).json({ error: 'Failed to fetch user items' });
    }
});

// @route   GET /api/vault/active-perks
// @desc    Get user's active perks with effects (for game calculations)
// @access  Private
router.get('/active-perks', auth, async (req, res) => {
    try {
        const user = await User.findById(getUserId(req));
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const vault = initializeUserVault(user);
        const activePerks = (vault.activePerks || [])
            .map(id => VAULT_ITEMS.perks?.find(p => p.id === id))
            .filter(Boolean);

        // Calculate combined effects
        const effects = {
            xp_bonus: 0,
            coin_bonus: 0,
            profit_bonus: 0,
            streak_protection: 0,
            extra_daily: 0
        };

        activePerks.forEach(perk => {
            if (perk.effect) {
                effects[perk.effect.type] = (effects[perk.effect.type] || 0) + perk.effect.value;
            }
        });

        res.json({
            success: true,
            activePerks,
            combinedEffects: effects
        });
    } catch (error) {
        console.error('[Vault] Get active perks error:', error);
        res.status(500).json({ error: 'Failed to fetch active perks' });
    }
});

// @route   GET /api/vault/stats
// @desc    Get vault statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
    try {
        const user = await User.findById(getUserId(req));
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const vault = initializeUserVault(user);
        const allItems = getAllItems();
        
        const ownedCount = vault.ownedItems.length;
        const totalCount = allItems.length;
        const totalSpent = (vault.purchaseHistory || []).reduce((sum, p) => sum + p.cost, 0);

        // Count by rarity
        const ownedByRarity = {
            common: 0,
            rare: 0,
            epic: 0,
            legendary: 0
        };

        vault.ownedItems.forEach(itemId => {
            const item = findItemById(itemId);
            if (item && item.rarity) {
                ownedByRarity[item.rarity] = (ownedByRarity[item.rarity] || 0) + 1;
            }
        });

        // Count by type
        const ownedByType = {
            'avatar-border': 0,
            'profile-theme': 0,
            'badge': 0,
            'perk': 0
        };

        vault.ownedItems.forEach(itemId => {
            const item = findItemById(itemId);
            if (item && item.type) {
                ownedByType[item.type] = (ownedByType[item.type] || 0) + 1;
            }
        });

        res.json({
            success: true,
            stats: {
                ownedCount,
                totalCount,
                completionPercent: ((ownedCount / totalCount) * 100).toFixed(1),
                totalSpent,
                ownedByRarity,
                ownedByType,
                purchaseHistory: (vault.purchaseHistory || []).slice(-10) // Last 10 purchases
            }
        });
    } catch (error) {
        console.error('[Vault] Get stats error:', error);
        res.status(500).json({ error: 'Failed to fetch vault stats' });
    }
});

// @route   POST /api/vault/check-badges
// @desc    Check and award earned badges based on user stats
// @access  Private
router.post('/check-badges', auth, async (req, res) => {
    try {
        const user = await User.findById(getUserId(req));
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const vault = initializeUserVault(user);
        const gamificationStats = await getGamificationStats(user._id);
        const userLevel = gamificationStats.level;
        const newBadges = [];

        // Check each badge's requirements
        for (const badge of (VAULT_ITEMS.badges || [])) {
            // Skip if already owned
            if (vault.ownedItems.includes(badge.id)) continue;
            
            // Check if requirements are met
            if (meetsRequirements(userLevel, user.stats, badge.unlockRequirement)) {
                vault.ownedItems.push(badge.id);
                newBadges.push(badge);
                console.log(`[Vault] User ${user.username} earned badge: ${badge.name}`);
            }
        }

        if (newBadges.length > 0) {
            user.vault = vault;
            await user.save();
        }

        res.json({
            success: true,
            newBadges,
            message: newBadges.length > 0 
                ? `Congratulations! You earned ${newBadges.length} new badge(s)!` 
                : 'No new badges earned'
        });
    } catch (error) {
        console.error('[Vault] Check badges error:', error);
        res.status(500).json({ error: 'Failed to check badges' });
    }
});

module.exports = router;