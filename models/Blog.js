const mongoose = require('mongoose');
const slugify = require('slugify');

const blogSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Blog title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    index: true
  },
  excerpt: {
    type: String,
    required: [true, 'Blog excerpt is required'],
    maxlength: [500, 'Excerpt cannot exceed 500 characters']
  },
  content: {
    type: String,
    required: [true, 'Blog content is required'],
    minlength: [100, 'Content must be at least 100 characters long']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: ['design', 'development', 'ui-ux', 'tutorial', 'tips'],
    lowercase: true
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  featuredImage: {
    public_id: String,
    secure_url: String,
    alt_text: String
  },
  images: [{
    public_id: String,
    secure_url: String,
    alt_text: String
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'draft'
  },
  readTime: {
    type: String,
    default: function() {
      const wordsPerMinute = 200;
      const wordCount = this.content ? this.content.split(' ').length : 0;
      const minutes = Math.ceil(wordCount / wordsPerMinute);
      return `${minutes} min read`;
    }
  },
  views: {
    type: Number,
    default: 0
  },
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
  comments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  }],
  commentsCount: {
    type: Number,
    default: 0
  },
  bookmarks: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  bookmarksCount: {
    type: Number,
    default: 0
  },
  publishedAt: {
    type: Date
  },
  featured: {
    type: Boolean,
    default: false
  },
  seoTitle: {
    type: String,
    maxlength: [60, 'SEO title cannot exceed 60 characters']
  },
  seoDescription: {
    type: String,
    maxlength: [160, 'SEO description cannot exceed 160 characters']
  },
  allowComments: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
blogSchema.index({ status: 1, publishedAt: -1 });
blogSchema.index({ category: 1, status: 1 });
blogSchema.index({ author: 1, status: 1 });
blogSchema.index({ tags: 1 });
blogSchema.index({ slug: 1 });
blogSchema.index({ title: 'text', excerpt: 'text', content: 'text' });

// Virtual for comment count
blogSchema.virtual('totalComments', {
  ref: 'Comment',
  localField: '_id',
  foreignField: 'blog',
  count: true
});

// Pre-save middleware to generate slug
blogSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, {
      lower: true,
      strict: true,
      remove: /[*+~.()'"!:@]/g
    });
  }
  
  // Set published date when status changes to published
  if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
    this.publishedAt = new Date();
  }
  
  // Calculate read time
  if (this.isModified('content')) {
    const wordsPerMinute = 200;
    const wordCount = this.content.split(' ').length;
    const minutes = Math.ceil(wordCount / wordsPerMinute);
    this.readTime = `${minutes} min read`;
  }
  
  next();
});

// Method to check if user liked the blog
blogSchema.methods.isLikedByUser = function(userId) {
  return this.likes.some(like => like.user.toString() === userId.toString());
};

// Method to check if user bookmarked the blog
blogSchema.methods.isBookmarkedByUser = function(userId) {
  return this.bookmarks.some(bookmark => bookmark.user.toString() === userId.toString());
};

// Static method to get published blogs with pagination
blogSchema.statics.getPublishedBlogs = function(options = {}) {
  const {
    page = 1,
    limit = 10,
    category,
    tags,
    author,
    featured,
    search,
    sort = '-publishedAt'
  } = options;

  const query = { status: 'published' };
  
  if (category) query.category = category;
  if (author) query.author = author;
  if (featured !== undefined) query.featured = featured;
  if (tags && tags.length > 0) query.tags = { $in: tags };
  
  if (search) {
    query.$text = { $search: search };
  }

  const skip = (page - 1) * limit;
  
  return this.find(query)
    .populate('author', 'name email avatar')
    .sort(sort)
    .skip(skip)
    .limit(parseInt(limit))
    .lean();
};

// Method to increment view count
blogSchema.methods.incrementViews = function() {
  return this.constructor.findByIdAndUpdate(
    this._id,
    { $inc: { views: 1 } },
    { new: true }
  );
};

module.exports = mongoose.model('Blog', blogSchema);