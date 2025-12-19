// server/routes/feedRoutes.js - 🔥 LEGENDARY SOCIAL FEED ROUTES 🔥

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Post = require('../models/Post');
const User = require('../models/User');
const NotificationService = require('../services/notificationService');
const multer = require('multer');
const { cloudinary } = require('../config/cloudinaryConfig');

// Sanitize array of strings for MongoDB $in queries (NoSQL injection prevention)
const sanitizeStringArray = (arr) => {
    if (!Array.isArray(arr)) return [];
    return arr.filter(item => typeof item === 'string' && item.length > 0);
};

// ============ MULTER SETUP ============
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images and videos are allowed'));
        }
    }
});

// ============ REACTION TYPES ============
const REACTION_TYPES = ['like', 'rocket', 'fire', 'diamond', 'bull', 'bear', 'money'];

// ============ USER POPULATE FIELDS ============
// Centralized user fields to populate (includes vault for badges)
const USER_POPULATE_FIELDS = 'username profile gamification vault.equippedBadges vault.equippedBorder vault.equippedTheme';

// ============ HELPER FUNCTIONS ============

// Extract @mentions from text
function extractMentions(text) {
    if (!text) return [];
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
        mentions.push(match[1].toLowerCase());
    }
    return [...new Set(mentions)]; // Remove duplicates
}

// Extract #hashtags from text
function extractHashtags(text) {
    if (!text) return [];
    const hashtagRegex = /#(\w+)/g;
    const hashtags = [];
    let match;
    while ((match = hashtagRegex.exec(text)) !== null) {
        hashtags.push(match[1].toLowerCase());
    }
    return [...new Set(hashtags)];
}

// Extract $TICKER symbols from text
function extractTickers(text) {
    if (!text) return [];
    const tickerRegex = /\$([A-Z]{1,5})\b/g;
    const tickers = [];
    let match;
    while ((match = tickerRegex.exec(text)) !== null) {
        tickers.push(match[1].toUpperCase());
    }
    return [...new Set(tickers)];
}

// Upload image to Cloudinary
async function uploadToCloudinary(buffer, folder = 'nexus-signal/posts') {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                transformation: [
                    { width: 1200, height: 1200, crop: 'limit' },
                    { quality: 'auto:good' }
                ]
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result);
            }
        );
        uploadStream.end(buffer);
    });
}

// Calculate engagement score for trending
function calculateEngagementScore(post) {
    const likesWeight = 1;
    const commentsWeight = 3;
    const sharesWeight = 5;
    const reactionsWeight = 2;
    const recencyBonus = Math.max(0, 24 - ((Date.now() - new Date(post.createdAt)) / (1000 * 60 * 60))) * 10;
    
    const reactionCount = post.reactions ? 
        Object.values(post.reactions).reduce((sum, arr) => sum + (arr?.length || 0), 0) : 0;

    return (
        (post.likesCount || 0) * likesWeight +
        (post.commentsCount || 0) * commentsWeight +
        (post.sharesCount || 0) * sharesWeight +
        reactionCount * reactionsWeight +
        recencyBonus
    );
}

// Format post for response
function formatPostResponse(post, currentUserId = null) {
    const postObj = post.toObject ? post.toObject() : post;
    
    // Add user reaction info
    if (currentUserId && postObj.reactions) {
        for (const [type, users] of Object.entries(postObj.reactions)) {
            if (users?.some(u => u.toString() === currentUserId.toString())) {
                postObj.userReaction = type;
                break;
            }
        }
    }

    // Check if bookmarked
    if (currentUserId && postObj.bookmarkedBy) {
        postObj.isBookmarked = postObj.bookmarkedBy.some(
            u => u.toString() === currentUserId.toString()
        );
    }

    // Check if liked (legacy support)
    if (currentUserId && postObj.likes) {
        postObj.isLiked = postObj.likes.some(
            u => u.toString() === currentUserId.toString()
        );
    }

    // Format author with vault data (badges + border + theme)
    // 🔥 FIXED: Use 'default' fallback instead of null for equippedTheme
    if (postObj.user) {
        postObj.author = {
            _id: postObj.user._id,
            username: postObj.user.username,
            displayName: postObj.user.profile?.displayName || postObj.user.username,
            avatar: postObj.user.profile?.avatar || '',
            level: postObj.user.gamification?.level || 1,
            verified: postObj.user.profile?.verified || false,
            badges: postObj.user.profile?.badges || [],
            // 🔥 Include vault equipped items for display
            equippedBadges: postObj.user.vault?.equippedBadges || [],
            equippedBorder: postObj.user.vault?.equippedBorder || null,
            equippedTheme: postObj.user.vault?.equippedTheme || 'default'  // 🔥 Changed from null to 'default'
        };
    }

    // 🔥 Also format comment authors with equippedTheme
    if (postObj.comments && postObj.comments.length > 0) {
        postObj.comments = postObj.comments.map(comment => {
            if (comment.user && typeof comment.user === 'object') {
                return {
                    ...comment,
                    author: {
                        _id: comment.user._id,
                        username: comment.user.username,
                        displayName: comment.user.profile?.displayName || comment.user.username,
                        avatar: comment.user.profile?.avatar || '',
                        equippedTheme: comment.user.vault?.equippedTheme || 'default'
                    }
                };
            }
            return comment;
        });
    }

    return postObj;
}

