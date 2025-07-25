const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    trim: true,
    minlength: [1, 'Comment cannot be empty'],
    maxlength: [1000, 'Comment cannot exceed 1000 characters']
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  blog: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Blog',
    required: true
  },
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment',
    default: null
  },
  replies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  likesCount: {
    type: Number,
    default: 0
  },
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  status: {
    type: String,
    enum: ['active', 'hidden', 'flagged'],
    default: 'active'
  },
  flaggedBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      enum: ['spam', 'inappropriate', 'harassment', 'other']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
commentSchema.index({ blog: 1, createdAt: -1 });
commentSchema.index({ author: 1, createdAt: -1 });
commentSchema.index({ parentComment: 1 });
commentSchema.index({ status: 1 });

// Virtual for reply count
commentSchema.virtual('repliesCount').get(function() {
  return this.replies ? this.replies.length : 0;
});

// Pre-save middleware
commentSchema.pre('save', function(next) {
  if (this.isModified('content') && !this.isNew) {
    this.isEdited = true;
    this.editedAt = new Date();
  }
  next();
});

// Post-save middleware to update blog comment count and parent comment replies
commentSchema.post('save', async function() {
  try {
    // Update blog comment count
    const Blog = mongoose.model('Blog');
    const commentCount = await mongoose.model('Comment').countDocuments({ 
      blog: this.blog, 
      status: 'active' 
    });
    
    await Blog.findByIdAndUpdate(this.blog, { 
      commentsCount: commentCount 
    });

    // If this is a reply, add to parent comment's replies array
    if (this.parentComment) {
      await mongoose.model('Comment').findByIdAndUpdate(
        this.parentComment,
        { $addToSet: { replies: this._id } }
      );
    }
  } catch (error) {
    console.error('Error updating comment counts:', error);
  }
});

// Post-remove middleware to update counts
commentSchema.post('remove', async function() {
  try {
    // Update blog comment count
    const Blog = mongoose.model('Blog');
    const commentCount = await mongoose.model('Comment').countDocuments({ 
      blog: this.blog, 
      status: 'active' 
    });
    
    await Blog.findByIdAndUpdate(this.blog, { 
      commentsCount: commentCount 
    });

    // If this was a reply, remove from parent comment's replies array
    if (this.parentComment) {
      await mongoose.model('Comment').findByIdAndUpdate(
        this.parentComment,
        { $pull: { replies: this._id } }
      );
    }

    // Remove all replies to this comment
    await mongoose.model('Comment').deleteMany({ parentComment: this._id });
  } catch (error) {
    console.error('Error updating comment counts on delete:', error);
  }
});

// Method to check if user liked the comment
commentSchema.methods.isLikedByUser = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Static method to get comments with replies for a blog
commentSchema.statics.getCommentsWithReplies = function(blogId, options = {}) {
  const { page = 1, limit = 10, sort = '-createdAt' } = options;
  const skip = (page - 1) * limit;

  return this.find({ 
    blog: blogId, 
    parentComment: null, 
    status: 'active' 
  })
  .populate('author', 'name avatar')
  .populate({
    path: 'replies',
    match: { status: 'active' },
    populate: {
      path: 'author',
      select: 'name avatar'
    },
    options: { sort: { createdAt: 1 } }
  })
  .sort(sort)
  .skip(skip)
  .limit(parseInt(limit));
};

module.exports = mongoose.model('Comment', commentSchema);