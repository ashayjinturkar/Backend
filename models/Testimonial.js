const mongoose = require('mongoose');

const testimonialSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  position: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    default: 5
  },
  testimonial: {
    type: String,
    trim: true
  },
  image: {
    type: String
  },
  active: {
    type: Boolean,
    default: true
  },
  featured: {
    type: Boolean,
    default: false
  },
  projectType: {
    type: String,
    trim: true
  },
  source: {
    type: String,
    enum: ['website', 'email', 'phone', 'social', 'referral'],
    default: 'website'
  },
  verified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Index for search functionality
testimonialSchema.index({ name: 'text', company: 'text', testimonial: 'text' });

module.exports = mongoose.model('Testimonial', testimonialSchema);