// ============ CREATE POST ============
// @route   POST /api/feed
// @desc    Create a new post (text, trade, prediction, poll, media)
// @access  Private
router.post('/', auth, upload.array('images', 4), async (req, res) => {
    try {
        let { 
            type = 'text', 
            content, 
            text,  // Alternative to content
            trade, 
            prediction, 
            poll, 
            visibility = 'public',
            repostOf
        } = req.body;

        // Support both 'content' and 'text' fields
        const postText = content || text || '';

        // Parse JSON fields if strings
        if (typeof trade === 'string') trade = JSON.parse(trade);
        if (typeof prediction === 'string') prediction = JSON.parse(prediction);
        if (typeof poll === 'string') poll = JSON.parse(poll);

        // Validate based on type
        if (type === 'text' && !postText.trim() && (!req.files || req.files.length === 0)) {
            return res.status(400).json({ error: 'Post content is required' });
        }

        if (type === 'poll' && (!poll?.options || poll.options.filter(o => o.trim()).length < 2)) {
            return res.status(400).json({ error: 'Poll requires at least 2 options' });
        }

        // Extract mentions, hashtags, tickers
        const mentionUsernames = extractMentions(postText);
        const hashtags = extractHashtags(postText);
        const tickers = extractTickers(postText);

        // Find mentioned users (sanitize for NoSQL injection prevention)
        let mentionedUserIds = [];
        const sanitizedMentions = sanitizeStringArray(mentionUsernames);
        if (sanitizedMentions.length > 0) {
            const mentionedUsers = await User.find({
                username: { $in: sanitizedMentions }
            }).select('_id');
            mentionedUserIds = mentionedUsers.map(u => u._id);
        }

        // Upload images
        let images = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const result = await uploadToCloudinary(file.buffer);
                    images.push(result.secure_url);
                } catch (error) {
                    console.error('[Feed] Image upload error:', error);
                }
            }
        }

        // Build post object
        const postData = {
            user: req.user.id,
            type,
            content: postText,
            images,
            hashtags,
            tickers,
            mentions: mentionedUserIds,
            visibility,
            reactions: {
                like: [],
                rocket: [],
                fire: [],
                diamond: [],
                bull: [],
                bear: [],
                money: []
            }
        };

        // Add type-specific data
        if (type === 'trade' && trade) {
            // Calculate P&L if not provided
            if (trade.entryPrice && trade.exitPrice && trade.quantity) {
                const entry = parseFloat(trade.entryPrice);
                const exit = parseFloat(trade.exitPrice);
                const qty = parseFloat(trade.quantity);
                const direction = trade.direction === 'SHORT' ? -1 : 1;
                
                trade.pnl = ((exit - entry) * qty * direction).toFixed(2);
                trade.pnlPercent = (((exit - entry) / entry) * 100 * direction).toFixed(2);
            }
            postData.trade = trade;
        }

        if (type === 'prediction' && prediction) {
            postData.prediction = {
                ...prediction,
                createdAt: new Date(),
                status: 'active'
            };
        }

        if (type === 'poll' && poll) {
            postData.poll = {
                question: poll.question || postText,
                options: poll.options.filter(o => o.trim()).map(text => ({
                    text,
                    votes: 0,
                    voters: []
                })),
                totalVotes: 0,
                endsAt: new Date(Date.now() + (poll.duration || 24) * 60 * 60 * 1000), // Default 24h
                voters: []
            };
        }

        // Handle repost
        if (repostOf) {
            postData.repostOf = repostOf;
            postData.type = 'repost';
            
            // Increment original post's share count
            await Post.findByIdAndUpdate(repostOf, { $inc: { sharesCount: 1 } });
        }

        // Create post
        const post = await Post.create(postData);

        // Populate user data including vault
        await post.populate('user', USER_POPULATE_FIELDS);

        // 🔔 Send mention notifications
        for (const mentionedUserId of mentionedUserIds) {
            if (mentionedUserId.toString() !== req.user.id) {
                try {
                    await NotificationService.createMentionNotification(
                        mentionedUserId,
                        { _id: req.user.id },
                        post._id,
                        postText.substring(0, 100)
                    );
                } catch (e) {
                    console.error('[Feed] Mention notification error:', e);
                }
            }
        }

        // Update hashtag trending counts (fire and forget)
        updateHashtagTrending(hashtags).catch(console.error);

        console.log(`[Feed] Created ${type} post by user ${req.user.id}`);

        res.status(201).json({
            success: true,
            post: formatPostResponse(post, req.user.id)
        });

    } catch (error) {
        console.error('[Feed] Create post error:', error);
        res.status(500).json({ error: 'Failed to create post', message: error.message });
    }
});

