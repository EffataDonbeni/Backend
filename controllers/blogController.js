// controllers/blogController.js
const Blog = require("../models/Blog");
const Comment = require("../models/comment");
const catchAsync = require("../middleware/catchAsync");
const AppError = require("../middleware/errorHandler");
const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const sharp = require("sharp");

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
