// controllers/blogController.js
const Blog = require("../models/Blog");
const Comment = require("../models/comment");
const catchAsync = require("../middleware/catchAsync");
const AppError = require("../middleware/errorHandler");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const sharp = require("sharp");
const { validationResult } = require("express-validator");

// Configure multer for image uploads
const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image")) {
    cb(null, true);
  } else {
    cb(new AppError("Not an image! Please upload only images.", 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, //
});

exports.uploadBlogImages = upload.fields([
  { name: "featuredImage", maxCount: 1 },
  { name: "images", maxCount: 10 },
]);

// BLOG CRUD OPERATIONS

// Get all blogs (Admin only)
exports.getAllBlogs = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;
  if (req.query.author) filter.author = req.query.author;
  if (req.query.featured !== undefined)
    filter.featured = req.query.featured === "true";

  // Search functionality
  if (req.query.search) {
    filter.$text = { $search: req.query.search };
  }

  const sort = req.query.sort || "-createdAt";

  const blogs = await Blog.find(filter)
    .populate("author", "name email avatar")
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  const total = await Blog.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: {
      blogs,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    },
  });
});

// Get single blog (Admin)
exports.getBlog = catchAsync(async (req, res) => {
  const blog = await Blog.findById(req.params.id)
    .populate("author", "name email avatar")
    .populate({
      path: "comments",
      populate: {
        path: "author",
        select: "name avatar",
      },
    });

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: "Blog not found",
    });
  }

  res.status(200).json({
    success: true,
    data: { blog },
  });
});

// Create blog (Admin only)
exports.createBlog = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  // Handle image uploads
  if (req.files) {
    if (req.files.featuredImage) {
      const featuredImageBuffer = await sharp(req.files.featuredImage[0].buffer)
        .resize(1200, 630)
        .jpeg({ quality: 90 })
        .toBuffer();

      const featuredImageResult = await cloudinary.uploader.upload(
        `data:image/jpeg;base64,${featuredImageBuffer.toString("base64")}`,
        {
          folder: "blog/featured",
          transformation: [{ width: 1200, height: 630, crop: "fill" }],
        }
      );

      req.body.featuredImage = {
        public_id: featuredImageResult.public_id,
        secure_url: featuredImageResult.secure_url,
        alt_text: req.body.featuredImageAlt || req.body.title,
      };
    }

    if (req.files.images) {
      const imagePromises = req.files.images.map(async (file) => {
        const imageBuffer = await sharp(file.buffer)
          .resize(800, 600)
          .jpeg({ quality: 85 })
          .toBuffer();

        const result = await cloudinary.uploader.upload(
          `data:image/jpeg;base64,${imageBuffer.toString("base64")}`,
          {
            folder: "blog/content",
            transformation: [{ width: 800, height: 600, crop: "fill" }],
          }
        );

        return {
          public_id: result.public_id,
          secure_url: result.secure_url,
          alt_text: file.originalname,
        };
      });

      req.body.images = await Promise.all(imagePromises);
    }
  }

  // Set author to current user
  req.body.author = req.user.id;

  // Process tags
  if (req.body.tags && typeof req.body.tags === "string") {
    req.body.tags = req.body.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase());
  }

  const blog = await Blog.create(req.body);

  await blog.populate("author", "name email avatar");

  res.status(201).json({
    success: true,
    message: "Blog created successfully",
    data: { blog },
  });
});

