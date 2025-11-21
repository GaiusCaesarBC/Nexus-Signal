// server/routes/feedRoutes.js - Social Feed API Routes

const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const protect = require('../middleware/authMiddleware');

// @route   GET /api/feed
// @desc    Get feed posts (with filters and pagination)
// @access  Private
router.get('/', protect, async (req, res) => {
    try {
        const { filter = 'all', page = 1, limit = 20 } = req.query;
        const userId = req.user.id;

        let query = {};

        // Apply filters
        if (filter === 'following') {
            // Get posts from users the current user follows
            const currentUser = await User.findById(userId);
            const followingIds = currentUser.following || [];
            query.user = { $in: followingIds };
            query.visibility = { $in: ['public', 'followers'] };
        } else if (filter === 'trending') {
            // Get trending posts (most likes in last 7 days)
            const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            query.createdAt = { $gte: sevenDaysAgo };
            query.visibility = 'public';
        } else {
            // 'all' - Get all public posts
            query.visibility = 'public';
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        // Fetch posts
        let posts = await Post.find(query)
            .populate('user', 'username email profile stats')
            .populate('comments.user', 'username profile')
            .sort(filter === 'trending' ? { likesCount: -1, createdAt: -1 } : { createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Add isLiked flag for each post
        posts = posts.map(post => ({
            ...post,
            isLiked: post.likes.some(likeId => likeId.toString() === userId)
        }));

        // Check if there are more posts
        const total = await Post.countDocuments(query);
        const hasMore = skip + posts.length < total;

        res.json({
            posts,
            hasMore,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limitNum)
        });
    } catch (error) {
        console.error('Error fetching feed:', error);
        res.status(500).json({ msg: 'Server error fetching feed' });
    }
});

// @route   POST /api/feed/post
// @desc    Create a new post
// @access  Private
router.post('/post', protect, async (req, res) => {
    try {
        const { type, content, visibility = 'public' } = req.body;
        const userId = req.user.id;

        // Validation
        if (!type || !['status', 'trade', 'achievement', 'milestone', 'prediction', 'journal'].includes(type)) {
            return res.status(400).json({ msg: 'Invalid post type' });
        }

        // Create post
        const post = new Post({
            user: userId,
            type,
            content,
            visibility
        });

        await post.save();

        // Populate user data before returning
        await post.populate('user', 'username email profile stats');

        res.status(201).json(post);
    } catch (error) {
        console.error('Error creating post:', error);
        res.status(500).json({ msg: 'Server error creating post' });
    }
});

// @route   POST /api/feed/:postId/like
// @desc    Like/unlike a post
// @access  Private
router.post('/:postId/like', protect, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;

        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        // Check if already liked
        const likeIndex = post.likes.indexOf(userId);

        if (likeIndex > -1) {
            // Unlike
            post.likes.splice(likeIndex, 1);
        } else {
            // Like
            post.likes.push(userId);
        }

        await post.save();

        res.json({
            liked: likeIndex === -1,
            likesCount: post.likesCount
        });
    } catch (error) {
        console.error('Error liking post:', error);
        res.status(500).json({ msg: 'Server error liking post' });
    }
});

// @route   POST /api/feed/:postId/comment
// @desc    Add a comment to a post
// @access  Private
router.post('/:postId/comment', protect, async (req, res) => {
    try {
        const { postId } = req.params;
        const { text } = req.body;
        const userId = req.user.id;

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ msg: 'Comment text is required' });
        }

        if (text.length > 500) {
            return res.status(400).json({ msg: 'Comment too long (max 500 characters)' });
        }

        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        // Add comment
        const comment = {
            user: userId,
            text: text.trim(),
            createdAt: new Date()
        };

        post.comments.push(comment);
        await post.save();

        // Populate the new comment's user data
        await post.populate('comments.user', 'username profile');

        // Get the newly added comment
        const newComment = post.comments[post.comments.length - 1];

        res.json({
            comment: newComment,
            commentsCount: post.commentsCount
        });
    } catch (error) {
        console.error('Error adding comment:', error);
        res.status(500).json({ msg: 'Server error adding comment' });
    }
});

// @route   DELETE /api/feed/:postId
// @desc    Delete a post
// @access  Private
router.delete('/:postId', protect, async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.user.id;

        const post = await Post.findById(postId);

        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }

        // Check if user owns the post
        if (post.user.toString() !== userId) {
            return res.status(403).json({ msg: 'Not authorized to delete this post' });
        }

        await Post.findByIdAndDelete(postId);

        res.json({ msg: 'Post deleted successfully' });
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).json({ msg: 'Server error deleting post' });
    }
});

// @route   GET /api/feed/user/:userId
// @desc    Get posts by specific user
// @access  Private
router.get('/user/:userId', protect, async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;
        const currentUserId = req.user.id;

        // Check visibility rules
        let visibilityQuery;
        if (userId === currentUserId) {
            // Own posts - see all
            visibilityQuery = {};
        } else {
            // Other user's posts - only public and followers
            visibilityQuery = { visibility: { $in: ['public', 'followers'] } };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const limitNum = parseInt(limit);

        let posts = await Post.find({ user: userId, ...visibilityQuery })
            .populate('user', 'username email profile stats')
            .populate('comments.user', 'username profile')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum)
            .lean();

        // Add isLiked flag
        posts = posts.map(post => ({
            ...post,
            isLiked: post.likes.some(likeId => likeId.toString() === currentUserId)
        }));

        const total = await Post.countDocuments({ user: userId, ...visibilityQuery });
        const hasMore = skip + posts.length < total;

        res.json({
            posts,
            hasMore,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / limitNum)
        });
    } catch (error) {
        console.error('Error fetching user posts:', error);
        res.status(500).json({ msg: 'Server error fetching user posts' });
    }
});

module.exports = router;