// ============ GET PERSONALIZED FEED ============
// @route   GET /api/feed
// @desc    Get personalized feed (following + own posts)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const { limit = 20, skip = 0 } = req.query;

        const user = await User.findById(req.user.id).select('social.following');
        const followingIds = user?.social?.following || [];

        // Include own posts and following
        const userIds = [req.user.id, ...followingIds];

        const posts = await Post.find({
            user: { $in: userIds },
            deleted: { $ne: true },
            visibility: { $in: ['public', 'followers'] }
        })
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate('user', USER_POPULATE_FIELDS)
        .populate('repostOf')
        .lean();

        const formattedPosts = posts.map(p => formatPostResponse(p, req.user.id));

        res.json({
            success: true,
            count: posts.length,
            posts: formattedPosts
        });

    } catch (error) {
        console.error('[Feed] Get feed error:', error);
        res.status(500).json({ error: 'Failed to fetch feed' });
    }
});

// ============ GET DISCOVER/TRENDING FEED ============
// @route   GET /api/feed/discover
// @desc    Get trending/discover feed (algorithm-based)
// @access  Public
router.get('/discover', async (req, res) => {
    try {
        const { limit = 20, skip = 0, timeframe = '24h' } = req.query;
        const currentUserId = req.user?.id || null;

        // Calculate time threshold
        let timeThreshold;
        switch (timeframe) {
            case '1h': timeThreshold = new Date(Date.now() - 60 * 60 * 1000); break;
            case '6h': timeThreshold = new Date(Date.now() - 6 * 60 * 60 * 1000); break;
            case '24h': timeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000); break;
            case '7d': timeThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); break;
            default: timeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
        }

        // Get posts with engagement
        const posts = await Post.find({
            deleted: { $ne: true },
            visibility: 'public',
            createdAt: { $gte: timeThreshold }
        })
        .populate('user', USER_POPULATE_FIELDS)
        .populate('repostOf')
        .lean();

        // Calculate engagement scores and sort
        const scoredPosts = posts.map(post => ({
            ...post,
            engagementScore: calculateEngagementScore(post)
        }));

        scoredPosts.sort((a, b) => b.engagementScore - a.engagementScore);

        // Paginate
        const paginatedPosts = scoredPosts.slice(parseInt(skip), parseInt(skip) + parseInt(limit));
        const formattedPosts = paginatedPosts.map(p => formatPostResponse(p, currentUserId));

        res.json({
            success: true,
            count: formattedPosts.length,
            posts: formattedPosts
        });

    } catch (error) {
        console.error('[Feed] Get discover feed error:', error);
        res.status(500).json({ error: 'Failed to fetch discover feed' });
    }
});

// ============ GET TRENDING HASHTAGS ============
// @route   GET /api/feed/trending/hashtags
// @desc    Get trending hashtags
// @access  Public
router.get('/trending/hashtags', async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        // Aggregate hashtags from recent posts
        const timeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const trending = await Post.aggregate([
            {
                $match: {
                    deleted: { $ne: true },
                    createdAt: { $gte: timeThreshold },
                    hashtags: { $exists: true, $ne: [] }
                }
            },
            { $unwind: '$hashtags' },
            {
                $group: {
                    _id: '$hashtags',
                    count: { $sum: 1 },
                    engagement: {
                        $sum: {
                            $add: ['$likesCount', { $multiply: ['$commentsCount', 2] }, { $multiply: ['$sharesCount', 3] }]
                        }
                    }
                }
            },
            { $sort: { count: -1, engagement: -1 } },
            { $limit: parseInt(limit) },
            {
                $project: {
                    tag: { $concat: ['#', '$_id'] },
                    count: 1,
                    engagement: 1
                }
            }
        ]);

        res.json({
            success: true,
            hashtags: trending
        });

    } catch (error) {
        console.error('[Feed] Get trending hashtags error:', error);
        res.status(500).json({ error: 'Failed to fetch trending hashtags' });
    }
});