// Update blog (Admin only)
exports.updateBlog = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  let blog = await Blog.findById(req.params.id);

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: "Blog not found",
    });
  }

  // Handle image uploads
  if (req.files) {
    if (req.files.featuredImage) {
      // Delete old featured image
      if (blog.featuredImage?.public_id) {
        await cloudinary.uploader.destroy(blog.featuredImage.public_id);
      }

      const featuredImageBuffer = await sharp(req.files.featuredImage[0].buffer)
        .resize(1200, 630)
        .jpeg({ quality: 90 })
        .toBuffer();

      const featuredImageResult = await cloudinary.uploader.upload(
        `data:image/jpeg;base64,${featuredImageBuffer.toString("base64")}`,
        {
          folder: "blog/featured",
          transformation: [{ width: 1200, height: 630, crop: "fill" }],
        }
      );

      req.body.featuredImage = {
        public_id: featuredImageResult.public_id,
        secure_url: featuredImageResult.secure_url,
        alt_text: req.body.featuredImageAlt || req.body.title || blog.title,
      };
    }

    if (req.files.images) {
      // Delete old images
      if (blog.images?.length > 0) {
        const deletePromises = blog.images.map((img) =>
          cloudinary.uploader.destroy(img.public_id)
        );
        await Promise.all(deletePromises);
      }

      const imagePromises = req.files.images.map(async (file) => {
        const imageBuffer = await sharp(file.buffer)
          .resize(800, 600)
          .jpeg({ quality: 85 })
          .toBuffer();

        const result = await cloudinary.uploader.upload(
          `data:image/jpeg;base64,${imageBuffer.toString("base64")}`,
          {
            folder: "blog/content",
            transformation: [{ width: 800, height: 600, crop: "fill" }],
          }
        );

        return {
          public_id: result.public_id,
          secure_url: result.secure_url,
          alt_text: file.originalname,
        };
      });

      req.body.images = await Promise.all(imagePromises);
    }
  }

  // Process tags
  if (req.body.tags && typeof req.body.tags === "string") {
    req.body.tags = req.body.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase());
  }

  blog = await Blog.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  }).populate("author", "name email avatar");

  res.status(200).json({
    success: true,
    message: "Blog updated successfully",
    data: { blog },
  });
});

// Delete blog (Admin only)
exports.deleteBlog = catchAsync(async (req, res) => {
  const blog = await Blog.findById(req.params.id);

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: "Blog not found",
    });
  }

  // Delete images from cloudinary
  const deletePromises = [];

  if (blog.featuredImage?.public_id) {
    deletePromises.push(
      cloudinary.uploader.destroy(blog.featuredImage.public_id)
    );
  }

  if (blog.images?.length > 0) {
    blog.images.forEach((img) => {
      deletePromises.push(cloudinary.uploader.destroy(img.public_id));
    });
  }

  await Promise.all(deletePromises);

  // Delete associated comments
  await Comment.deleteMany({ blog: req.params.id });

  // Delete the blog
  await Blog.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: "Blog deleted successfully",
  });
});

// PUBLIC BLOG OPERATIONS

// Get published blogs (Public)
exports.getPublishedBlogs = catchAsync(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 9;
  const skip = (page - 1) * limit;

  const filter = { status: "published" };

  if (req.query.category) filter.category = req.query.category;
  if (req.query.featured !== undefined)
    filter.featured = req.query.featured === "true";
  if (req.query.tags) {
    const tags = req.query.tags
      .split(",")
      .map((tag) => tag.trim().toLowerCase());
    filter.tags = { $in: tags };
  }

  // Search functionality
  if (req.query.search) {
    filter.$or = [
      { title: { $regex: req.query.search, $options: "i" } },
      { excerpt: { $regex: req.query.search, $options: "i" } },
      { content: { $regex: req.query.search, $options: "i" } },
    ];
  }

  const sort = req.query.sort === "oldest" ? "publishedAt" : "-publishedAt";

  const blogs = await Blog.find(filter)
    .populate("author", "name avatar")
    .select("-content") // Exclude full content for list view
    .sort(sort)
    .skip(skip)
    .limit(limit)
    .lean();

  // Add user-specific data if user is logged in
  if (req.user) {
    blogs.forEach((blog) => {
      blog.isLiked = blog.likes?.some(
        (like) => like.user.toString() === req.user.id
      );
      blog.isBookmarked = blog.bookmarks?.some(
        (bookmark) => bookmark.user.toString() === req.user.id
      );
    });
  }

  const total = await Blog.countDocuments(filter);

  res.status(200).json({
    success: true,
    data: {
      blogs,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    },
  });
});

