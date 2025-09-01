const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const Blog = require('../models/Blog');

const router = express.Router();

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = path.join(__dirname, '..', 'uploads', 'blog-images');
    fs.ensureDirSync(uploadPath);
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'blog-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// GET /api/blogs - Get all blogs with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      category,
      featured,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    // Add filters
    if (status) query.status = status;
    if (category) query.category = category;
    if (featured !== undefined) query.featured = featured === 'true';
    
    // Add search functionality
    if (search) {
      query.$text = { $search: search };
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };

    const blogs = await Blog.find(query)
      .sort(options.sort)
      .limit(options.limit * 1)
      .skip((options.page - 1) * options.limit)
      .exec();

    const total = await Blog.countDocuments(query);

    res.json({
      blogs,
      totalPages: Math.ceil(total / options.limit),
      currentPage: options.page,
      totalBlogs: total
    });

  } catch (error) {
    console.error('Error fetching blogs:', error);
    res.status(500).json({ error: 'Failed to fetch blogs' });
  }
});

// GET /api/blogs/:id - Get single blog by ID
router.get('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    // Increment view count
    blog.views += 1;
    await blog.save();

    res.json(blog);

  } catch (error) {
    console.error('Error fetching blog:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid blog ID' });
    }
    res.status(500).json({ error: 'Failed to fetch blog' });
  }
});

// POST /api/blogs - Create new blog
router.post('/', upload.single('image'), async (req, res) => {
  try {
    let blogData;
    
    // Handle form data
    if (req.body.data) {
      blogData = JSON.parse(req.body.data);
    } else {
      blogData = req.body;
    }

    // Process tags if they're a string
    if (typeof blogData.tags === 'string') {
      blogData.tags = blogData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    // Handle image upload
    if (req.file) {
      blogData.image = `/uploads/blog-images/${req.file.filename}`;
      blogData.thumbnail = blogData.image; // Use same image as thumbnail
    }

    // Set default values
    if (!blogData.date) {
      blogData.date = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    }

    if (!blogData.publishDate && blogData.status === 'published') {
      blogData.publishDate = new Date();
    }

    // Auto-generate SEO fields if not provided
    if (!blogData.seoTitle) {
      blogData.seoTitle = blogData.title;
    }
    if (!blogData.seoDescription) {
      blogData.seoDescription = blogData.excerpt || blogData.title;
    }

    const blog = new Blog(blogData);
    await blog.save();

    res.status(201).json({
      message: 'Blog created successfully',
      blog
    });

  } catch (error) {
    console.error('Error creating blog:', error);
    res.status(500).json({ 
      error: 'Failed to create blog',
      details: error.message 
    });
  }
});

// PUT /api/blogs/:id - Update existing blog
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    let blogData;
    
    // Handle form data
    if (req.body.data) {
      blogData = JSON.parse(req.body.data);
    } else {
      blogData = req.body;
    }

    // Process tags if they're a string
    if (typeof blogData.tags === 'string') {
      blogData.tags = blogData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
    }

    // Handle new image upload
    if (req.file) {
      // Find existing blog to delete old image
      const existingBlog = await Blog.findById(req.params.id);
      if (existingBlog && existingBlog.image) {
        const oldImagePath = path.join(__dirname, '..', existingBlog.image);
        if (await fs.pathExists(oldImagePath)) {
          await fs.remove(oldImagePath);
        }
      }

      blogData.image = `/uploads/blog-images/${req.file.filename}`;
      blogData.thumbnail = blogData.image;
    }

    // Update publish date if status changed to published
    if (blogData.status === 'published' && !blogData.publishDate) {
      blogData.publishDate = new Date();
    }

    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      blogData,
      { new: true, runValidators: true }
    );

    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    res.json({
      message: 'Blog updated successfully',
      blog
    });

  } catch (error) {
    console.error('Error updating blog:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid blog ID' });
    }
    res.status(500).json({ 
      error: 'Failed to update blog',
      details: error.message 
    });
  }
});

// DELETE /api/blogs/:id - Delete blog
router.delete('/:id', async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    
    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    // Delete associated image file
    if (blog.image) {
      const imagePath = path.join(__dirname, '..', blog.image);
      if (await fs.pathExists(imagePath)) {
        await fs.remove(imagePath);
      }
    }

    await Blog.findByIdAndDelete(req.params.id);

    res.json({
      message: 'Blog deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting blog:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid blog ID' });
    }
    res.status(500).json({ error: 'Failed to delete blog' });
  }
});

// GET /api/blogs/featured/list - Get featured blogs
router.get('/featured/list', async (req, res) => {
  try {
    const featuredBlogs = await Blog.find({ 
      featured: true, 
      status: 'published' 
    })
    .sort({ createdAt: -1 })
    .limit(5);

    res.json(featuredBlogs);

  } catch (error) {
    console.error('Error fetching featured blogs:', error);
    res.status(500).json({ error: 'Failed to fetch featured blogs' });
  }
});

// GET /api/blogs/categories/list - Get all unique categories
router.get('/categories/list', async (req, res) => {
  try {
    const categories = await Blog.distinct('category');
    res.json(categories);

  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// POST /api/blogs/:id/like - Like a blog
router.post('/:id/like', async (req, res) => {
  try {
    const blog = await Blog.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );

    if (!blog) {
      return res.status(404).json({ error: 'Blog not found' });
    }

    res.json({ likes: blog.likes });

  } catch (error) {
    console.error('Error liking blog:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid blog ID' });
    }
    res.status(500).json({ error: 'Failed to like blog' });
  }
});

module.exports = router;