// ============ GET TRENDING TICKERS ============
// @route   GET /api/feed/trending/tickers
// @desc    Get trending stock/crypto tickers
// @access  Public
router.get('/trending/tickers', async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const timeThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);

        const trending = await Post.aggregate([
            {
                $match: {
                    deleted: { $ne: true },
                    createdAt: { $gte: timeThreshold },
                    tickers: { $exists: true, $ne: [] }
                }
            },
            { $unwind: '$tickers' },
            {
                $group: {
                    _id: '$tickers',
                    count: { $sum: 1 },
                    sentiment: {
                        $avg: {
                            $cond: [
                                { $in: ['bull', { $ifNull: ['$reactions.bull', []] }] },
                                1,
                                { $cond: [{ $in: ['bear', { $ifNull: ['$reactions.bear', []] }] }, -1, 0] }
                            ]
                        }
                    }
                }
            },
            { $sort: { count: -1 } },
            { $limit: parseInt(limit) },
            {
                $project: {
                    symbol: { $concat: ['$', '$_id'] },
                    count: 1,
                    sentiment: { $round: ['$sentiment', 2] }
                }
            }
        ]);

        res.json({
            success: true,
            tickers: trending
        });

    } catch (error) {
        console.error('[Feed] Get trending tickers error:', error);
        res.status(500).json({ error: 'Failed to fetch trending tickers' });
    }
});

// ============ GET POSTS BY HASHTAG ============
// @route   GET /api/feed/hashtag/:tag
// @desc    Get posts with a specific hashtag
// @access  Public
router.get('/hashtag/:tag', async (req, res) => {
    try {
        const { tag } = req.params;
        const { limit = 20, skip = 0 } = req.query;
        const currentUserId = req.user?.id || null;

        const cleanTag = tag.replace('#', '').toLowerCase();

        const posts = await Post.find({
            hashtags: cleanTag,
            deleted: { $ne: true },
            visibility: 'public'
        })
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate('user', USER_POPULATE_FIELDS)
        .lean();

        const formattedPosts = posts.map(p => formatPostResponse(p, currentUserId));

        res.json({
            success: true,
            hashtag: `#${cleanTag}`,
            count: posts.length,
            posts: formattedPosts
        });

    } catch (error) {
        console.error('[Feed] Get hashtag posts error:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// ============ GET POSTS BY TICKER ============
// @route   GET /api/feed/symbol/:symbol
// @desc    Get posts mentioning a stock/crypto symbol
// @access  Public
router.get('/symbol/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { limit = 20, skip = 0 } = req.query;
        const currentUserId = req.user?.id || null;

        const cleanSymbol = symbol.replace('$', '').toUpperCase();

        const posts = await Post.find({
            tickers: cleanSymbol,
            deleted: { $ne: true },
            visibility: 'public'
        })
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate('user', USER_POPULATE_FIELDS)
        .lean();

        const formattedPosts = posts.map(p => formatPostResponse(p, currentUserId));

        res.json({
            success: true,
            symbol: `$${cleanSymbol}`,
            count: posts.length,
            posts: formattedPosts
        });

    } catch (error) {
        console.error('[Feed] Get symbol posts error:', error);
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// ============ GET USER'S POSTS ============
// @route   GET /api/feed/user/:userId
// @desc    Get posts by a specific user
// @access  Public
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20, skip = 0, type } = req.query;
        const currentUserId = req.user?.id || null;

        const query = {
            user: userId,
            deleted: { $ne: true }
        };

        // Filter by type if specified
        if (type) {
            query.type = type;
        }

        // Check visibility
        const isOwnProfile = currentUserId === userId;
        if (!isOwnProfile) {
            query.visibility = 'public';
        }

        const posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .populate('user', USER_POPULATE_FIELDS)
            .populate('repostOf')
            .lean();

        const formattedPosts = posts.map(p => formatPostResponse(p, currentUserId));

        res.json({
            success: true,
            count: posts.length,
            posts: formattedPosts
        });

    } catch (error) {
        console.error('[Feed] Get user posts error:', error);
        res.status(500).json({ error: 'Failed to fetch user posts' });
    }
});

// ============ GET BOOKMARKED POSTS ============
// @route   GET /api/feed/bookmarks
// @desc    Get user's bookmarked posts
// @access  Private
router.get('/bookmarks', auth, async (req, res) => {
    try {
        const { limit = 20, skip = 0 } = req.query;

        const posts = await Post.find({
            bookmarkedBy: req.user.id,
            deleted: { $ne: true }
        })
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit))
        .populate('user', USER_POPULATE_FIELDS)
        .lean();

        const formattedPosts = posts.map(p => formatPostResponse(p, req.user.id));

        res.json({
            success: true,
            count: posts.length,
            posts: formattedPosts
        });

    } catch (error) {
        console.error('[Feed] Get bookmarks error:', error);
        res.status(500).json({ error: 'Failed to fetch bookmarks' });
    }
});