// Get single published blog by slug (Public)
exports.getPublishedBlogBySlug = catchAsync(async (req, res) => {
  const blog = await Blog.findOne({
    slug: req.params.slug,
    status: "published",
  })
    .populate("author", "name avatar bio")
    .lean();

  if (!blog) {
    return res.status(404).json({
      success: false,
      message: "Blog not found",
    });
  }

  // Increment views
  await Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } });
  blog.views += 1;

  // Add user-specific data if user is logged in
  if (req.user) {
    blog.isLiked = blog.likes?.some(
      (like) => like.user.toString() === req.user.id
    );
    blog.isBookmarked = blog.bookmarks?.some(
      (bookmark) => bookmark.user.toString() === req.user.id
    );
  }

  // Get related blogs
  const relatedBlogs = await Blog.find({
    _id: { $ne: blog._id },
    category: blog.category,
    status: "published",
  })
    .populate("author", "name avatar")
    .select("-content")
    .sort("-publishedAt")
    .limit(3)
    .lean();

  res.status(200).json({
    success: true,
    data: {
      blog,
      relatedBlogs,
    },
  });
});

// Get blog categories with counts (Public)
exports.getBlogCategories = catchAsync(async (req, res) => {
  const categories = await Blog.aggregate([
    { $match: { status: "published" } },
    { $group: { _id: "$category", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  res.status(200).json({
    success: true,
    data: { categories },
  });
});

// Get featured blogs (Public)
exports.getFeaturedBlogs = catchAsync(async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;

  const blogs = await Blog.find({ status: "published", featured: true })
    .populate("author", "name avatar")
    .select("-content")
    .sort("-publishedAt")
    .limit(limit)
    .lean();

  res.status(200).json({
    success: true,
    data: { blogs },
  });
});

// Get blog stats (Admin only)
exports.getBlogStats = catchAsync(async (req, res) => {
  const stats = await Blog.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 },
        totalViews: { $sum: "$views" },
        totalLikes: { $sum: "$likesCount" },
        totalComments: { $sum: "$commentsCount" },
      },
    },
  ]);

  const categoryStats = await Blog.aggregate([
    { $match: { status: "published" } },
    {
      $group: {
        _id: "$category",
        count: { $sum: 1 },
        avgViews: { $avg: "$views" },
      },
    },
  ]);

  const totalBlogs = await Blog.countDocuments();
  const publishedBlogs = await Blog.countDocuments({ status: "published" });
  const draftBlogs = await Blog.countDocuments({ status: "draft" });

  res.status(200).json({
    success: true,
    data: {
      overview: {
        totalBlogs,
        publishedBlogs,
        draftBlogs,
      },
      statusStats: stats,
      categoryStats,
    },
  });
});

// Like or Unlike a blog
exports.toggleLike = catchAsync(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog)
    return res.status(404).json({ success: false, message: "Blog not found" });

  const userId = req.user.id;
  const liked = blog.likes.some((like) => like.user.toString() === userId);

  if (liked) {
    // Unlike
    blog.likes = blog.likes.filter((like) => like.user.toString() !== userId);
    blog.likesCount = Math.max(0, blog.likesCount - 1);
  } else {
    // Like
    blog.likes.push({ user: userId });
    blog.likesCount += 1;
  }
  await blog.save();
  res
    .status(200)
    .json({ success: true, liked: !liked, likesCount: blog.likesCount });
});

// Bookmark or Unbookmark a blog
exports.toggleBookmark = catchAsync(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog)
    return res.status(404).json({ success: false, message: "Blog not found" });

  const userId = req.user.id;
  const bookmarked = blog.bookmarks.some((bm) => bm.user.toString() === userId);

  if (bookmarked) {
    // Unbookmark
    blog.bookmarks = blog.bookmarks.filter(
      (bm) => bm.user.toString() !== userId
    );
    blog.bookmarksCount = Math.max(0, blog.bookmarksCount - 1);
  } else {
    // Bookmark
    blog.bookmarks.push({ user: userId });
    blog.bookmarksCount += 1;
  }
  await blog.save();
  res.status(200).json({
    success: true,
    bookmarked: !bookmarked,
    bookmarksCount: blog.bookmarksCount,
  });
});

