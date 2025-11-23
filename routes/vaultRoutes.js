// server/routes/vaultRoutes.js - ENHANCED with better debugging
const express = require('express');
const router = express.Router();
const protect = require('../middleware/authMiddleware');
const Gamification = require('../models/Gamification');
const { VAULT_ITEMS } = require('../data/vaultItems');

// @route   GET /api/vault/items
// @desc    Get all vault items with ownership status
// @access  Private
router.get('/items', protect, async (req, res) => {
    try {
        console.log('📦 Fetching vault items for user:', req.user._id);
        
        const gamification = await Gamification.findOne({ user: req.user._id });
        
        if (!gamification) {
            console.log('❌ Gamification data not found for user:', req.user._id);
            return res.status(404).json({ success: false, message: 'Gamification data not found' });
        }

        const ownedItemIds = gamification.ownedItems ? gamification.ownedItems.map(item => item.itemId) : [];
        
        console.log('✅ Owned items:', ownedItemIds.length);
        console.log('✅ Equipped items:', gamification.equippedItems);
        
        // Combine all items and add ownership + unlock status
        const allItems = [
            ...VAULT_ITEMS.avatarBorders,
            ...VAULT_ITEMS.perks,
            ...VAULT_ITEMS.profileThemes,
            ...VAULT_ITEMS.badges
        ].map(item => ({
            ...item,
            owned: ownedItemIds.includes(item.id) || item.cost === 0,
            equipped: isItemEquipped(item.id, gamification.equippedItems),
            canUnlock: checkUnlockRequirement(item.unlockRequirement, gamification)
        }));

        console.log('✅ Total items:', allItems.length);
        console.log('✅ Equipped count:', allItems.filter(i => i.equipped).length);

        res.json({
            success: true,
            items: allItems,
            equippedItems: gamification.equippedItems || {},
            nexusCoins: gamification.nexusCoins
        });
    } catch (error) {
        console.error('❌ Error fetching vault items:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// @route   POST /api/vault/purchase/:itemId
// @desc    Purchase an item
// @access  Private
router.post('/purchase/:itemId', protect, async (req, res) => {
    try {
        console.log('💰 Purchase attempt for item:', req.params.itemId);
        
        const gamification = await Gamification.findOne({ user: req.user._id });
        
        if (!gamification) {
            return res.status(404).json({ success: false, message: 'Gamification data not found' });
        }

        const item = findItemById(req.params.itemId);
        
        if (!item) {
            console.log('❌ Item not found:', req.params.itemId);
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        // Initialize ownedItems if it doesn't exist
        if (!gamification.ownedItems) {
            gamification.ownedItems = [];
        }

        // Check if already owned
        if (gamification.ownedItems.some(oi => oi.itemId === item.id)) {
            console.log('⚠️ Item already owned:', item.id);
            return res.status(400).json({ success: false, message: 'Item already owned' });
        }

        // Check unlock requirements
        if (!checkUnlockRequirement(item.unlockRequirement, gamification)) {
            console.log('🔒 Unlock requirements not met for:', item.id);
            return res.status(403).json({ 
                success: false, 
                message: 'Unlock requirements not met',
                requirement: item.unlockRequirement
            });
        }

        // Check if user has enough coins
        if (gamification.nexusCoins < item.cost) {
            console.log('💸 Insufficient coins:', gamification.nexusCoins, '<', item.cost);
            return res.status(400).json({ 
                success: false, 
                message: 'Insufficient Nexus Coins',
                required: item.cost,
                current: gamification.nexusCoins
            });
        }

        // Deduct coins and add item
        gamification.nexusCoins -= item.cost;
        gamification.ownedItems.push({
            itemId: item.id,
            type: item.type,
            purchasedAt: new Date()
        });

        await gamification.save();

        console.log('✅ Item purchased successfully:', item.name);

        res.json({
            success: true,
            message: `${item.name} purchased successfully!`,
            nexusCoins: gamification.nexusCoins,
            item: item
        });
    } catch (error) {
        console.error('❌ Error purchasing item:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// @route   POST /api/vault/equip/:itemId
// @desc    Equip an item
// @access  Private
router.post('/equip/:itemId', protect, async (req, res) => {
    try {
        console.log('⚡ Equip attempt for item:', req.params.itemId, 'by user:', req.user._id);
        
        const gamification = await Gamification.findOne({ user: req.user._id });
        
        if (!gamification) {
            console.log('❌ Gamification data not found');
            return res.status(404).json({ success: false, message: 'Gamification data not found' });
        }

        const item = findItemById(req.params.itemId);
        
        if (!item) {
            console.log('❌ Item not found:', req.params.itemId);
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        console.log('📋 Item to equip:', item.name, 'Type:', item.type);

        // Initialize arrays if they don't exist
        if (!gamification.ownedItems) {
            gamification.ownedItems = [];
        }

        // Check if owned
        const owned = gamification.ownedItems.some(oi => oi.itemId === item.id) || item.cost === 0;
        
        if (!owned) {
            console.log('❌ Item not owned:', item.id);
            return res.status(403).json({ success: false, message: 'Item not owned' });
        }

        // Initialize equippedItems if it doesn't exist
        if (!gamification.equippedItems) {
            console.log('🔧 Initializing equippedItems object');
            gamification.equippedItems = {
                avatarBorder: null,
                profileTheme: 'theme-default',
                activePerk: null,
                badges: []
            };
        }

        console.log('📦 Before equip:', JSON.stringify(gamification.equippedItems));

        // Equip based on type
        switch (item.type) {
            case 'avatar-border':
                gamification.equippedItems.avatarBorder = item.id;
                console.log('✅ Equipped avatar border:', item.id);
                break;
            case 'profile-theme':
                gamification.equippedItems.profileTheme = item.id;
                console.log('✅ Equipped profile theme:', item.id);
                break;
            case 'perk':
                gamification.equippedItems.activePerk = item.id;
                console.log('✅ Equipped perk:', item.id);
                break;
            case 'badge':
                if (!gamification.equippedItems.badges) {
                    gamification.equippedItems.badges = [];
                }
                if (gamification.equippedItems.badges.length >= 3) {
                    console.log('⚠️ Maximum 3 badges already equipped');
                    return res.status(400).json({ success: false, message: 'Maximum 3 badges can be equipped' });
                }
                if (!gamification.equippedItems.badges.includes(item.id)) {
                    gamification.equippedItems.badges.push(item.id);
                    console.log('✅ Equipped badge:', item.id);
                }
                break;
            default:
                console.log('❌ Invalid item type:', item.type);
                return res.status(400).json({ success: false, message: 'Invalid item type' });
        }

        console.log('📦 After equip:', JSON.stringify(gamification.equippedItems));

        // Mark as modified and save
        gamification.markModified('equippedItems');
        await gamification.save();

        console.log('💾 Saved to database');

        // Verify save
        const verifyGamification = await Gamification.findOne({ user: req.user._id });
        console.log('✔️ Verified equipped items after save:', JSON.stringify(verifyGamification.equippedItems));

        res.json({
            success: true,
            message: `${item.name} equipped successfully!`,
            equippedItems: gamification.equippedItems
        });
    } catch (error) {
        console.error('❌ Error equipping item:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// @route   POST /api/vault/unequip/:itemId
// @desc    Unequip an item
// @access  Private
router.post('/unequip/:itemId', protect, async (req, res) => {
    try {
        console.log('🔓 Unequip attempt for item:', req.params.itemId);
        
        const gamification = await Gamification.findOne({ user: req.user._id });
        
        if (!gamification) {
            console.log('❌ Gamification data not found');
            return res.status(404).json({ success: false, message: 'Gamification data not found' });
        }

        const item = findItemById(req.params.itemId);
        
        if (!item) {
            console.log('❌ Item not found:', req.params.itemId);
            return res.status(404).json({ success: false, message: 'Item not found' });
        }

        if (!gamification.equippedItems) {
            console.log('⚠️ No items equipped');
            return res.status(400).json({ success: false, message: 'No items equipped' });
        }

        console.log('📦 Before unequip:', JSON.stringify(gamification.equippedItems));

        // Unequip based on type
        switch (item.type) {
            case 'avatar-border':
                gamification.equippedItems.avatarBorder = null;
                console.log('✅ Unequipped avatar border');
                break;
            case 'profile-theme':
                gamification.equippedItems.profileTheme = 'theme-default';
                console.log('✅ Unequipped profile theme (reverted to default)');
                break;
            case 'perk':
                gamification.equippedItems.activePerk = null;
                console.log('✅ Unequipped perk');
                break;
            case 'badge':
                if (gamification.equippedItems.badges) {
                    gamification.equippedItems.badges = gamification.equippedItems.badges.filter(
                        badgeId => badgeId !== item.id
                    );
                    console.log('✅ Unequipped badge');
                }
                break;
            default:
                console.log('❌ Invalid item type:', item.type);
                return res.status(400).json({ success: false, message: 'Invalid item type' });
        }

        console.log('📦 After unequip:', JSON.stringify(gamification.equippedItems));

        gamification.markModified('equippedItems');
        await gamification.save();

        console.log('💾 Saved to database');

        res.json({
            success: true,
            message: `${item.name} unequipped successfully!`,
            equippedItems: gamification.equippedItems
        });
    } catch (error) {
        console.error('❌ Error unequipping item:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Helper functions
function findItemById(itemId) {
    const allItems = [
        ...VAULT_ITEMS.avatarBorders,
        ...VAULT_ITEMS.perks,
        ...VAULT_ITEMS.profileThemes,
        ...VAULT_ITEMS.badges
    ];
    return allItems.find(item => item.id === itemId);
}

function isItemEquipped(itemId, equippedItems) {
    if (!equippedItems) return false;
    
    const isEquipped = (
        equippedItems.avatarBorder === itemId ||
        equippedItems.profileTheme === itemId ||
        equippedItems.activePerk === itemId ||
        (equippedItems.badges && equippedItems.badges.includes(itemId))
    );
    
    return isEquipped;
}

function checkUnlockRequirement(requirement, gamification) {
    if (!requirement) return true;

    switch (requirement.type) {
        case 'level':
            return gamification.level >= requirement.value;
        case 'achievement':
            return gamification.achievements.some(a => a.id === requirement.value);
        case 'stats':
            return gamification.stats && gamification.stats[requirement.stat] >= requirement.value;
        case 'nexusCoins':
            return gamification.nexusCoins >= requirement.value;
        case 'special':
            return false; // Special items need manual unlock
        default:
            return true;
    }
}

module.exports = router;