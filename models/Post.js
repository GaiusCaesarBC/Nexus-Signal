// server/models/Post.js - 🔥 LEGENDARY POST MODEL 🔥

const mongoose = require('mongoose');

// ============ COMMENT SCHEMA ============
const CommentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true,
        maxlength: 1000
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    likesCount: {
        type: Number,
        default: 0
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// ============ POLL OPTION SCHEMA ============
const PollOptionSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        maxlength: 100
    },
    votes: {
        type: Number,
        default: 0
    },
    voters: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }]
});

// ============ POLL SCHEMA ============
const PollSchema = new mongoose.Schema({
    question: {
        type: String,
        maxlength: 300
    },
    options: [PollOptionSchema],
    totalVotes: {
        type: Number,
        default: 0
    },
    voters: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        option: Number,
        votedAt: { type: Date, default: Date.now }
    }],
    endsAt: {
        type: Date
    }
});

// ============ TRADE SCHEMA ============
const TradeSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true
    },
    direction: {
        type: String,
        enum: ['LONG', 'SHORT'],
        default: 'LONG'
    },
    entryPrice: {
        type: Number
    },
    exitPrice: {
        type: Number
    },
    quantity: {
        type: Number
    },
    pnl: {
        type: Number
    },
    pnlPercent: {
        type: Number
    },
    duration: {
        type: String
    },
    strategy: {
        type: String
    },
    notes: {
        type: String
    }
});

