// const mongoose = require('mongoose');

// const CommentSchema = new mongoose.Schema({
//   user: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   username: {
//     type: String,
//     required: true
//   },
//   content: {
//     type: String,
//     required: true,
//     maxlength: 500
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// const BlogSchema = new mongoose.Schema({
//   title: {
//     type: String,
//     required: true,
//     trim: true,
//     maxlength: 200
//   },
//   excerpt: {
//     type: String,
//     required: true,
//     maxlength: 300
//   },
//   content: {
//     type: String,
//     required: true
//   },
//   category: {
//     type: String,
//     required: true,
//     enum: ['design', 'development', 'ui-ux', 'tutorial', 'tips'],
//     lowercase: true
//   },
//   image: {
//     type: String,
//     required: true
//   },
//   author: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   authorName: {
//     type: String,
//     required: true
//   },
//   published: {
//     type: Boolean,
//     default: false
//   },
//   readTime: {
//     type: String,
//     default: '5 min read'
//   },
//   likes: [{
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   }],
//   bookmarks: [{
//     user: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: 'User'
//     }
//   }],
//   comments: [CommentSchema],
//   views: {
//     type: Number,
//     default: 0
//   },
//   tags: [{
//     type: String,
//     trim: true
//   }],
//   slug: {
//     type: String,
//     unique: true
//   },
//   createdAt: {
//     type: Date,
//     default: Date.now
//   },
//   updatedAt: {
//     type: Date,
//     default: Date.now
//   }
// });

// // Generate slug from title before saving
// BlogSchema.pre('save', function(next) {
//   if (this.isModified('title')) {
//     this.slug = this.title
//       .toLowerCase()
//       .replace(/[^a-zA-Z0-9]/g, '-')
//       .replace(/-+/g, '-')
//       .replace(/^-|-$/g, '');
//   }
//   this.updatedAt = Date.now();
//   next();
// });

// // Virtual for like count
// BlogSchema.virtual('likeCount').get(function() {
//   return this.likes.length;
// });

// // Virtual for comment count
// BlogSchema.virtual('commentCount').get(function() {
//   return this.comments.length;
// });

// // Virtual for bookmark count
// BlogSchema.virtual('bookmarkCount').get(function() {
//   return this.bookmarks.length;
// });

// // Ensure virtual fields are serialized
// BlogSchema.set('toJSON', { virtuals: true });

// module.exports = mongoose.model('Blog', BlogSchema);