// ============ GET SINGLE POST ============
// @route   GET /api/feed/:postId
// @desc    Get a single post by ID
// @access  Public
router.get('/:postId', async (req, res) => {
    try {
        const currentUserId = req.user?.id || null;

        const post = await Post.findOne({
            _id: req.params.postId,
            deleted: { $ne: true }
        })
        .populate('user', USER_POPULATE_FIELDS)
        .populate('comments.user', 'username profile.displayName profile.avatar vault.equippedTheme')
        .populate('mentions', 'username profile.displayName')
        .populate('repostOf')
        .lean();

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json({
            success: true,
            post: formatPostResponse(post, currentUserId)
        });

    } catch (error) {
        console.error('[Feed] Get post error:', error);
        res.status(500).json({ error: 'Failed to fetch post' });
    }
});

// ============ UPDATE POST ============
// @route   PUT /api/feed/:postId
// @desc    Edit a post
// @access  Private
router.put('/:postId', auth, async (req, res) => {
    try {
        const post = await Post.findOne({
            _id: req.params.postId,
            user: req.user.id,
            deleted: { $ne: true }
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found or unauthorized' });
        }

        const { content, visibility } = req.body;

        if (content !== undefined) {
            post.content = content;
            post.hashtags = extractHashtags(content);
            post.tickers = extractTickers(content);
            post.edited = true;
            post.editedAt = new Date();
        }

        if (visibility !== undefined) {
            post.visibility = visibility;
        }

        await post.save();
        await post.populate('user', USER_POPULATE_FIELDS);

        res.json({
            success: true,
            post: formatPostResponse(post, req.user.id)
        });

    } catch (error) {
        console.error('[Feed] Update post error:', error);
        res.status(500).json({ error: 'Failed to update post' });
    }
});

// ============ DELETE POST ============
// @route   DELETE /api/feed/:postId
// @desc    Delete a post (soft delete)
// @access  Private
router.delete('/:postId', auth, async (req, res) => {
    try {
        const post = await Post.findOne({
            _id: req.params.postId,
            user: req.user.id
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found or unauthorized' });
        }

        post.deleted = true;
        post.deletedAt = new Date();
        await post.save();

        console.log(`[Feed] Deleted post ${post._id}`);

        res.json({ success: true, message: 'Post deleted' });

    } catch (error) {
        console.error('[Feed] Delete post error:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// ============ REACT TO POST ============
// @route   POST /api/feed/:postId/react
// @desc    Add a reaction to a post (rocket, fire, diamond, bull, bear, money)
// @access  Private
router.post('/:postId/react', auth, async (req, res) => {
    try {
        const { type } = req.body;

        if (!REACTION_TYPES.includes(type)) {
            return res.status(400).json({ error: 'Invalid reaction type' });
        }

        const post = await Post.findOne({
            _id: req.params.postId,
            deleted: { $ne: true }
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Initialize reactions if not exists
        if (!post.reactions) {
            post.reactions = {};
            REACTION_TYPES.forEach(t => post.reactions[t] = []);
        }

        // Remove user from all reaction arrays first
        let previousReaction = null;
        REACTION_TYPES.forEach(t => {
            if (!post.reactions[t]) post.reactions[t] = [];
            const index = post.reactions[t].findIndex(u => u.toString() === req.user.id);
            if (index > -1) {
                previousReaction = t;
                post.reactions[t].splice(index, 1);
            }
        });

        // Add new reaction (if different from previous, or if removing same reaction)
        let userReaction = null;
        if (previousReaction !== type) {
            post.reactions[type].push(req.user.id);
            userReaction = type;

            // Update likes count for compatibility
            if (type === 'like') {
                if (!post.likes) post.likes = [];
                if (!post.likes.includes(req.user.id)) {
                    post.likes.push(req.user.id);
                    post.likesCount = post.likes.length;
                }
            }
        } else {
            // Removing reaction - also remove from likes if applicable
            if (type === 'like' && post.likes) {
                post.likes = post.likes.filter(u => u.toString() !== req.user.id);
                post.likesCount = post.likes.length;
            }
        }

        await post.save();

        // 🔔 Send notification for new reaction (not removal, not own post)
        if (userReaction && post.user.toString() !== req.user.id) {
            try {
                const currentUser = await User.findById(req.user.id).select('username profile.displayName');
                await NotificationService.createLikeNotification(
                    post.user,
                    currentUser,
                    post._id,
                    type
                );
            } catch (e) {
                console.error('[Feed] Reaction notification error:', e);
            }
        }

        // Count total reactions
        const reactionCounts = {};
        let totalReactions = 0;
        REACTION_TYPES.forEach(t => {
            reactionCounts[t] = post.reactions[t]?.length || 0;
            totalReactions += reactionCounts[t];
        });

        res.json({
            success: true,
            userReaction,
            reactions: reactionCounts,
            totalReactions
        });

    } catch (error) {
        console.error('[Feed] React error:', error);
        res.status(500).json({ error: 'Failed to add reaction' });
    }
});

// ============ LIKE POST (Legacy Support) ============
// @route   POST /api/feed/:postId/like
// @desc    Like a post
// @access  Private
router.post('/:postId/like', auth, async (req, res) => {
    try {
        const post = await Post.findOne({
            _id: req.params.postId,
            deleted: { $ne: true }
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (!post.likes) post.likes = [];

        // Check if already liked
        if (post.likes.some(u => u.toString() === req.user.id)) {
            return res.status(400).json({ error: 'Already liked' });
        }

        post.likes.push(req.user.id);
        post.likesCount = post.likes.length;

        // Also add to reactions.like
        if (!post.reactions) post.reactions = { like: [] };
        if (!post.reactions.like) post.reactions.like = [];
        post.reactions.like.push(req.user.id);

        await post.save();

        // 🔔 Notification
        if (post.user.toString() !== req.user.id) {
            try {
                const currentUser = await User.findById(req.user.id).select('username profile.displayName');
                await NotificationService.createLikeNotification(post.user, currentUser, post._id);
            } catch (e) {}
        }

        res.json({ success: true, likesCount: post.likesCount });

    } catch (error) {
        console.error('[Feed] Like error:', error);
        res.status(500).json({ error: 'Failed to like post' });
    }
});

// ============ UNLIKE POST ============
// @route   DELETE /api/feed/:postId/like
// @desc    Unlike a post
// @access  Private
router.delete('/:postId/like', auth, async (req, res) => {
    try {
        const post = await Post.findOne({
            _id: req.params.postId,
            deleted: { $ne: true }
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (post.likes) {
            post.likes = post.likes.filter(u => u.toString() !== req.user.id);
            post.likesCount = post.likes.length;
        }

        if (post.reactions?.like) {
            post.reactions.like = post.reactions.like.filter(u => u.toString() !== req.user.id);
        }

        await post.save();

        res.json({ success: true, likesCount: post.likesCount || 0 });

    } catch (error) {
        console.error('[Feed] Unlike error:', error);
        res.status(500).json({ error: 'Failed to unlike post' });
    }
});

// ============ BOOKMARK POST ============
// @route   POST /api/feed/:postId/bookmark
// @desc    Bookmark/save a post
// @access  Private
router.post('/:postId/bookmark', auth, async (req, res) => {
    try {
        const post = await Post.findOne({
            _id: req.params.postId,
            deleted: { $ne: true }
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (!post.bookmarkedBy) post.bookmarkedBy = [];

        if (post.bookmarkedBy.some(u => u.toString() === req.user.id)) {
            return res.status(400).json({ error: 'Already bookmarked' });
        }

        post.bookmarkedBy.push(req.user.id);
        await post.save();

        console.log(`[Feed] User ${req.user.id} bookmarked post ${post._id}`);

        res.json({ success: true, message: 'Post bookmarked' });

    } catch (error) {
        console.error('[Feed] Bookmark error:', error);
        res.status(500).json({ error: 'Failed to bookmark post' });
    }
});

// ============ REMOVE BOOKMARK ============
// @route   DELETE /api/feed/:postId/bookmark
// @desc    Remove bookmark from a post
// @access  Private
router.delete('/:postId/bookmark', auth, async (req, res) => {
    try {
        const post = await Post.findOne({
            _id: req.params.postId,
            deleted: { $ne: true }
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (post.bookmarkedBy) {
            post.bookmarkedBy = post.bookmarkedBy.filter(u => u.toString() !== req.user.id);
            await post.save();
        }

        res.json({ success: true, message: 'Bookmark removed' });

    } catch (error) {
        console.error('[Feed] Remove bookmark error:', error);
        res.status(500).json({ error: 'Failed to remove bookmark' });
    }
});

// ============ SHARE/REPOST ============
// @route   POST /api/feed/:postId/share
// @desc    Share/repost a post
// @access  Private
router.post('/:postId/share', auth, async (req, res) => {
    try {
        const { comment } = req.body;

        const originalPost = await Post.findOne({
            _id: req.params.postId,
            deleted: { $ne: true }
        });

        if (!originalPost) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Increment share count on original
        originalPost.sharesCount = (originalPost.sharesCount || 0) + 1;
        await originalPost.save();

        // Create repost
        const repost = await Post.create({
            user: req.user.id,
            type: 'repost',
            content: comment || '',
            repostOf: originalPost._id,
            visibility: 'public',
            reactions: {
                like: [], rocket: [], fire: [], diamond: [], bull: [], bear: [], money: []
            }
        });

        await repost.populate('user', USER_POPULATE_FIELDS);
        await repost.populate('repostOf');

        // 🔔 Notification
        if (originalPost.user.toString() !== req.user.id) {
            try {
                const currentUser = await User.findById(req.user.id).select('username profile.displayName');
                await NotificationService.createShareNotification(
                    originalPost.user,
                    currentUser,
                    originalPost._id
                );
            } catch (e) {}
        }

        console.log(`[Feed] User ${req.user.id} shared post ${originalPost._id}`);

        res.json({
            success: true,
            sharesCount: originalPost.sharesCount,
            repost: formatPostResponse(repost, req.user.id)
        });

    } catch (error) {
        console.error('[Feed] Share error:', error);
        res.status(500).json({ error: 'Failed to share post' });
    }
});

// ============ VOTE ON POLL ============
// @route   POST /api/feed/:postId/vote
// @desc    Vote on a poll
// @access  Private
router.post('/:postId/vote', auth, async (req, res) => {
    try {
        const { optionIndex } = req.body;

        if (optionIndex === undefined || optionIndex === null) {
            return res.status(400).json({ error: 'Option index required' });
        }

        const post = await Post.findOne({
            _id: req.params.postId,
            type: 'poll',
            deleted: { $ne: true }
        });

        if (!post) {
            return res.status(404).json({ error: 'Poll not found' });
        }

        if (!post.poll) {
            return res.status(400).json({ error: 'Not a poll post' });
        }

        // Check if poll has ended
        if (post.poll.endsAt && new Date(post.poll.endsAt) < new Date()) {
            return res.status(400).json({ error: 'Poll has ended' });
        }

        // Check if already voted
        if (post.poll.voters?.some(v => v.user?.toString() === req.user.id)) {
            return res.status(400).json({ error: 'Already voted' });
        }

        // Validate option index
        if (optionIndex < 0 || optionIndex >= post.poll.options.length) {
            return res.status(400).json({ error: 'Invalid option' });
        }

        // Add vote
        post.poll.options[optionIndex].votes += 1;
        post.poll.options[optionIndex].voters.push(req.user.id);
        post.poll.totalVotes += 1;
        
        if (!post.poll.voters) post.poll.voters = [];
        post.poll.voters.push({ user: req.user.id, option: optionIndex, votedAt: new Date() });

        await post.save();

        console.log(`[Feed] User ${req.user.id} voted on poll ${post._id}`);

        // Calculate percentages
        const pollResults = post.poll.options.map(opt => ({
            text: opt.text,
            votes: opt.votes,
            percent: post.poll.totalVotes > 0 
                ? Math.round((opt.votes / post.poll.totalVotes) * 100) 
                : 0
        }));

        res.json({
            success: true,
            poll: {
                options: pollResults,
                totalVotes: post.poll.totalVotes,
                userVote: optionIndex,
                endsAt: post.poll.endsAt
            }
        });

    } catch (error) {
        console.error('[Feed] Vote error:', error);
        res.status(500).json({ error: 'Failed to vote' });
    }
});

// ============ ADD COMMENT ============
// @route   POST /api/feed/:postId/comment
// @desc    Add a comment to a post
// @access  Private
router.post('/:postId/comment', auth, async (req, res) => {
    try {
        const { text, replyTo } = req.body;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Comment text required' });
        }

        if (text.length > 1000) {
            return res.status(400).json({ error: 'Comment too long (max 1000 chars)' });
        }

        const post = await Post.findOne({
            _id: req.params.postId,
            deleted: { $ne: true }
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (!post.comments) post.comments = [];

        const comment = {
            user: req.user.id,
            text: text.trim(),
            likes: [],
            likesCount: 0,
            replyTo: replyTo || null,
            createdAt: new Date()
        };

        post.comments.push(comment);
        post.commentsCount = post.comments.length;
        await post.save();

        // Get the saved comment with populated user (including vault for theme)
        await post.populate('comments.user', 'username profile.displayName profile.avatar vault.equippedTheme');
        const savedComment = post.comments[post.comments.length - 1];

        // Format comment for response with equippedTheme
        const formattedComment = {
            _id: savedComment._id,
            text: savedComment.text,
            createdAt: savedComment.createdAt,
            likesCount: 0,
            author: {
                _id: savedComment.user._id,
                username: savedComment.user.username,
                displayName: savedComment.user.profile?.displayName || savedComment.user.username,
                avatar: savedComment.user.profile?.avatar || '',
                equippedTheme: savedComment.user.vault?.equippedTheme || 'default'
            }
        };

        // 🔔 Notification
        if (post.user.toString() !== req.user.id) {
            try {
                const currentUser = await User.findById(req.user.id).select('username profile.displayName');
                await NotificationService.createCommentNotification(
                    post.user,
                    currentUser,
                    post._id,
                    text.substring(0, 100)
                );
            } catch (e) {}
        }

        console.log(`[Feed] User ${req.user.id} commented on post ${post._id}`);

        res.json({
            success: true,
            comment: formattedComment,
            commentsCount: post.commentsCount
        });

    } catch (error) {
        console.error('[Feed] Comment error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// ============ DELETE COMMENT ============
// @route   DELETE /api/feed/:postId/comment/:commentId
// @desc    Delete a comment
// @access  Private
router.delete('/:postId/comment/:commentId', auth, async (req, res) => {
    try {
        const post = await Post.findOne({
            _id: req.params.postId,
            deleted: { $ne: true }
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const commentIndex = post.comments.findIndex(
            c => c._id.toString() === req.params.commentId
        );

        if (commentIndex === -1) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        const comment = post.comments[commentIndex];

        // Check authorization (comment owner or post owner)
        if (comment.user.toString() !== req.user.id && post.user.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        post.comments.splice(commentIndex, 1);
        post.commentsCount = post.comments.length;
        await post.save();

        res.json({
            success: true,
            message: 'Comment deleted',
            commentsCount: post.commentsCount
        });

    } catch (error) {
        console.error('[Feed] Delete comment error:', error);
        res.status(500).json({ error: 'Failed to delete comment' });
    }
});

// ============ LIKE COMMENT ============
// @route   POST /api/feed/:postId/comment/:commentId/like
// @desc    Like a comment
// @access  Private
router.post('/:postId/comment/:commentId/like', auth, async (req, res) => {
    try {
        const post = await Post.findOne({
            _id: req.params.postId,
            deleted: { $ne: true }
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const comment = post.comments.id(req.params.commentId);

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        if (!comment.likes) comment.likes = [];

        if (comment.likes.some(u => u.toString() === req.user.id)) {
            // Unlike
            comment.likes = comment.likes.filter(u => u.toString() !== req.user.id);
        } else {
            // Like
            comment.likes.push(req.user.id);
        }

        comment.likesCount = comment.likes.length;
        await post.save();

        res.json({
            success: true,
            likesCount: comment.likesCount
        });

    } catch (error) {
        console.error('[Feed] Like comment error:', error);
        res.status(500).json({ error: 'Failed to like comment' });
    }
});

// ============ REPORT POST ============
// @route   POST /api/feed/:postId/report
// @desc    Report a post
// @access  Private
router.post('/:postId/report', auth, async (req, res) => {
    try {
        const { reason, details } = req.body;

        const post = await Post.findOne({
            _id: req.params.postId,
            deleted: { $ne: true }
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (!post.reports) post.reports = [];

        // Check if already reported
        if (post.reports.some(r => r.user.toString() === req.user.id)) {
            return res.status(400).json({ error: 'Already reported this post' });
        }

        post.reports.push({
            user: req.user.id,
            reason: reason || 'inappropriate',
            details: details || '',
            createdAt: new Date()
        });

        // Auto-hide if too many reports
        if (post.reports.length >= 5) {
            post.visibility = 'hidden';
            console.log(`[Feed] Post ${post._id} auto-hidden due to reports`);
        }

        await post.save();

        res.json({ success: true, message: 'Report submitted' });

    } catch (error) {
        console.error('[Feed] Report error:', error);
        res.status(500).json({ error: 'Failed to report post' });
    }
});

// ============ HELPER: Update Hashtag Trending ============
async function updateHashtagTrending(hashtags) {
    // This could update a separate Hashtag collection for trending tracking
    // For now, we rely on aggregation queries
    console.log(`[Feed] Updated trending for hashtags: ${hashtags.join(', ')}`);
}

module.exports = router;