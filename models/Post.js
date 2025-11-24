// server/models/Post.js - Enhanced Social Feed Post Model

const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true,
        maxlength: 500
    },
    // Reply to another comment
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment'
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    likesCount: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

const PostSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    
    type: {
        type: String,
        enum: ['status', 'trade', 'achievement', 'milestone', 'prediction', 'journal'],
        required: true,
        index: true
    },
    
    // Main content
    content: {
        text: {
            type: String,
            maxlength: 2000 // Increased for more detailed posts
        },
        
        // Images (using Cloudinary)
        images: [{
            url: String,
            publicId: String,
            width: Number,
            height: Number
        }],
        
        // Trade post data
        trade: {
            symbol: String,
            action: {
                type: String,
                enum: ['buy', 'sell']
            },
            shares: Number,
            price: Number,
            profit: Number,
            profitPercent: Number
        },
        
        // Achievement post data
        achievement: {
            title: String,
            description: String,
            badge: String,
            achievementId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Achievement'
            }
        },
        
        // Milestone post data
        milestone: {
            title: String,
            value: Number,
            metric: String
        },
        
        // Prediction post data
        prediction: {
            predictionId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Prediction'
            },
            symbol: String,
            direction: String,
            targetPrice: Number
        }
    },
    
    // Stock/crypto symbols mentioned in post (for filtering/discovery)
    tags: [{
        type: String,
        uppercase: true
    }],
    
    // @mentions
    mentions: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    
    visibility: {
        type: String,
        enum: ['public', 'followers', 'private'],
        default: 'public',
        index: true
    },
    
    // Engagement
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    
    comments: [CommentSchema],
    
    // Denormalized counts for performance
    likesCount: {
        type: Number,
        default: 0,
        index: true
    },
    
    commentsCount: {
        type: Number,
        default: 0
    },
    
    // For tracking trending posts
    engagementScore: {
        type: Number,
        default: 0,
        index: true
    },
    
    // Edit tracking
    edited: {
        type: Boolean,
        default: false
    },
    
    editedAt: {
        type: Date
    },
    
    // Soft delete
    deleted: {
        type: Boolean,
        default: false
    },
    
    deletedAt: {
        type: Date
    }
    
}, {
    timestamps: true
});

// Compound indexes for better query performance
PostSchema.index({ user: 1, createdAt: -1 });
PostSchema.index({ type: 1, createdAt: -1 });
PostSchema.index({ visibility: 1, createdAt: -1 });
PostSchema.index({ likesCount: -1, createdAt: -1 }); // Trending
PostSchema.index({ engagementScore: -1, createdAt: -1 }); // Hot posts
PostSchema.index({ tags: 1, createdAt: -1 }); // Symbol-based discovery
PostSchema.index({ deleted: 1, createdAt: -1 }); // Filter deleted

// Update counts and engagement score
PostSchema.pre('save', function(next) {
    this.likesCount = this.likes.length;
    this.commentsCount = this.comments.length;
    
    // Calculate engagement score (for trending/hot algorithm)
    // Weighted: likes (1 point), comments (2 points), recent posts get boost
    const hoursSincePost = (Date.now() - this.createdAt) / (1000 * 60 * 60);
    const recencyBoost = Math.max(0, 100 - hoursSincePost); // Decays over time
    
    this.engagementScore = (this.likesCount * 1) + (this.commentsCount * 2) + recencyBoost;
    
    next();
});

// Virtual for checking if post is recent (within 24 hours)
PostSchema.virtual('isRecent').get(function() {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this.createdAt > dayAgo;
});

// Method to check if user has liked the post
PostSchema.methods.isLikedBy = function(userId) {
    return this.likes.some(like => like.toString() === userId.toString());
};

// Method to add a like
PostSchema.methods.addLike = function(userId) {
    if (!this.isLikedBy(userId)) {
        this.likes.push(userId);
    }
};

// Method to remove a like
PostSchema.methods.removeLike = function(userId) {
    this.likes = this.likes.filter(like => like.toString() !== userId.toString());
};

// Method to add a comment
PostSchema.methods.addComment = function(userId, text, replyTo = null) {
    const comment = {
        user: userId,
        text,
        replyTo,
        createdAt: new Date()
    };
    this.comments.push(comment);
    return this.comments[this.comments.length - 1];
};

// Static method to get feed for user (following)
PostSchema.statics.getFeedForUser = function(userId, followingIds, limit = 20, skip = 0) {
    return this.find({
        $or: [
            { user: userId }, // Own posts
            { user: { $in: followingIds }, visibility: { $in: ['public', 'followers'] } } // Following posts
        ],
        deleted: false
    })
    .populate('user', 'username profile.displayName profile.avatar')
    .populate('comments.user', 'username profile.displayName profile.avatar')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get discover feed (trending/popular)
PostSchema.statics.getDiscoverFeed = function(limit = 20, skip = 0) {
    return this.find({
        visibility: 'public',
        deleted: false
    })
    .populate('user', 'username profile.displayName profile.avatar stats')
    .populate('comments.user', 'username profile.displayName profile.avatar')
    .sort({ engagementScore: -1, createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get posts by symbol tag
PostSchema.statics.getPostsBySymbol = function(symbol, limit = 20, skip = 0) {
    return this.find({
        tags: symbol.toUpperCase(),
        visibility: 'public',
        deleted: false
    })
    .populate('user', 'username profile.displayName profile.avatar')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get user's posts
PostSchema.statics.getUserPosts = function(userId, currentUserId = null, limit = 20, skip = 0) {
    const isOwnProfile = currentUserId && userId.toString() === currentUserId.toString();
    
    const query = {
        user: userId,
        deleted: false
    };
    
    // If not own profile, only show public and followers posts
    if (!isOwnProfile) {
        query.visibility = { $in: ['public', 'followers'] };
    }
    
    return this.find(query)
    .populate('user', 'username profile.displayName profile.avatar')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

module.exports = mongoose.model('Post', PostSchema);