// ============ PREDICTION SCHEMA ============
const PredictionSchema = new mongoose.Schema({
    symbol: {
        type: String,
        required: true,
        uppercase: true
    },
    direction: {
        type: String,
        enum: ['UP', 'DOWN'],
        required: true
    },
    targetPrice: {
        type: Number
    },
    targetPercent: {
        type: Number
    },
    timeframe: {
        type: String // e.g., "1d", "1w", "1m"
    },
    confidence: {
        type: Number,
        min: 0,
        max: 100
    },
    reasoning: {
        type: String
    },
    status: {
        type: String,
        enum: ['active', 'correct', 'incorrect', 'expired'],
        default: 'active'
    },
    result: {
        actualPrice: Number,
        actualPercent: Number,
        resolvedAt: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// ============ REPORT SCHEMA ============
const ReportSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reason: {
        type: String,
        enum: ['spam', 'harassment', 'misinformation', 'inappropriate', 'other'],
        default: 'inappropriate'
    },
    details: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// ============ MAIN POST SCHEMA ============
const PostSchema = new mongoose.Schema({
    // Author
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },

    // Post Type
    type: {
        type: String,
        enum: ['text', 'trade', 'prediction', 'poll', 'media', 'repost', 'achievement', 'milestone'],
        default: 'text',
        index: true
    },

    // Content
    content: {
        type: String,
        maxlength: 2000
    },

    // Media
    images: [{
        type: String // URLs
    }],
    
    videos: [{
        url: String,
        thumbnail: String,
        duration: Number
    }],

    // Type-specific data
    trade: TradeSchema,
    prediction: PredictionSchema,
    poll: PollSchema,

    // Repost reference
    repostOf: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Post'
    },

    // Extracted metadata
    hashtags: [{
        type: String,
        lowercase: true,
        index: true
    }],

    tickers: [{
        type: String,
        uppercase: true,
        index: true
    }],

    mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // Reactions (multiple types)
    reactions: {
        like: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        rocket: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        fire: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        diamond: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        bull: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        bear: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
        money: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },

    // Legacy likes (for backwards compatibility)
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    likesCount: {
        type: Number,
        default: 0,
        index: true
    },

    // Comments
    comments: [CommentSchema],
    commentsCount: {
        type: Number,
        default: 0,
        index: true
    },

    // Shares/Reposts
    shares: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    sharesCount: {
        type: Number,
        default: 0
    },

    // Bookmarks
    bookmarkedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // Views
    views: {
        type: Number,
        default: 0
    },
    viewedBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // Visibility
    visibility: {
        type: String,
        enum: ['public', 'followers', 'private', 'hidden'],
        default: 'public',
        index: true
    },

    // Pinned (for profile)
    isPinned: {
        type: Boolean,
        default: false
    },

    // Edit tracking
    edited: {
        type: Boolean,
        default: false
    },
    editedAt: Date,
    editHistory: [{
        content: String,
        editedAt: Date
    }],

    // Soft delete
    deleted: {
        type: Boolean,
        default: false,
        index: true
    },
    deletedAt: Date,

    // Reports
    reports: [ReportSchema],

    // Engagement score (for trending)
    engagementScore: {
        type: Number,
        default: 0,
        index: true
    }

}, {
    timestamps: true // Adds createdAt and updatedAt
});

// ============ INDEXES ============

// Compound indexes for efficient queries
PostSchema.index({ user: 1, createdAt: -1 });
PostSchema.index({ deleted: 1, visibility: 1, createdAt: -1 });
PostSchema.index({ hashtags: 1, createdAt: -1 });
PostSchema.index({ tickers: 1, createdAt: -1 });
PostSchema.index({ type: 1, createdAt: -1 });
PostSchema.index({ engagementScore: -1, createdAt: -1 });

// Text index for search
PostSchema.index({ content: 'text' });

// ============ VIRTUAL PROPERTIES ============

// Total reaction count
PostSchema.virtual('totalReactions').get(function() {
    if (!this.reactions) return this.likesCount || 0;
    return Object.values(this.reactions).reduce((sum, arr) => sum + (arr?.length || 0), 0);
});

// Poll ended check
PostSchema.virtual('pollEnded').get(function() {
    if (!this.poll?.endsAt) return false;
    return new Date(this.poll.endsAt) < new Date();
});

// Time remaining for poll
PostSchema.virtual('pollTimeRemaining').get(function() {
    if (!this.poll?.endsAt) return null;
    const remaining = new Date(this.poll.endsAt) - new Date();
    if (remaining <= 0) return 'Ended';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
    if (hours >= 1) return `${hours}h left`;
    
    const minutes = Math.floor(remaining / (1000 * 60));
    return `${minutes}m left`;
});

// ============ INSTANCE METHODS ============

// Check if user has liked
PostSchema.methods.isLikedBy = function(userId) {
    if (!userId) return false;
    return this.likes?.some(id => id.toString() === userId.toString()) || false;
};

// Check if user has reacted
PostSchema.methods.getUserReaction = function(userId) {
    if (!userId || !this.reactions) return null;
    
    for (const [type, users] of Object.entries(this.reactions)) {
        if (users?.some(id => id.toString() === userId.toString())) {
            return type;
        }
    }
    return null;
};

// Check if bookmarked by user
PostSchema.methods.isBookmarkedBy = function(userId) {
    if (!userId) return false;
    return this.bookmarkedBy?.some(id => id.toString() === userId.toString()) || false;
};

// Check if user has voted on poll
PostSchema.methods.hasVoted = function(userId) {
    if (!userId || !this.poll?.voters) return false;
    return this.poll.voters.some(v => v.user?.toString() === userId.toString());
};

// Get user's poll vote
PostSchema.methods.getUserVote = function(userId) {
    if (!userId || !this.poll?.voters) return null;
    const vote = this.poll.voters.find(v => v.user?.toString() === userId.toString());
    return vote ? vote.option : null;
};

// Add like (legacy)
PostSchema.methods.addLike = function(userId) {
    if (!this.likes) this.likes = [];
    if (!this.likes.some(id => id.toString() === userId.toString())) {
        this.likes.push(userId);
        this.likesCount = this.likes.length;
    }
    return this;
};

// Remove like (legacy)
PostSchema.methods.removeLike = function(userId) {
    if (this.likes) {
        this.likes = this.likes.filter(id => id.toString() !== userId.toString());
        this.likesCount = this.likes.length;
    }
    return this;
};

// Add comment
PostSchema.methods.addComment = function(userId, text, replyTo = null) {
    if (!this.comments) this.comments = [];
    
    const comment = {
        user: userId,
        text,
        replyTo,
        likes: [],
        likesCount: 0,
        createdAt: new Date()
    };
    
    this.comments.push(comment);
    this.commentsCount = this.comments.length;
    
    return comment;
};

// Update engagement score
PostSchema.methods.updateEngagementScore = function() {
    const likesWeight = 1;
    const commentsWeight = 3;
    const sharesWeight = 5;
    const reactionsWeight = 2;
    const viewsWeight = 0.1;

    let reactionCount = 0;
    if (this.reactions) {
        reactionCount = Object.values(this.reactions)
            .reduce((sum, arr) => sum + (arr?.length || 0), 0);
    }

    // Recency bonus (decays over 24 hours)
    const ageInHours = (Date.now() - new Date(this.createdAt)) / (1000 * 60 * 60);
    const recencyBonus = Math.max(0, 24 - ageInHours) * 10;

    this.engagementScore = 
        (this.likesCount || 0) * likesWeight +
        (this.commentsCount || 0) * commentsWeight +
        (this.sharesCount || 0) * sharesWeight +
        reactionCount * reactionsWeight +
        (this.views || 0) * viewsWeight +
        recencyBonus;

    return this.engagementScore;
};

// ============ STATIC METHODS ============

// Get feed for user (personalized)
PostSchema.statics.getFeedForUser = async function(userId, followingIds, limit = 20, skip = 0) {
    const userIds = [userId, ...followingIds];

    return this.find({
        user: { $in: userIds },
        deleted: { $ne: true },
        visibility: { $in: ['public', 'followers'] }
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profile gamification')
    .populate({
        path: 'repostOf',
        populate: {
            path: 'user',
            select: 'username profile'
        }
    })
    .lean();
};

// Get discover/trending feed
PostSchema.statics.getDiscoverFeed = async function(limit = 20, skip = 0) {
    // Get recent posts with engagement
    const posts = await this.find({
        deleted: { $ne: true },
        visibility: 'public',
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } // Last 7 days
    })
    .sort({ engagementScore: -1, createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profile gamification')
    .populate({
        path: 'repostOf',
        populate: {
            path: 'user',
            select: 'username profile'
        }
    })
    .lean();

    return posts;
};

// Get posts by symbol/ticker
PostSchema.statics.getPostsBySymbol = async function(symbol, limit = 20, skip = 0) {
    return this.find({
        tickers: symbol.toUpperCase(),
        deleted: { $ne: true },
        visibility: 'public'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profile gamification')
    .lean();
};

// Get posts by hashtag
PostSchema.statics.getPostsByHashtag = async function(hashtag, limit = 20, skip = 0) {
    return this.find({
        hashtags: hashtag.toLowerCase().replace('#', ''),
        deleted: { $ne: true },
        visibility: 'public'
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('user', 'username profile gamification')
    .lean();
};

// Get user's posts
PostSchema.statics.getUserPosts = async function(userId, currentUserId = null, limit = 20, skip = 0) {
    const query = {
        user: userId,
        deleted: { $ne: true }
    };

    // If not own profile, only show public
    if (currentUserId !== userId) {
        query.visibility = 'public';
    }

    return this.find(query)
        .sort({ isPinned: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('user', 'username profile gamification')
        .populate({
            path: 'repostOf',
            populate: {
                path: 'user',
                select: 'username profile'
            }
        })
        .lean();
};

// Get trending hashtags
PostSchema.statics.getTrendingHashtags = async function(limit = 10, hours = 24) {
    const timeThreshold = new Date(Date.now() - hours * 60 * 60 * 1000);

    return this.aggregate([
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
                count: { $sum: 1 }
            }
        },
        { $sort: { count: -1 } },
        { $limit: limit },
        {
            $project: {
                hashtag: { $concat: ['#', '$_id'] },
                count: 1
            }
        }
    ]);
};

// ============ PRE-SAVE HOOKS ============

// Update engagement score before saving
PostSchema.pre('save', function(next) {
    if (this.isModified('likes') || this.isModified('comments') || 
        this.isModified('shares') || this.isModified('reactions')) {
        this.updateEngagementScore();
    }
    next();
});

// ============ EXPORT ============
module.exports = mongoose.model('Post', PostSchema);