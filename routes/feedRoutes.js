// server/routes/feedRoutes.js - Social Feed Routes with Notifications

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const Post = require('../models/Post');
const User = require('../models/User');
const NotificationService = require('../services/notificationService');
const multer = require('multer');
const { cloudinary } = require('../config/cloudinaryConfig');

// Multer setup for image uploads
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// Helper: Extract mentions from text
function extractMentions(text) {
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
        mentions.push(match[1]);
    }
    return mentions;
}

// Helper: Extract stock/crypto tags
function extractTags(text) {
    const tagRegex = /\$([A-Z]{1,5})\b/g;
    const tags = [];
    let match;
    while ((match = tagRegex.exec(text)) !== null) {
        tags.push(match[1]);
    }
    return tags;
}

// Helper: Upload image to Cloudinary
async function uploadImageToCloudinary(buffer) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'nexus-signal/posts',
                transformation: [
                    { width: 1200, height: 1200, crop: 'limit' },
                    { quality: 'auto' }
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

// ============ CREATE POST ============
// @route   POST /api/feed
// @desc    Create a new post
// @access  Private
router.post('/', auth, upload.array('images', 4), async (req, res) => {
    try {
        const { type, text, trade, achievement, milestone, prediction, visibility } = req.body;

        if (!type) {
            return res.status(400).json({ error: 'Post type is required' });
        }

        // Parse JSON fields if they're strings
        const tradeData = typeof trade === 'string' ? JSON.parse(trade) : trade;
        const achievementData = typeof achievement === 'string' ? JSON.parse(achievement) : achievement;
        const milestoneData = typeof milestone === 'string' ? JSON.parse(milestone) : milestone;
        const predictionData = typeof prediction === 'string' ? JSON.parse(prediction) : prediction;

        // Extract mentions and tags
        const mentionUsernames = text ? extractMentions(text) : [];
        const tags = text ? extractTags(text) : [];

        // Find mentioned users
        let mentions = [];
        if (mentionUsernames.length > 0) {
            const mentionedUsers = await User.find({
                username: { $in: mentionUsernames }
            }).select('_id');
            mentions = mentionedUsers.map(u => u._id);
        }

        // Upload images if provided
        let images = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                try {
                    const result = await uploadImageToCloudinary(file.buffer);
                    images.push({
                        url: result.secure_url,
                        publicId: result.public_id,
                        width: result.width,
                        height: result.height
                    });
                } catch (error) {
                    console.error('[Feed] Image upload error:', error);
                }
            }
        }

        // Create post
        const post = await Post.create({
            user: req.user.id,
            type,
            content: {
                text,
                images,
                trade: tradeData,
                achievement: achievementData,
                milestone: milestoneData,
                prediction: predictionData
            },
            tags,
            mentions,
            visibility: visibility || 'public'
        });

        // Populate user data
        await post.populate('user', 'username profile.displayName profile.avatar');

        // 🔔 Send mention notifications
        for (const mentionedUserId of mentions) {
            await NotificationService.createMentionNotification(
                mentionedUserId,
                { _id: req.user.id, name: req.user.name || req.user.username },
                post._id,
                text
            );
        }

        console.log(`[Feed] Created ${type} post by user ${req.user.id}`);

        res.status(201).json({
            success: true,
            post
        });

    } catch (error) {
        console.error('[Feed] Create post error:', error);
        res.status(500).json({
            error: 'Failed to create post',
            message: error.message
        });
    }
});

// ============ GET FEED ============
// @route   GET /api/feed
// @desc    Get personalized feed (following)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const { limit = 20, skip = 0 } = req.query;

        const user = await User.findById(req.user.id);
        const followingIds = user.social?.following || [];

        const posts = await Post.getFeedForUser(
            req.user.id,
            followingIds,
            parseInt(limit),
            parseInt(skip)
        );

        res.json({
            success: true,
            count: posts.length,
            posts
        });

    } catch (error) {
        console.error('[Feed] Get feed error:', error);
        res.status(500).json({
            error: 'Failed to fetch feed',
            message: error.message
        });
    }
});

// ============ GET DISCOVER FEED ============
// @route   GET /api/feed/discover
// @desc    Get discover feed (trending/popular posts)
// @access  Public
router.get('/discover', async (req, res) => {
    try {
        const { limit = 20, skip = 0 } = req.query;

        const posts = await Post.getDiscoverFeed(
            parseInt(limit),
            parseInt(skip)
        );

        res.json({
            success: true,
            count: posts.length,
            posts
        });

    } catch (error) {
        console.error('[Feed] Get discover feed error:', error);
        res.status(500).json({
            error: 'Failed to fetch discover feed',
            message: error.message
        });
    }
});

// ============ GET POSTS BY SYMBOL ============
// @route   GET /api/feed/symbol/:symbol
// @desc    Get posts mentioning a stock/crypto symbol
// @access  Public
router.get('/symbol/:symbol', async (req, res) => {
    try {
        const { symbol } = req.params;
        const { limit = 20, skip = 0 } = req.query;

        const posts = await Post.getPostsBySymbol(
            symbol,
            parseInt(limit),
            parseInt(skip)
        );

        res.json({
            success: true,
            count: posts.length,
            symbol: symbol.toUpperCase(),
            posts
        });

    } catch (error) {
        console.error('[Feed] Get posts by symbol error:', error);
        res.status(500).json({
            error: 'Failed to fetch posts',
            message: error.message
        });
    }
});

