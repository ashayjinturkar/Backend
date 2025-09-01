const mongoose = require('mongoose');

// Newsletter Subscriber Schema
const newsletterSubscriberSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  name: {
    type: String,
    trim: true
  },
  unsubscribed: {
    type: Boolean,
    default: false
  },
  unsubscribedAt: {
    type: Date
  },
  source: {
    type: String,
    default: 'website'
  },
  preferences: {
    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      default: 'weekly'
    },
    categories: [String]
  }
}, {
  timestamps: true
});

// Newsletter Upload Schema
const newsletterUploadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['monthly', 'weekly', 'special', 'announcement', 'update']
  },
  date: {
    type: Date,
    required: true
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Newsletter Campaign Schema (for sent newsletters)
const newsletterCampaignSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  sentTo: {
    type: String,
    enum: ['all', 'selected', 'unsubscribed'],
    required: true
  },
  recipientCount: {
    type: Number,
    required: true
  },
  sentAt: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['sent', 'failed', 'pending'],
    default: 'sent'
  },
  deliveryStats: {
    delivered: { type: Number, default: 0 },
    bounced: { type: Number, default: 0 },
    opened: { type: Number, default: 0 },
    clicked: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

const NewsletterSubscriber = mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);
const NewsletterUpload = mongoose.model('NewsletterUpload', newsletterUploadSchema);
const NewsletterCampaign = mongoose.model('NewsletterCampaign', newsletterCampaignSchema);

module.exports = {
  NewsletterSubscriber,
  NewsletterUpload,
  NewsletterCampaign
};