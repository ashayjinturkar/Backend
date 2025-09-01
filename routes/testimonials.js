const express = require('express');
const Testimonial = require('../models/Testimonial');

const router = express.Router();

// GET /api/testimonials/all - Get all testimonials (for admin)
router.get('/all', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      active,
      featured,
      rating,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = {};
    
    // Add filters
    if (active !== undefined) query.active = active === 'true';
    if (featured !== undefined) query.featured = featured === 'true';
    if (rating) query.rating = parseInt(rating);
    
    // Add search functionality
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { company: { $regex: search, $options: 'i' } },
        { testimonial: { $regex: search, $options: 'i' } }
      ];
    }

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { [sortBy]: sortOrder === 'desc' ? -1 : 1 }
    };

    const testimonials = await Testimonial.find(query)
      .sort(options.sort)
      .limit(options.limit * 1)
      .skip((options.page - 1) * options.limit)
      .exec();

    const total = await Testimonial.countDocuments(query);

    // For compatibility with frontend, return array directly
    res.json(testimonials);

  } catch (error) {
    console.error('Error fetching testimonials:', error);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

// GET /api/testimonials - Get active testimonials (for public)
router.get('/', async (req, res) => {
  try {
    const {
      limit = 10,
      featured,
      rating,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { active: true };
    
    // Add filters
    if (featured !== undefined) query.featured = featured === 'true';
    if (rating) query.rating = { $gte: parseInt(rating) };

    const testimonials = await Testimonial.find(query)
      .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
      .limit(parseInt(limit))
      .select('-__v')
      .exec();

    res.json(testimonials);

  } catch (error) {
    console.error('Error fetching public testimonials:', error);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

// GET /api/testimonials/:id - Get single testimonial
router.get('/:id', async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);
    
    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    res.json(testimonial);

  } catch (error) {
    console.error('Error fetching testimonial:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid testimonial ID' });
    }
    res.status(500).json({ error: 'Failed to fetch testimonial' });
  }
});

// POST /api/testimonials - Create new testimonial
router.post('/', async (req, res) => {
  try {
    const {
      name,
      company,
      position,
      rating,
      testimonial,
      image,
      active = true,
      featured = false,
      projectType,
      source = 'website',
      verified = false
    } = req.body;

    // Validate required fields
    if (!name || !company || !rating) {
      return res.status(400).json({ 
        error: 'Missing required fields: name, company, and rating are required' 
      });
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ 
        error: 'Rating must be between 1 and 5' 
      });
    }

    const newTestimonial = new Testimonial({
      name,
      company,
      position,
      rating,
      testimonial,
      image,
      active,
      featured,
      projectType,
      source,
      verified
    });

    await newTestimonial.save();

    res.status(201).json({
      message: 'Testimonial created successfully',
      testimonial: newTestimonial
    });

  } catch (error) {
    console.error('Error creating testimonial:', error);
    res.status(500).json({ 
      error: 'Failed to create testimonial',
      details: error.message 
    });
  }
});

// PUT /api/testimonials/:id - Update existing testimonial
router.put('/:id', async (req, res) => {
  try {
    const {
      name,
      company,
      position,
      rating,
      testimonial,
      image,
      active,
      featured,
      projectType,
      source,
      verified
    } = req.body;

    // Validate rating if provided
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ 
        error: 'Rating must be between 1 and 5' 
      });
    }

    const updatedTestimonial = await Testimonial.findByIdAndUpdate(
      req.params.id,
      {
        name,
        company,
        position,
        rating,
        testimonial,
        image,
        active,
        featured,
        projectType,
        source,
        verified
      },
      { new: true, runValidators: true }
    );

    if (!updatedTestimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    res.json({
      message: 'Testimonial updated successfully',
      testimonial: updatedTestimonial
    });

  } catch (error) {
    console.error('Error updating testimonial:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid testimonial ID' });
    }
    res.status(500).json({ 
      error: 'Failed to update testimonial',
      details: error.message 
    });
  }
});

// DELETE /api/testimonials/:id - Delete testimonial
router.delete('/:id', async (req, res) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
    
    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    res.json({
      message: 'Testimonial deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting testimonial:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid testimonial ID' });
    }
    res.status(500).json({ error: 'Failed to delete testimonial' });
  }
});

// PUT /api/testimonials/:id/toggle-active - Toggle testimonial active status
router.put('/:id/toggle-active', async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);
    
    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    testimonial.active = !testimonial.active;
    await testimonial.save();

    res.json({
      message: `Testimonial ${testimonial.active ? 'activated' : 'deactivated'} successfully`,
      testimonial
    });

  } catch (error) {
    console.error('Error toggling testimonial status:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid testimonial ID' });
    }
    res.status(500).json({ error: 'Failed to toggle testimonial status' });
  }
});

// PUT /api/testimonials/:id/toggle-featured - Toggle testimonial featured status
router.put('/:id/toggle-featured', async (req, res) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);
    
    if (!testimonial) {
      return res.status(404).json({ error: 'Testimonial not found' });
    }

    testimonial.featured = !testimonial.featured;
    await testimonial.save();

    res.json({
      message: `Testimonial ${testimonial.featured ? 'featured' : 'unfeatured'} successfully`,
      testimonial
    });

  } catch (error) {
    console.error('Error toggling testimonial featured status:', error);
    if (error.name === 'CastError') {
      return res.status(400).json({ error: 'Invalid testimonial ID' });
    }
    res.status(500).json({ error: 'Failed to toggle testimonial featured status' });
  }
});

// GET /api/testimonials/featured/list - Get featured testimonials
router.get('/featured/list', async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const featuredTestimonials = await Testimonial.find({ 
      featured: true, 
      active: true 
    })
    .sort({ createdAt: -1 })
    .limit(parseInt(limit));

    res.json(featuredTestimonials);

  } catch (error) {
    console.error('Error fetching featured testimonials:', error);
    res.status(500).json({ error: 'Failed to fetch featured testimonials' });
  }
});

// GET /api/testimonials/stats/overview - Get testimonial statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const [
      totalTestimonials,
      activeTestimonials,
      featuredTestimonials,
      verifiedTestimonials,
      averageRating
    ] = await Promise.all([
      Testimonial.countDocuments(),
      Testimonial.countDocuments({ active: true }),
      Testimonial.countDocuments({ featured: true, active: true }),
      Testimonial.countDocuments({ verified: true }),
      Testimonial.aggregate([
        { $match: { active: true } },
        { $group: { _id: null, averageRating: { $avg: '$rating' } } }
      ])
    ]);

    // Rating distribution
    const ratingDistribution = await Testimonial.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      totalTestimonials,
      activeTestimonials,
      featuredTestimonials,
      verifiedTestimonials,
      averageRating: averageRating.length > 0 ? averageRating[0].averageRating.toFixed(1) : '0.0',
      ratingDistribution
    });

  } catch (error) {
    console.error('Error fetching testimonial statistics:', error);
    res.status(500).json({ error: 'Failed to fetch testimonial statistics' });
  }
});

module.exports = router;