// ============ GET USER POSTS ============
// @route   GET /api/feed/user/:userId
// @desc    Get posts by a specific user
// @access  Public
router.get('/user/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { limit = 20, skip = 0 } = req.query;
        
        const currentUserId = req.user?.id || null;

        const posts = await Post.getUserPosts(
            userId,
            currentUserId,
            parseInt(limit),
            parseInt(skip)
        );

        res.json({
            success: true,
            count: posts.length,
            posts
        });

    } catch (error) {
        console.error('[Feed] Get user posts error:', error);
        res.status(500).json({
            error: 'Failed to fetch user posts',
            message: error.message
        });
    }
});

// ============ GET SINGLE POST ============
// @route   GET /api/feed/:postId
// @desc    Get a single post by ID
// @access  Public
router.get('/:postId', async (req, res) => {
    try {
        const post = await Post.findOne({
            _id: req.params.postId,
            deleted: false
        })
        .populate('user', 'username profile.displayName profile.avatar')
        .populate('comments.user', 'username profile.displayName profile.avatar')
        .populate('mentions', 'username profile.displayName');

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        res.json({
            success: true,
            post
        });

    } catch (error) {
        console.error('[Feed] Get post error:', error);
        res.status(500).json({
            error: 'Failed to fetch post',
            message: error.message
        });
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
            deleted: false
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found or unauthorized' });
        }

        const { text, visibility } = req.body;

        if (text !== undefined) {
            post.content.text = text;
            post.tags = extractTags(text);
            post.edited = true;
            post.editedAt = new Date();
        }

        if (visibility !== undefined) {
            post.visibility = visibility;
        }

        await post.save();

        res.json({
            success: true,
            post
        });

    } catch (error) {
        console.error('[Feed] Update post error:', error);
        res.status(500).json({
            error: 'Failed to update post',
            message: error.message
        });
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

        res.json({
            success: true,
            message: 'Post deleted'
        });

    } catch (error) {
        console.error('[Feed] Delete post error:', error);
        res.status(500).json({
            error: 'Failed to delete post',
            message: error.message
        });
    }
});

// ============ LIKE POST ============
// @route   POST /api/feed/:postId/like
// @desc    Like a post
// @access  Private
router.post('/:postId/like', auth, async (req, res) => {
    try {
        const post = await Post.findOne({
            _id: req.params.postId,
            deleted: false
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        // Check if already liked
        if (post.isLikedBy(req.user.id)) {
            return res.status(400).json({ error: 'Already liked this post' });
        }

        post.addLike(req.user.id);
        await post.save();

        // 🔔 Send like notification (if not own post)
        if (post.user.toString() !== req.user.id) {
            const currentUser = await User.findById(req.user.id).select('name username');
            await NotificationService.createLikeNotification(
                post.user,
                currentUser,
                post._id
            );
        }

        console.log(`[Feed] User ${req.user.id} liked post ${post._id}`);

        res.json({
            success: true,
            likesCount: post.likesCount
        });

    } catch (error) {
        console.error('[Feed] Like post error:', error);
        res.status(500).json({
            error: 'Failed to like post',
            message: error.message
        });
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
            deleted: false
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        post.removeLike(req.user.id);
        await post.save();

        res.json({
            success: true,
            likesCount: post.likesCount
        });

    } catch (error) {
        console.error('[Feed] Unlike post error:', error);
        res.status(500).json({
            error: 'Failed to unlike post',
            message: error.message
        });
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
            return res.status(400).json({ error: 'Comment text is required' });
        }

        const post = await Post.findOne({
            _id: req.params.postId,
            deleted: false
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const comment = post.addComment(req.user.id, text, replyTo);
        await post.save();

        // Populate the new comment's user data
        await post.populate('comments.user', 'username profile.displayName profile.avatar');

        // 🔔 Send comment notification (if not own post)
        if (post.user.toString() !== req.user.id) {
            const currentUser = await User.findById(req.user.id).select('name username');
            await NotificationService.createCommentNotification(
                post.user,
                currentUser,
                post._id,
                text
            );
        }

        // 🔔 If replying to comment, notify original commenter
        if (replyTo) {
            const originalComment = post.comments.id(replyTo);
            if (originalComment && originalComment.user.toString() !== req.user.id) {
                const currentUser = await User.findById(req.user.id).select('name username');
                await NotificationService.createReplyNotification(
                    originalComment.user,
                    currentUser,
                    post._id,
                    text
                );
            }
        }

        console.log(`[Feed] User ${req.user.id} commented on post ${post._id}`);

        res.json({
            success: true,
            comment: post.comments[post.comments.length - 1],
            commentsCount: post.commentsCount
        });

    } catch (error) {
        console.error('[Feed] Add comment error:', error);
        res.status(500).json({
            error: 'Failed to add comment',
            message: error.message
        });
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
            deleted: false
        });

        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const comment = post.comments.id(req.params.commentId);

        if (!comment) {
            return res.status(404).json({ error: 'Comment not found' });
        }

        // Check if user owns the comment or the post
        if (comment.user.toString() !== req.user.id && post.user.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        comment.remove();
        await post.save();

        res.json({
            success: true,
            message: 'Comment deleted',
            commentsCount: post.commentsCount
        });

    } catch (error) {
        console.error('[Feed] Delete comment error:', error);
        res.status(500).json({
            error: 'Failed to delete comment',
            message: error.message
        });
    }
});

module.exports = router;