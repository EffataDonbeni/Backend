// const express = require('express');
// const router = express.Router();
// const { check } = require('express-validator');
// const blogController = require('../controllers/blogController');
// const auth = require('../middleware/authMiddleware');
// const adminAuth = require('../middleware/adminMiddleware');

// // @route   GET api/blogs
// // @desc    Get all published blogs (with pagination, search, filter)
// // @access  Public
// router.get('/', blogController.getBlogs);

// // @route   GET api/blogs/bookmarks
// // @desc    Get user's bookmarked blogs
// // @access  Private
// router.get('/bookmarks', auth, blogController.getBookmarkedBlogs);

// // @route   GET api/blogs/admin
// // @desc    Get all blogs for admin management
// // @access  Private/Admin
// router.get('/admin', auth, adminAuth, blogController.getAdminBlogs);

// // @route   GET api/blogs/:id
// // @desc    Get single blog by ID
// // @access  Public
// router.get('/:id', blogController.getBlog);

// // @route   POST api/blogs
// // @desc    Create a new blog
// // @access  Private/Admin
// router.post(
//   '/',
//   [
//     auth,
//     adminAuth,
//     [
//       check('title', 'Title is required').not().isEmpty(),
//       check('title', 'Title must be less than 200 characters').isLength({ max: 200 }),
//       check('excerpt', 'Excerpt is required').not().isEmpty(),
//       check('excerpt', 'Excerpt must be less than 300 characters').isLength({ max: 300 }),
//       check('content', 'Content is required').not().isEmpty(),
//       check('category', 'Category is required').not().isEmpty(),
//       check('category', 'Invalid category').isIn(['design', 'development', 'ui-ux', 'tutorial', 'tips']),
//       check('image', 'Image URL is required').not().isEmpty()
//     ]
//   ],
//   blogController.createBlog
// );

// // @route   PUT api/blogs/:id
// // @desc    Update a blog
// // @access  Private/Admin
// router.put(
//   '/:id',
//   [
//     auth,
//     adminAuth,
//     [
//       check('title', 'Title must be less than 200 characters').optional().isLength({ max: 200 }),
//       check('excerpt', 'Excerpt must be less than 300 characters').optional().isLength({ max: 300 }),
//       check('category', 'Invalid category').optional().isIn(['design', 'development', 'ui-ux', 'tutorial', 'tips'])
//     ]
//   ],
//   blogController.updateBlog
// );

// // @route   DELETE api/blogs/:id
// // @desc    Delete a blog
// // @access  Private/Admin
// router.delete('/:id', auth, adminAuth, blogController.deleteBlog);

// // @route   POST api/blogs/:id/like
// // @desc    Like/Unlike a blog
// // @access  Private
// router.post('/:id/like', auth, blogController.toggleLike);

// // @route   POST api/blogs/:id/bookmark
// // @desc    Bookmark/Unbookmark a blog
// // @access  Private
// router.post('/:id/bookmark', auth, blogController.toggleBookmark);

// // @route   POST api/blogs/:id/comment
// // @desc    Add comment to a blog
// // @access  Private
// router.post(
//   '/:id/comment',
//   [
//     auth,
//     [
//       check('content', 'Comment content is required').not().isEmpty(),
//       check('content', 'Comment must be less than 500 characters').isLength({ max: 500 })
//     ]
//   ],
//   blogController.addComment
// );

// // @route   DELETE api/blogs/:id/comment/:comment_id
// // @desc    Delete a comment
// // @access  Private
// router.delete('/:id/comment/:comment_id', auth, blogController.deleteComment);

// module.exports = router;