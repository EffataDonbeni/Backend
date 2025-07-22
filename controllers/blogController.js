const Blog = require("../models/Blog");
const Comment = require("../models/Comment");
const User = require("../models/User");

// Create blog (Admin only)
exports.createBlog = async (req, res) => {
  try {
    const { title, content, excerpt, category, image } = req.body;

    const blog = new Blog({
      title,
      content,
      excerpt,
      category,
      image,
      author: req.user.id,
    });

    await blog.save();
    res.status(201).json(blog);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Get all blogs
exports.getBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find().populate("author", "username");
    res.json(blogs);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Get single blog
exports.getBlogById = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id)
      .populate("author", "username")
      .populate({
        path: "comments",
        populate: { path: "user", select: "username" },
      });

    if (!blog) {
      return res.status(404).json({ msg: "Blog not found" });
    }

    res.json(blog);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Update blog (Admin only)
exports.updateBlog = async (req, res) => {
  try {
    const { title, content, excerpt, category, image } = req.body;

    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      { title, content, excerpt, category, image },
      { new: true }
    );

    if (!blog) {
      return res.status(404).json({ msg: "Blog not found" });
    }

    res.json(blog);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Delete blog (Admin only)
exports.deleteBlog = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({ msg: "Blog not found" });
    }

    // Delete associated comments
    await Comment.deleteMany({ blog: blog._id });

    await blog.remove();
    res.json({ msg: "Blog removed" });
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Like/unlike blog
exports.toggleLike = async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);

    if (!blog) {
      return res.status(404).json({ msg: "Blog not found" });
    }

    const index = blog.likes.indexOf(req.user.id);

    if (index === -1) {
      blog.likes.push(req.user.id);
    } else {
      blog.likes.splice(index, 1);
    }

    await blog.save();
    res.json(blog.likes);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Add comment
exports.addComment = async (req, res) => {
  try {
    const { content } = req.body;

    const comment = new Comment({
      content,
      blog: req.params.id,
      user: req.user.id,
    });

    await comment.save();

    const blog = await Blog.findById(req.params.id);
    blog.comments.push(comment._id);
    await blog.save();

    res.status(201).json(comment);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};

// Toggle favorite
exports.toggleFavorite = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const index = user.favorites.indexOf(req.params.id);

    if (index === -1) {
      user.favorites.push(req.params.id);
    } else {
      user.favorites.splice(index, 1);
    }

    await user.save();
    res.json(user.favorites);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
};