// Add a comment to a blog
exports.addComment = catchAsync(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  const { content } = req.body;
  if (!content || content.length < 1 || content.length > 1000) {
    return res.status(400).json({
      success: false,
      message: "Comment content is required and must be 1-1000 characters.",
    });
  }
  const blog = await Blog.findById(req.params.id);
  if (!blog)
    return res.status(404).json({ success: false, message: "Blog not found" });

  const comment = await Comment.create({
    content,
    author: req.user.id,
    blog: blog._id,
    parentComment: req.body.parentComment || null,
  });
  blog.comments.push(comment._id);
  blog.commentsCount += 1;
  await blog.save();
  await comment.populate("author", "username email");
  res.status(201).json({ success: true, comment });
});

// Delete a comment from a blog
exports.deleteComment = catchAsync(async (req, res) => {
  const blog = await Blog.findById(req.params.id);
  if (!blog)
    return res.status(404).json({ success: false, message: "Blog not found" });
  const comment = await Comment.findById(req.params.comment_id);
  if (!comment)
    return res
      .status(404)
      .json({ success: false, message: "Comment not found" });

  // Only comment owner or admin can delete
  if (comment.author.toString() !== req.user.id && req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Not authorized to delete this comment",
    });
  }
  await comment.remove();
  // Remove from blog.comments array
  blog.comments = blog.comments.filter(
    (cid) => cid.toString() !== comment._id.toString()
  );
  blog.commentsCount = Math.max(0, blog.commentsCount - 1);
  await blog.save();
  res.status(200).json({ success: true, message: "Comment deleted" });
});

// Flag a comment as inappropriate (user)
exports.flagComment = catchAsync(async (req, res) => {
  const { reason } = req.body;
  const validReasons = ["spam", "inappropriate", "harassment", "other"];
  if (!reason || !validReasons.includes(reason)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid flag reason." });
  }
  const comment = await Comment.findById(req.params.comment_id);
  if (!comment)
    return res
      .status(404)
      .json({ success: false, message: "Comment not found" });
  // Prevent duplicate flag by same user
  if (comment.flaggedBy.some((f) => f.user.toString() === req.user.id)) {
    return res.status(400).json({
      success: false,
      message: "You have already flagged this comment.",
    });
  }
  comment.flaggedBy.push({ user: req.user.id, reason });
  comment.status = "flagged";
  await comment.save();
  res
    .status(200)
    .json({ success: true, message: "Comment flagged for review." });
});

// Moderate a flagged comment (admin)
exports.moderateComment = catchAsync(async (req, res) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Admin privileges required." });
  }
  const { status } = req.body; // 'active', 'hidden', 'flagged'
  const validStatuses = ["active", "hidden", "flagged"];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status." });
  }
  const comment = await Comment.findById(req.params.comment_id);
  if (!comment)
    return res
      .status(404)
      .json({ success: false, message: "Comment not found" });
  comment.status = status;
  // Optionally clear flags if activating or hiding
  if (status !== "flagged") comment.flaggedBy = [];
  await comment.save();
  res
    .status(200)
    .json({ success: true, message: `Comment status set to ${status}.` });
});

// Get all comments for admin moderation
exports.getAllCommentsForAdmin = catchAsync(async (req, res) => {
  if (req.user.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, message: "Admin privileges required." });
  }
  const comments = await Comment.find()
    .populate("author", "username email")
    .populate("blog", "title")
    .lean();
  const formatted = comments.map((c) => ({
    ...c,
    blogTitle: c.blog && c.blog.title ? c.blog.title : "",
  }));
  res.status(200).json({ success: true, data: { comments: formatted } });
});
