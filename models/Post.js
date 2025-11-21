// server/models/Post.js - Social Feed Post Model

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
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const PostSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['status', 'trade', 'achievement', 'milestone', 'prediction', 'journal'],
        required: true
    },
    content: {
        text: {
            type: String,
            maxlength: 500
        },
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
        achievement: {
            title: String,
            description: String,
            badge: String
        },
        milestone: {
            title: String,
            value: Number,
            metric: String
        }
    },
    visibility: {
        type: String,
        enum: ['public', 'followers', 'private'],
        default: 'public'
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    comments: [CommentSchema],
    likesCount: {
        type: Number,
        default: 0
    },
    commentsCount: {
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

// Indexes for better query performance
PostSchema.index({ user: 1, createdAt: -1 });
PostSchema.index({ type: 1, createdAt: -1 });
PostSchema.index({ visibility: 1, createdAt: -1 });
PostSchema.index({ likesCount: -1, createdAt: -1 }); // For trending

// Update counts on save
PostSchema.pre('save', function(next) {
    this.likesCount = this.likes.length;
    this.commentsCount = this.comments.length;
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Post', PostSchema);