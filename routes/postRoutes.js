// server/routes/postRoutes.js - Social Posts/Feed Routes

const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');

// Use existing Post model
const Post = require('../models/Post');

// @route   GET /api/posts
// @desc    Get social feed posts
// @access  Public (with optional auth for like status)
router.get('/', async (req, res) => {
    try {
        const { limit = 10, skip = 0, type } = req.query;
        
        // Use visibility field (not isPublic) - matches Post model
        const query = { 
            visibility: 'public',
            deleted: { $ne: true }
        };
        if (type) {
            query.type = type;
        }

        const posts = await Post.find(query)
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .populate('user', 'username profile gamification')
            .populate('comments.user', 'username profile')
            .lean();

        // Try to get user ID from token if provided (optional auth)
        let userId = null;
        try {
            const token = req.header('Authorization')?.replace('Bearer ', '') || req.header('x-auth-token');
            if (token) {
                const jwt = require('jsonwebtoken');
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                userId = decoded.user?.id || decoded.id;
            }
        } catch (e) { /* No valid token, that's fine */ }

        // Add isLiked flag for current user (if authenticated)
        const postsWithLikeStatus = posts.map(post => ({
            ...post,
            isLiked: userId ? post.likes?.some(id => id.toString() === userId) : false
        }));

        res.json({
            success: true,
            posts: postsWithLikeStatus,
            hasMore: posts.length === parseInt(limit)
        });
    } catch (error) {
        console.error('[Posts] Get feed error:', error);
        res.status(500).json({ error: 'Failed to get posts' });
    }
});

// @route   POST /api/posts
// @desc    Create a new post
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { content, type = 'text', metadata } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Content is required' });
        }

        if (content.length > 500) {
            return res.status(400).json({ error: 'Content too long (max 500 characters)' });
        }

        const post = new Post({
            user: req.user.id,
            content: content.trim(),
            type,
            visibility: 'public',
            metadata: metadata || {}
        });

        await post.save();
        
        // Populate user info for response
        await post.populate('user', 'username profile.displayName profile.avatar');

        console.log(`[Posts] User ${req.user.id} created ${type} post`);

        res.status(201).json({
            success: true,
            post
        });
    } catch (error) {
        console.error('[Posts] Create error:', error);
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// @route   POST /api/posts/:id/like
// @desc    Like/Unlike a post
// @access  Private
router.post('/:id/like', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const userId = req.user.id;
        const alreadyLiked = post.likes.some(id => id.toString() === userId);

        if (alreadyLiked) {
            // Unlike
            post.likes = post.likes.filter(id => id.toString() !== userId);
            post.likesCount = Math.max(0, post.likesCount - 1);
        } else {
            // Like
            post.likes.push(userId);
            post.likesCount += 1;
        }

        await post.save();

        res.json({
            success: true,
            liked: !alreadyLiked,
            likesCount: post.likesCount
        });
    } catch (error) {
        console.error('[Posts] Like error:', error);
        res.status(500).json({ error: 'Failed to like post' });
    }
});

// @route   POST /api/posts/:id/comment
// @desc    Add a comment to a post
// @access  Private
router.post('/:id/comment', auth, async (req, res) => {
    try {
        const { content } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({ error: 'Comment content is required' });
        }

        if (content.length > 200) {
            return res.status(400).json({ error: 'Comment too long (max 200 characters)' });
        }

        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        post.comments.push({
            user: req.user.id,
            content: content.trim()
        });
        post.commentsCount += 1;

        await post.save();

        // Get the newly added comment with user info
        await post.populate('comments.user', 'username profile.displayName profile.avatar');
        const newComment = post.comments[post.comments.length - 1];

        res.json({
            success: true,
            comment: newComment,
            commentsCount: post.commentsCount
        });
    } catch (error) {
        console.error('[Posts] Comment error:', error);
        res.status(500).json({ error: 'Failed to add comment' });
    }
});

// @route   DELETE /api/posts/:id
// @desc    Delete a post
// @access  Private (owner only)
router.delete('/:id', auth, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        if (post.user.toString() !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized to delete this post' });
        }

        await post.deleteOne();

        res.json({
            success: true,
            message: 'Post deleted'
        });
    } catch (error) {
        console.error('[Posts] Delete error:', error);
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// @route   GET /api/posts/user/:userId
// @desc    Get posts by a specific user
// @access  Private
router.get('/user/:userId', auth, async (req, res) => {
    try {
        const { limit = 10, skip = 0 } = req.query;
        
        const posts = await Post.find({ 
            user: req.params.userId,
            visibility: 'public',
            deleted: { $ne: true }
        })
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .populate('user', 'username profile.displayName profile.avatar')
            .lean();

        res.json({
            success: true,
            posts,
            hasMore: posts.length === parseInt(limit)
        });
    } catch (error) {
        console.error('[Posts] Get user posts error:', error);
        res.status(500).json({ error: 'Failed to get posts' });
    }
});

// @route   GET /api/posts/my
// @desc    Get current user's posts
// @access  Private
router.get('/my', auth, async (req, res) => {
    try {
        const { limit = 10, skip = 0 } = req.query;
        
        const posts = await Post.find({ user: req.user.id })
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .populate('user', 'username profile.displayName profile.avatar')
            .lean();

        res.json({
            success: true,
            posts,
            hasMore: posts.length === parseInt(limit)
        });
    } catch (error) {
        console.error('[Posts] Get my posts error:', error);
        res.status(500).json({ error: 'Failed to get posts' });
    }
});

module.exports = router;